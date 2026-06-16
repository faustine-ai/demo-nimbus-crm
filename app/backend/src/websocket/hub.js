import { WebSocketServer } from 'ws';

let wss = null;

/** Attach a WebSocket server to an existing HTTP server. */
export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'connected', payload: { ok: true } }));
  });

  return wss;
}

/**
 * Broadcast an event to every connected client.
 * Events are simple { type, payload } JSON messages so the frontend
 * can react with a small switch statement.
 */
export function broadcast(type, payload) {
  if (!wss) return;
  const message = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(message);
    }
  }
}
