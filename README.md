# Nimbus CRM

A modern, lightweight CRM (contacts, companies, a drag-and-drop deal pipeline,
tasks, notes, and a live activity feed) built with React, Express, SQLite, and
WebSockets — all runnable with a single Docker command.

The full project lives in [`app/`](./app). To get started:

```bash
cd app
docker compose up --build
# open http://localhost:4000  (login: admin@crm.test / admin123)
```

See [`app/README.md`](./app/README.md) for full setup instructions,
architecture notes, the API reference, and known limitations.
