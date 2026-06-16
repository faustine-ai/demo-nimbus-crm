# --- Stage 1: build the React frontend ---
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: backend runtime (also serves the built frontend) ---
FROM node:20-slim AS runtime
WORKDIR /app/backend

# Build tools are only needed if a prebuilt better-sqlite3 binary is unavailable.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

COPY backend/ ./
# Copy the compiled frontend into the location the backend serves from.
COPY --from=frontend /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/app/data/crm.db
EXPOSE 4000

CMD ["node", "src/index.js"]
