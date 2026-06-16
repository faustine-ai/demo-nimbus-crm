import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// Recent activity feed (most recent first).
router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const rows = db.prepare('SELECT * FROM activities ORDER BY created_at DESC, id DESC LIMIT ?').all(limit);
  res.json(rows);
});

export default router;
