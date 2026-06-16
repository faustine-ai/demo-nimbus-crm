import { Router } from 'express';
import db from '../db/index.js';
import { broadcast } from '../websocket/hub.js';

const router = Router();

/** Load a pipeline together with its ordered stages. */
function pipelineWithStages(id) {
  const pipeline = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id);
  if (!pipeline) return null;
  pipeline.stages = db.prepare('SELECT * FROM stages WHERE pipeline_id = ? ORDER BY position, id').all(id);
  return pipeline;
}

function allPipelines() {
  const pipelines = db.prepare('SELECT * FROM pipelines ORDER BY position, id').all();
  for (const p of pipelines) {
    p.stages = db.prepare('SELECT * FROM stages WHERE pipeline_id = ? ORDER BY position, id').all(p.id);
  }
  return pipelines;
}

router.get('/', (req, res) => {
  res.json(allPipelines());
});

// Create a funnel with a sensible starter set of columns.
router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Pipeline name is required' });

  const nextPos = (db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM pipelines').get().m) + 1;
  const id = db.prepare('INSERT INTO pipelines (name, position) VALUES (?, ?)').run(name.trim(), nextPos).lastInsertRowid;

  const starter = [
    { name: 'New', type: 'open' },
    { name: 'In Progress', type: 'open' },
    { name: 'Won', type: 'won' },
    { name: 'Lost', type: 'lost' },
  ];
  starter.forEach((s, i) => db.prepare('INSERT INTO stages (pipeline_id, name, type, position) VALUES (?, ?, ?, ?)').run(id, s.name, s.type, i));

  const pipeline = pipelineWithStages(id);
  broadcast('pipeline.changed', { id });
  res.status(201).json(pipeline);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pipeline not found' });
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Pipeline name is required' });

  db.prepare("UPDATE pipelines SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name.trim(), req.params.id);
  broadcast('pipeline.changed', { id: Number(req.params.id) });
  res.json(pipelineWithStages(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pipeline not found' });

  const total = db.prepare('SELECT COUNT(*) AS c FROM pipelines').get().c;
  if (total <= 1) return res.status(400).json({ error: 'You must keep at least one pipeline' });

  const dealCount = db
    .prepare('SELECT COUNT(*) AS c FROM deals WHERE stage_id IN (SELECT id FROM stages WHERE pipeline_id = ?)')
    .get(req.params.id).c;
  if (dealCount > 0) return res.status(400).json({ error: 'Move or delete this pipeline’s deals first' });

  db.prepare('DELETE FROM pipelines WHERE id = ?').run(req.params.id); // cascades to stages
  broadcast('pipeline.changed', { id: Number(req.params.id), deleted: true });
  res.json({ ok: true });
});

// Add a column to a pipeline.
router.post('/:id/stages', (req, res) => {
  const pipeline = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(req.params.id);
  if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

  const { name, type } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Column name is required' });
  const stageType = ['open', 'won', 'lost'].includes(type) ? type : 'open';

  const nextPos = (db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM stages WHERE pipeline_id = ?').get(req.params.id).m) + 1;
  db.prepare('INSERT INTO stages (pipeline_id, name, type, position) VALUES (?, ?, ?, ?)').run(req.params.id, name.trim(), stageType, nextPos);

  broadcast('pipeline.changed', { id: Number(req.params.id) });
  res.status(201).json(pipelineWithStages(req.params.id));
});

// Reorder columns: body { order: [stageId, ...] }.
router.put('/:id/stages/reorder', (req, res) => {
  const pipeline = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(req.params.id);
  if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

  const { order } = req.body || {};
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of stage ids' });

  const valid = new Set(db.prepare('SELECT id FROM stages WHERE pipeline_id = ?').all(req.params.id).map((s) => s.id));
  const update = db.prepare("UPDATE stages SET position = ? WHERE id = ? AND pipeline_id = ?");
  const tx = db.transaction(() => {
    order.forEach((stageId, index) => {
      if (valid.has(Number(stageId))) update.run(index, Number(stageId), req.params.id);
    });
  });
  tx();

  broadcast('pipeline.changed', { id: Number(req.params.id) });
  res.json(pipelineWithStages(req.params.id));
});

export default router;
