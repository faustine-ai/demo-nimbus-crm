import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const WebSocketContext = createContext(null);

/**
 * Maintains a single WebSocket connection and lets components subscribe to
 * server events ({ type, payload }). Auto-reconnects if the socket drops.
 */
export function WebSocketProvider({ children }) {
  const listeners = useRef(new Set());
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let reconnectTimer = null;
    let stopped = false;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
      socketRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          listeners.current.forEach((fn) => fn(message));
        } catch {
          /* ignore malformed messages */
        }
      };
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, []);

  // Subscribe to all events; returns an unsubscribe function.
  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  return (
    <WebSocketContext.Provider value={{ subscribe, connected }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket must be used within WebSocketProvider');
  return ctx;
}

/**
 * Convenience hook: run a handler whenever a matching event type arrives.
 * `types` can be a string, array of strings, or omitted for all events.
 */
export function useRealtime(types, handler) {
  const { subscribe } = useWebSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wanted = types == null ? null : Array.isArray(types) ? types : [types];
    return subscribe((message) => {
      if (!wanted || wanted.includes(message.type)) {
        handlerRef.current(message);
      }
    });
  }, [subscribe, Array.isArray(types) ? types.join(',') : types]);
}
