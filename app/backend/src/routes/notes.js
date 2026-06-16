import { Router } from 'express';
import db from '../db/index.js';
import { broadcast } from '../websocket/hub.js';

const router = Router();

const VALID_ENTITIES = ['contact', 'company', 'deal'];

// Create a note attached to a contact, company, or deal.
router.post('/', (req, res) => {
  const { body, entity_type, entity_id } = req.body || {};
  if (!body || !entity_type || !entity_id) {
    return res.status(400).json({ error: 'body, entity_type and entity_id are required' });
  }
  if (!VALID_ENTITIES.includes(entity_type)) {
    return res.status(400).json({ error: 'Invalid entity_type' });
  }

  const info = db
    .prepare('INSERT INTO notes (body, entity_type, entity_id, author_id) VALUES (?, ?, ?, ?)')
    .run(body, entity_type, entity_id, req.user.id);

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid);
  broadcast('note.created', note);
  res.status(201).json(note);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Note not found' });
  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  broadcast('note.deleted', { id: Number(req.params.id) });
  res.json({ ok: true });
});

export default router;
