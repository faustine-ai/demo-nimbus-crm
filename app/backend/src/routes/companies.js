import { Router } from 'express';
import db from '../db/index.js';
import { broadcast } from '../websocket/hub.js';
import { logActivity } from '../services/activity.js';

const router = Router();

// List companies with a contact count for nicer table display.
router.get('/', (req, res) => {
  const { search = '' } = req.query;
  let rows;
  if (search) {
    const like = `%${search}%`;
    rows = db
      .prepare(
        `SELECT co.*, (SELECT COUNT(*) FROM contacts WHERE company_id = co.id) AS contact_count
         FROM companies co
         WHERE co.name LIKE ? OR co.industry LIKE ? OR co.location LIKE ?
         ORDER BY co.created_at DESC`
      )
      .all(like, like, like);
  } else {
    rows = db
      .prepare(
        `SELECT co.*, (SELECT COUNT(*) FROM contacts WHERE company_id = co.id) AS contact_count
         FROM companies co ORDER BY co.created_at DESC`
      )
      .all();
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const contacts = db.prepare('SELECT * FROM contacts WHERE company_id = ? ORDER BY created_at DESC').all(company.id);
  const deals = db
    .prepare(
      `SELECT d.*, s.name AS stage_name, s.type AS stage_type
       FROM deals d LEFT JOIN stages s ON s.id = d.stage_id
       WHERE d.company_id = ? ORDER BY d.created_at DESC`
    )
    .all(company.id);
  const note_entries = db
    .prepare("SELECT * FROM notes WHERE entity_type = 'company' AND entity_id = ? ORDER BY created_at DESC")
    .all(company.id);

  res.json({ ...company, contacts, deals, note_entries });
});

router.post('/', (req, res) => {
  const { name, website, industry, size, location, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Company name is required' });

  const info = db
    .prepare('INSERT INTO companies (name, website, industry, size, location, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, website || null, industry || null, size || null, location || null, notes || null);

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(info.lastInsertRowid);
  broadcast('company.created', company);
  logActivity({
    type: 'company.created',
    message: `Company "${name}" was created`,
    entityType: 'company',
    entityId: company.id,
    actorId: req.user.id,
  });
  res.status(201).json(company);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Company not found' });

  const { name, website, industry, size, location, notes } = req.body || {};
  db.prepare(
    `UPDATE companies SET name = ?, website = ?, industry = ?, size = ?, location = ?, notes = ?,
       updated_at = datetime('now') WHERE id = ?`
  ).run(
    name ?? existing.name,
    website ?? existing.website,
    industry ?? existing.industry,
    size ?? existing.size,
    location ?? existing.location,
    notes ?? existing.notes,
    req.params.id
  );

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  broadcast('company.updated', company);
  logActivity({
    type: 'company.updated',
    message: `Company "${company.name}" was updated`,
    entityType: 'company',
    entityId: company.id,
    actorId: req.user.id,
  });
  res.json(company);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Company not found' });

  db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
  broadcast('company.deleted', { id: Number(req.params.id) });
  logActivity({
    type: 'company.deleted',
    message: `Company "${existing.name}" was deleted`,
    entityType: 'company',
    entityId: existing.id,
    actorId: req.user.id,
  });
  res.json({ ok: true });
});

export default router;
