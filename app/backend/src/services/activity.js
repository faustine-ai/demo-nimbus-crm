import db from '../db/index.js';
import { broadcast } from '../websocket/hub.js';

/**
 * Record an activity row and broadcast it to all clients in real time.
 * Centralizing this keeps activity logging consistent across routes.
 */
export function logActivity({ type, message, entityType = null, entityId = null, actorId = null }) {
  const info = db
    .prepare(
      'INSERT INTO activities (type, message, entity_type, entity_id, actor_id) VALUES (?, ?, ?, ?, ?)'
    )
    .run(type, message, entityType, entityId, actorId);

  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(info.lastInsertRowid);
  broadcast('activity.created', activity);
  return activity;
}
