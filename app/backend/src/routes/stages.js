import { Router } from 'express';
import db from '../db/index.js';
import { broadcast } from '../websocket/hub.js';

const router = Router();

// Rename a column or change its type ('open' | 'won' | 'lost').
router.put('/:id', (req, res) => {
  const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.id);
  if (!stage) return res.status(404).json({ error: 'Column not found' });

  const { name, type } = req.body || {};
  const nextName = name && name.trim() ? name.trim() : stage.name;
  const nextType = ['open', 'won', 'lost'].includes(type) ? type : stage.type;

  db.prepare('UPDATE stages SET name = ?, type = ? WHERE id = ?').run(nextName, nextType, req.params.id);
  // Keep the denormalized name mirror on deals in sync.
  db.prepare('UPDATE deals SET stage = ? WHERE stage_id = ?').run(nextName, req.params.id);

  broadcast('pipeline.changed', { id: stage.pipeline_id });
  res.json(db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.id);
  if (!stage) return res.status(404).json({ error: 'Column not found' });

  const stageCount = db.prepare('SELECT COUNT(*) AS c FROM stages WHERE pipeline_id = ?').get(stage.pipeline_id).c;
  if (stageCount <= 1) return res.status(400).json({ error: 'A pipeline must have at least one column' });

  const dealCount = db.prepare('SELECT COUNT(*) AS c FROM deals WHERE stage_id = ?').get(req.params.id).c;
  if (dealCount > 0) return res.status(400).json({ error: 'Move this column’s deals elsewhere first' });

  db.prepare('DELETE FROM stages WHERE id = ?').run(req.params.id);
  broadcast('pipeline.changed', { id: stage.pipeline_id });
  res.json({ ok: true });
});

export default router;
