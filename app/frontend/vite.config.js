import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Where to proxy API + WebSocket calls. Defaults to a backend on localhost
// (host dev); inside Docker it's set to the backend service via BACKEND_URL.
const backend = process.env.BACKEND_URL || 'http://localhost:4000';
const wsBackend = backend.replace(/^http/, 'ws');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true,
    port: 5173,
    // Polling is needed to detect file changes on mounted volumes (Docker on
    // macOS/Windows). Harmless to leave off for native host dev.
    watch: { usePolling: process.env.VITE_USE_POLLING === 'true' },
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/ws': { target: wsBackend, ws: true },
    },
  },
});
