# Nimbus CRM

A modern, lightweight CRM for small and medium-sized businesses. It covers the
day-to-day essentials — contacts, companies, a drag-and-drop sales pipeline,
tasks, notes, and a live activity feed — in a clean, fast single-page app.

Built to be simple and readable: React + Tailwind + shadcn/ui on the front end,
Node + Express + SQLite on the back end, and native WebSockets for real-time
updates. Runs with a single Docker command.

---

## Quick start

One command — that's it:

```bash
cd app
docker compose up
```

Then open **http://localhost:5173**.

Log in with the seeded admin account:

| Email            | Password   | Role   |
| ---------------- | ---------- | ------ |
| `admin@crm.test` | `admin123` | admin  |
| `rep@crm.test`   | `sales123` | member |

> Tip: log in as both users in two browser windows to watch real-time updates
> propagate instantly between sessions.

This default stack runs in **development mode with live reload** — your source
is mounted into the containers, so:

- editing **any frontend file** hot-reloads the browser instantly (Vite HMR);
- editing **any backend file** restarts the API automatically (`node --watch`).

The database is seeded automatically on first run. The first boot installs
dependencies inside the containers, so it takes a little longer; subsequent
starts are fast. To start over with a fresh database:

```bash
docker compose down -v   # removes volumes, re-seeds on next start
```

---

## Production build (single container)

To run the optimized production build — frontend compiled to static files and
served by the backend from a single container on port **4000**:

```bash
cd app
docker compose -f docker-compose.prod.yml up --build
```

Then open **http://localhost:4000**.

> Both stacks use backend port 4000, so run one at a time (`docker compose down`
> before switching).

### Configuration

Environment variables for the dev stack live in **`app/.env`** (auto-loaded by
Docker Compose):

| Variable      | Default                | Description                                        |
| ------------- | ---------------------- | -------------------------------------------------- |
| `BACKEND_URL` | `http://backend:4000`  | Backend the frontend dev server proxies `/api` and `/ws` to. |

Change `BACKEND_URL` to point the frontend at a different backend (e.g.
`http://localhost:4000` for host-only dev), then restart with `docker compose up -d`.

---

## Running locally without Docker

You need Node.js 18+ installed. Run the backend and frontend in two terminals.

**Terminal 1 — backend (API + WebSocket on :4000):**

```bash
cd app/backend
npm install
npm start
```

**Terminal 2 — frontend (Vite dev server on :5173):**

```bash
cd app/frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` and `/ws`
to the backend, so everything just works. The SQLite database and seed data are
created automatically the first time the backend starts.

---

## Features

- **Authentication** — token-based (JWT) login/logout with a seeded admin user.
- **Dashboard** — totals for contacts, companies, and deals; open/won/lost stats;
  win rate; a pipeline-by-stage chart; and a live activity feed.
- **Contacts** — full CRUD, search, status filtering, and a detail page with
  related deals and notes.
- **Companies** — full CRUD with a detail page showing related contacts, deals,
  and notes.
- **Deals** — a drag-and-drop Kanban pipeline. Pipelines are fully
  customizable: add, rename, reorder (drag), and delete columns; create multiple
  funnels and switch between them. Each column has a type (Open / Won / Lost)
  that drives win-rate reporting.
- **Invoices** — create, edit, and manage invoices with multiple line items,
  per-invoice tax rate, and auto-generated numbers (`INV-0001`). Totals are
  computed automatically; track status (draft → sent → paid / overdue / void),
  view a printable invoice document, and see outstanding/paid rollups on the
  dashboard.
- **Tasks** — create tasks optionally linked to a contact, company, or deal;
  set priority and due date; mark complete; filter by status.
- **Notes & Activity** — add notes to any record; key actions (created, updated,
  stage changes, completed tasks) are logged automatically.
- **Real-time** — every create/update/delete is broadcast over WebSockets, so
  all connected clients (and the dashboard feed) update live.
- **Polished UX** — sidebar navigation, modals for create/edit, empty states,
  loading states, confirmation dialogs, and toast notifications.

---

## Architecture

```
app/
├── backend/                  Node + Express + SQLite + WebSocket
│   └── src/
│       ├── db/               schema.sql, connection, seed script
│       ├── routes/           one file per resource (REST endpoints)
│       ├── services/         activity logging
│       ├── websocket/        WebSocket hub + broadcast helper
│       ├── middleware/       JWT auth
│       └── index.js          server entry (also serves the built frontend)
├── frontend/                 React SPA (Vite)
│   └── src/
│       ├── components/        UI primitives (shadcn/ui) + shared components
│       ├── pages/             one file per screen
│       ├── hooks/             auth + WebSocket React contexts
│       └── lib/               api client, formatters, constants
├── Dockerfile                multi-stage: build frontend → run backend
└── docker-compose.yml        single service + persistent volume
```

