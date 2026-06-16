import { Router } from 'express';
import db from '../db/index.js';
import { broadcast } from '../websocket/hub.js';
import { logActivity } from '../services/activity.js';

const router = Router();

const SELECT_WITH_COMPANY = `
  SELECT c.*, co.name AS company_name
  FROM contacts c
  LEFT JOIN companies co ON co.id = c.company_id
`;

// List with optional search (name/email) and status filter.
router.get('/', (req, res) => {
  const { search = '', status = '' } = req.query;
  const clauses = [];
  const params = [];

  if (search) {
    clauses.push('(c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (status) {
    clauses.push('c.status = ?');
    params.push(status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`${SELECT_WITH_COMPANY} ${where} ORDER BY c.created_at DESC`).all(...params);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const contact = db.prepare(`${SELECT_WITH_COMPANY} WHERE c.id = ?`).get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const deals = db.prepare('SELECT * FROM deals WHERE contact_id = ? ORDER BY created_at DESC').all(contact.id);
  // Keyed as note_entries to avoid clashing with the contact's own `notes` text column.
  const note_entries = db
    .prepare("SELECT * FROM notes WHERE entity_type = 'contact' AND entity_id = ? ORDER BY created_at DESC")
    .all(contact.id);

  res.json({ ...contact, deals, note_entries });
});

router.post('/', (req, res) => {
  const { first_name, last_name, email, phone, job_title, company_id, status, notes } = req.body || {};
  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  const info = db
    .prepare(
      `INSERT INTO contacts (first_name, last_name, email, phone, job_title, company_id, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(first_name, last_name, email || null, phone || null, job_title || null, company_id || null, status || 'lead', notes || null);

  const contact = db.prepare(`${SELECT_WITH_COMPANY} WHERE c.id = ?`).get(info.lastInsertRowid);
  broadcast('contact.created', contact);
  logActivity({
    type: 'contact.created',
    message: `Contact "${first_name} ${last_name}" was created`,
    entityType: 'contact',
    entityId: contact.id,
    actorId: req.user.id,
  });
  res.status(201).json(contact);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact not found' });

  const { first_name, last_name, email, phone, job_title, company_id, status, notes } = req.body || {};
  db.prepare(
    `UPDATE contacts SET first_name = ?, last_name = ?, email = ?, phone = ?, job_title = ?,
       company_id = ?, status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    first_name ?? existing.first_name,
    last_name ?? existing.last_name,
    email ?? existing.email,
    phone ?? existing.phone,
    job_title ?? existing.job_title,
    company_id === undefined ? existing.company_id : company_id || null,
    status ?? existing.status,
    notes ?? existing.notes,
    req.params.id
  );

  const contact = db.prepare(`${SELECT_WITH_COMPANY} WHERE c.id = ?`).get(req.params.id);
  broadcast('contact.updated', contact);
  logActivity({
    type: 'contact.updated',
    message: `Contact "${contact.first_name} ${contact.last_name}" was updated`,
    entityType: 'contact',
    entityId: contact.id,
    actorId: req.user.id,
  });
  res.json(contact);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact not found' });

  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  broadcast('contact.deleted', { id: Number(req.params.id) });
  logActivity({
    type: 'contact.deleted',
    message: `Contact "${existing.first_name} ${existing.last_name}" was deleted`,
    entityType: 'contact',
    entityId: existing.id,
    actorId: req.user.id,
  });
  res.json({ ok: true });
});

export default router;
