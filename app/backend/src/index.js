import express from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initSchema } from './db/index.js';
import { seed } from './db/seed.js';
import { initWebSocket } from './websocket/hub.js';
import { requireAuth } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import contactsRoutes from './routes/contacts.js';
import companiesRoutes from './routes/companies.js';
import dealsRoutes from './routes/deals.js';
import tasksRoutes from './routes/tasks.js';
import notesRoutes from './routes/notes.js';
import activitiesRoutes from './routes/activities.js';
import dashboardRoutes from './routes/dashboard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

// Initialize database and seed demo data on first run.
initSchema();
seed();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Public auth routes.
app.use('/api/auth', authRoutes);

// Everything below requires a valid token.
app.use('/api/contacts', requireAuth, contactsRoutes);
app.use('/api/companies', requireAuth, companiesRoutes);
app.use('/api/deals', requireAuth, dealsRoutes);
app.use('/api/tasks', requireAuth, tasksRoutes);
app.use('/api/notes', requireAuth, notesRoutes);
app.use('/api/activities', requireAuth, activitiesRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);

// Serve the built frontend (single-container production setup).
const clientDir = path.join(__dirname, '../public');
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
  // SPA fallback: send index.html for any non-API route.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

const server = http.createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`CRM backend listening on http://localhost:${PORT}`);
});