**Backend.** A small Express app. Each resource (`contacts`, `companies`,
`deals`, `tasks`, `notes`, `activities`, `dashboard`) has its own route file
with plain SQL queries via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)
(synchronous, no ORM). Auth is stateless JWT — `requireAuth` middleware protects
every `/api` route except login. Whenever data changes, the route records an
activity (where relevant) and calls `broadcast()` to push a `{ type, payload }`
message to all WebSocket clients.

**Frontend.** A React SPA built with Vite. State is intentionally simple —
React `useState`/`useEffect`, two small contexts (`useAuth`, `useWebSocket`),
and `fetch` calls through a tiny `api` wrapper. There is no Redux/React Query.
The `useRealtime(types, handler)` hook lets any page subscribe to WebSocket
events; pages typically just re-fetch their list when a relevant event arrives,
which keeps the real-time logic trivial to follow.

**Single container.** In production the frontend is built to static files and
served by the same Express server that exposes the API and WebSocket, so the
whole app runs on one port (`4000`) in one container.

**Database.** SQLite with a straightforward schema (`users`, `companies`,
`contacts`, `deals`, `tasks`, `notes`, `activities`, `pipelines` and
`stages` for customizable funnels, plus `invoices` and `invoice_items`). The schema lives in
`backend/src/db/schema.sql` and is applied on startup; `backend/src/db/migrate.js`
runs an idempotent migration that creates the default pipeline and moves any
legacy deals onto it. Seed data is inserted on first run only. To re-seed an existing local
database from scratch:

```bash
cd app/backend
node src/db/seed.js --force
```

---

## API overview

All endpoints are under `/api`. Every route except `/api/auth/login` requires an
`Authorization: Bearer <token>` header.

| Method | Path                  | Description                          |
| ------ | --------------------- | ------------------------------------ |
| POST   | `/auth/login`         | Log in, returns `{ token, user }`    |
| GET    | `/auth/me`            | Current user                         |
| GET    | `/dashboard`          | Aggregate stats                      |
| GET    | `/activities`         | Recent activity feed                 |
| GET/POST | `/contacts`         | List (search/filter) / create        |
| GET/PUT/DELETE | `/contacts/:id` | Detail / update / delete           |
| GET/POST | `/companies`        | List (search) / create               |
| GET/PUT/DELETE | `/companies/:id` | Detail / update / delete          |
| GET/POST | `/deals`            | List / create                        |
| PUT/DELETE | `/deals/:id`      | Update / delete                      |
| PATCH  | `/deals/:id/stage`    | Move a deal to a column (Kanban)     |
| GET/POST | `/pipelines`        | List funnels (+stages) / create      |
| PUT/DELETE | `/pipelines/:id`  | Rename / delete a funnel             |
| POST   | `/pipelines/:id/stages` | Add a column                       |
| PUT    | `/pipelines/:id/stages/reorder` | Reorder columns            |
| PUT/DELETE | `/stages/:id`     | Rename/retype / delete a column      |
| GET/POST | `/tasks`            | List (status filter) / create        |
| PUT/DELETE | `/tasks/:id`      | Update (incl. complete) / delete     |
| GET/POST | `/invoices`         | List (search/status) / create        |
| GET/PUT/DELETE | `/invoices/:id` | Detail / update / delete           |
| PATCH  | `/invoices/:id/status` | Quick status change (sent/paid/…) |
| POST/DELETE | `/notes` `/notes/:id` | Add / remove a note             |

WebSocket: connect to `/ws`. Messages are JSON `{ type, payload }`, e.g.
`contact.created`, `deal.updated`, `activity.created`.

---

## Known limitations & future improvements

This is a focused prototype, kept deliberately simple. Things a production
version would add:

- **WebSocket auth & scoping.** The socket is currently open to any client on
  the host and broadcasts globally. A real deployment would authenticate the
  socket and scope events per workspace/tenant.
- **Single workspace / no roles enforcement.** Users exist and have roles, but
  there is no multi-tenant separation or per-role permission enforcement yet.
- **No pagination.** Lists return all rows. Fine for a demo dataset; add
  pagination/virtualization for large accounts.
- **Minimal validation.** The backend checks required fields; richer validation
  (email format, schema validation) and server-side rate limiting are TODO.
- **No automated tests.** Endpoints were verified manually; a test suite would
  be the next addition.
- **Account management.** Sign-up, password reset, and profile editing are out
  of scope — users are seeded.
- **Token storage.** The JWT is kept in `localStorage` for simplicity; an
  httpOnly cookie flow would be more secure.

---

## Tech stack

**Frontend:** React 18, Vite, React Router, Tailwind CSS, shadcn/ui (Radix
primitives), lucide-react, Recharts, sonner.

**Backend:** Node.js, Express, better-sqlite3, ws (WebSockets), jsonwebtoken,
bcryptjs.

**Infra:** Docker, docker-compose, SQLite.
