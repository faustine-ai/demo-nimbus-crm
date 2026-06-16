import { Router } from 'express';
import db from '../db/index.js';
import { broadcast } from '../websocket/hub.js';
import { logActivity } from '../services/activity.js';

const router = Router();

export const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

const SELECT_WITH_RELATIONS = `
  SELECT d.*, co.name AS company_name,
         c.first_name AS contact_first_name, c.last_name AS contact_last_name
  FROM deals d
  LEFT JOIN companies co ON co.id = d.company_id
  LEFT JOIN contacts c ON c.id = d.contact_id
`;

const label = (stage) => stage.charAt(0).toUpperCase() + stage.slice(1);

router.get('/', (req, res) => {
  const rows = db.prepare(`${SELECT_WITH_RELATIONS} ORDER BY d.created_at DESC`).all();
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
  const { name, company_id, contact_id, value, stage, close_date, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Deal name is required' });
  if (stage && !STAGES.includes(stage)) {
    return res.status(400).json({ error: 'Invalid stage' });
  }

  const info = db
    .prepare(
      `INSERT INTO deals (name, company_id, contact_id, value, stage, close_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, company_id || null, contact_id || null, Number(value) || 0, stage || 'lead', close_date || null, notes || null);

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

  const { name, company_id, contact_id, value, stage, close_date, notes } = req.body || {};
  if (stage && !STAGES.includes(stage)) {
    return res.status(400).json({ error: 'Invalid stage' });
  }

  const nextStage = stage ?? existing.stage;
  db.prepare(
    `UPDATE deals SET name = ?, company_id = ?, contact_id = ?, value = ?, stage = ?, close_date = ?,
       notes = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    name ?? existing.name,
    company_id === undefined ? existing.company_id : company_id || null,
    contact_id === undefined ? existing.contact_id : contact_id || null,
    value === undefined ? existing.value : Number(value) || 0,
    nextStage,
    close_date === undefined ? existing.close_date : close_date || null,
    notes ?? existing.notes,
    req.params.id
  );

  const deal = db.prepare(`${SELECT_WITH_RELATIONS} WHERE d.id = ?`).get(req.params.id);
  broadcast('deal.updated', deal);

  if (nextStage !== existing.stage) {
    logActivity({
      type: 'deal.stage_changed',
      message: `Deal "${deal.name}" moved to ${label(nextStage)}`,
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

// Dedicated lightweight endpoint for the Kanban drag-and-drop.
router.patch('/:id/stage', (req, res) => {
  const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Deal not found' });

  const { stage } = req.body || {};
  if (!STAGES.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });

  db.prepare("UPDATE deals SET stage = ?, updated_at = datetime('now') WHERE id = ?").run(stage, req.params.id);
  const deal = db.prepare(`${SELECT_WITH_RELATIONS} WHERE d.id = ?`).get(req.params.id);
  broadcast('deal.updated', deal);

  if (stage !== existing.stage) {
    logActivity({
      type: 'deal.stage_changed',
      message: `Deal "${deal.name}" moved to ${label(stage)}`,
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
