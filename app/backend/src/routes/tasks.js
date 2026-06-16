import { Router } from 'express';
import db from '../db/index.js';
import { broadcast } from '../websocket/hub.js';
import { logActivity } from '../services/activity.js';

const router = Router();

// Resolve a human-friendly label for the linked entity (best effort).
function entityLabel(type, id) {
  if (!type || !id) return null;
  if (type === 'contact') {
    const c = db.prepare('SELECT first_name, last_name FROM contacts WHERE id = ?').get(id);
    return c ? `${c.first_name} ${c.last_name}` : null;
  }
  if (type === 'company') {
    const c = db.prepare('SELECT name FROM companies WHERE id = ?').get(id);
    return c ? c.name : null;
  }
  if (type === 'deal') {
    const d = db.prepare('SELECT name FROM deals WHERE id = ?').get(id);
    return d ? d.name : null;
  }
  return null;
}

function withLabel(task) {
  return { ...task, entity_label: entityLabel(task.entity_type, task.entity_id) };
}

// List with optional status filter: 'open' | 'completed' (default all).
router.get('/', (req, res) => {
  const { status = '' } = req.query;
  let rows;
  if (status === 'open') {
    rows = db.prepare('SELECT * FROM tasks WHERE completed = 0 ORDER BY due_date IS NULL, due_date ASC').all();
  } else if (status === 'completed') {
    rows = db.prepare('SELECT * FROM tasks WHERE completed = 1 ORDER BY updated_at DESC').all();
  } else {
    rows = db.prepare('SELECT * FROM tasks ORDER BY completed ASC, due_date IS NULL, due_date ASC').all();
  }
  res.json(rows.map(withLabel));
});

router.post('/', (req, res) => {
  const { title, description, due_date, priority, entity_type, entity_id } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Task title is required' });

  const info = db
    .prepare(
      `INSERT INTO tasks (title, description, due_date, priority, entity_type, entity_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(title, description || null, due_date || null, priority || 'medium', entity_type || null, entity_id || null);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  broadcast('task.created', withLabel(task));
  logActivity({
    type: 'task.created',
    message: `Task "${title}" was created`,
    entityType: entity_type || null,
    entityId: entity_id || null,
    actorId: req.user.id,
  });
  res.status(201).json(withLabel(task));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const { title, description, due_date, priority, entity_type, entity_id, completed } = req.body || {};
  const nextCompleted = completed === undefined ? existing.completed : completed ? 1 : 0;

  db.prepare(
    `UPDATE tasks SET title = ?, description = ?, due_date = ?, priority = ?, entity_type = ?,
       entity_id = ?, completed = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? existing.title,
    description ?? existing.description,
    due_date === undefined ? existing.due_date : due_date || null,
    priority ?? existing.priority,
    entity_type === undefined ? existing.entity_type : entity_type || null,
    entity_id === undefined ? existing.entity_id : entity_id || null,
    nextCompleted,
    req.params.id
  );

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  broadcast('task.updated', withLabel(task));

  // Log a completion activity when a task transitions to done.
  if (existing.completed === 0 && nextCompleted === 1) {
    logActivity({
      type: 'task.completed',
      message: `Task "${task.title}" was completed`,
      entityType: task.entity_type,
      entityId: task.entity_id,
      actorId: req.user.id,
    });
  }
  res.json(withLabel(task));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  broadcast('task.deleted', { id: Number(req.params.id) });
  res.json({ ok: true });
});

export default router;
