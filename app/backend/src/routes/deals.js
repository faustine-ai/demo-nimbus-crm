import { Router } from 'express';
import db from '../db/index.js';
import { broadcast } from '../websocket/hub.js';
import { logActivity } from '../services/activity.js';

const router = Router();

const SELECT_WITH_RELATIONS = `
  SELECT d.*, co.name AS company_name,
         c.first_name AS contact_first_name, c.last_name AS contact_last_name,
         s.name AS stage_name, s.type AS stage_type, s.pipeline_id AS pipeline_id
  FROM deals d
  LEFT JOIN companies co ON co.id = d.company_id
  LEFT JOIN contacts c ON c.id = d.contact_id
  LEFT JOIN stages s ON s.id = d.stage_id
`;

const getStage = (id) => db.prepare('SELECT * FROM stages WHERE id = ?').get(id);
const firstStage = () =>
  db.prepare('SELECT s.* FROM stages s JOIN pipelines p ON p.id = s.pipeline_id ORDER BY p.position, p.id, s.position LIMIT 1').get();

// List deals, optionally scoped to a single pipeline.
router.get('/', (req, res) => {
  const { pipeline_id } = req.query;
  let rows;
  if (pipeline_id) {
    rows = db.prepare(`${SELECT_WITH_RELATIONS} WHERE s.pipeline_id = ? ORDER BY d.created_at DESC`).all(pipeline_id);
  } else {
    rows = db.prepare(`${SELECT_WITH_RELATIONS} ORDER BY d.created_at DESC`).all();
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const deal = db.prepare(`${SELECT_WITH_RELATIONS} WHERE d.id = ?`).get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  const note_entries = db
    .prepare("SELECT * FROM notes WHERE entity_type = 'deal' AND entity_id = ? ORDER BY created_at DESC")
    .all(deal.id);
  res.json({ ...deal, note_entries });
});

router.post('/', (req, res) => {
  const { name, company_id, contact_id, value, stage_id, close_date, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Deal name is required' });

  let stage = stage_id ? getStage(stage_id) : null;
  if (stage_id && !stage) return res.status(400).json({ error: 'Invalid stage' });
  if (!stage) stage = firstStage();
  if (!stage) return res.status(400).json({ error: 'No pipeline stages exist yet' });

  const info = db
    .prepare(
      `INSERT INTO deals (name, company_id, contact_id, value, stage, stage_id, close_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, company_id || null, contact_id || null, Number(value) || 0, stage.name, stage.id, close_date || null, notes || null);

  const deal = db.prepare(`${SELECT_WITH_RELATIONS} WHERE d.id = ?`).get(info.lastInsertRowid);
  broadcast('deal.created', deal);
  logActivity({
    type: 'deal.created',
    message: `Deal "${name}" was created`,
    entityType: 'deal',
    entityId: deal.id,
    actorId: req.user.id,
  });
  res.status(201).json(deal);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Deal not found' });

  const { name, company_id, contact_id, value, stage_id, close_date, notes } = req.body || {};

  let nextStageId = existing.stage_id;
  let nextStageName = existing.stage;
  if (stage_id !== undefined && Number(stage_id) !== existing.stage_id) {
    const stage = getStage(stage_id);
    if (!stage) return res.status(400).json({ error: 'Invalid stage' });
    nextStageId = stage.id;
    nextStageName = stage.name;
  }

  db.prepare(
    `UPDATE deals SET name = ?, company_id = ?, contact_id = ?, value = ?, stage = ?, stage_id = ?,
       close_date = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    name ?? existing.name,
    company_id === undefined ? existing.company_id : company_id || null,
    contact_id === undefined ? existing.contact_id : contact_id || null,
    value === undefined ? existing.value : Number(value) || 0,
    nextStageName,
    nextStageId,
    close_date === undefined ? existing.close_date : close_date || null,
    notes ?? existing.notes,
    req.params.id
  );

  const deal = db.prepare(`${SELECT_WITH_RELATIONS} WHERE d.id = ?`).get(req.params.id);
  broadcast('deal.updated', deal);

  if (nextStageId !== existing.stage_id) {
    logActivity({
      type: 'deal.stage_changed',
      message: `Deal "${deal.name}" moved to ${nextStageName}`,
      entityType: 'deal',
      entityId: deal.id,
      actorId: req.user.id,
    });
  } else {
    logActivity({
      type: 'deal.updated',
      message: `Deal "${deal.name}" was updated`,
      entityType: 'deal',
      entityId: deal.id,
      actorId: req.user.id,
    });
  }
  res.json(deal);
});

// Lightweight endpoint for the Kanban drag-and-drop: move a deal to a stage.
router.patch('/:id/stage', (req, res) => {
  const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Deal not found' });

  const { stage_id } = req.body || {};
  const stage = getStage(stage_id);
  if (!stage) return res.status(400).json({ error: 'Invalid stage' });

  db.prepare("UPDATE deals SET stage = ?, stage_id = ?, updated_at = datetime('now') WHERE id = ?").run(stage.name, stage.id, req.params.id);
  const deal = db.prepare(`${SELECT_WITH_RELATIONS} WHERE d.id = ?`).get(req.params.id);
  broadcast('deal.updated', deal);

  if (stage.id !== existing.stage_id) {
    logActivity({
      type: 'deal.stage_changed',
      message: `Deal "${deal.name}" moved to ${stage.name}`,
      entityType: 'deal',
      entityId: deal.id,
      actorId: req.user.id,
    });
  }
  res.json(deal);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Deal not found' });

  db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
  broadcast('deal.deleted', { id: Number(req.params.id) });
  logActivity({
    type: 'deal.deleted',
    message: `Deal "${existing.name}" was deleted`,
    entityType: 'deal',
    entityId: existing.id,
    actorId: req.user.id,
  });
  res.json({ ok: true });
});

export default router;
