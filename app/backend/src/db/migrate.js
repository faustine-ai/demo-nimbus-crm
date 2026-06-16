import db from './index.js';

// The default pipeline used for fresh installs and to migrate legacy deals.
export const DEFAULT_PIPELINE = 'Sales Pipeline';
export const DEFAULT_STAGES = [
  { name: 'Lead', type: 'open' },
  { name: 'Qualified', type: 'open' },
  { name: 'Proposal', type: 'open' },
  { name: 'Negotiation', type: 'open' },
  { name: 'Won', type: 'won' },
  { name: 'Lost', type: 'lost' },
];

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

/** Create the default pipeline with its stages. Returns the pipeline id. */
export function createDefaultPipeline() {
  const pipelineId = db.prepare('INSERT INTO pipelines (name, position) VALUES (?, 0)').run(DEFAULT_PIPELINE).lastInsertRowid;
  DEFAULT_STAGES.forEach((s, i) => {
    db.prepare('INSERT INTO stages (pipeline_id, name, type, position) VALUES (?, ?, ?, ?)').run(pipelineId, s.name, s.type, i);
  });
  return pipelineId;
}

/**
 * Idempotent migration run at startup. Adds the stage_id column to deals if an
 * older database predates pipelines, ensures a default pipeline exists, and
 * backfills any deals that still reference a stage only by its legacy text name.
 */
export function migrate() {
  // Older databases created `deals` before the stage_id column existed.
  if (!hasColumn('deals', 'stage_id')) {
    db.exec('ALTER TABLE deals ADD COLUMN stage_id INTEGER REFERENCES stages(id)');
  }
  // Safe to index now that the column is guaranteed to exist.
  db.exec('CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON deals(stage_id)');

  const pipelineCount = db.prepare('SELECT COUNT(*) AS c FROM pipelines').get().c;
  if (pipelineCount === 0) {
    createDefaultPipeline();
  }

  // Backfill deals that have no stage_id yet (legacy rows) by matching the
  // deal's text stage name to a stage in the default pipeline.
  const orphans = db.prepare('SELECT id, stage FROM deals WHERE stage_id IS NULL').all();
  if (orphans.length) {
    const defaultPipeline = db.prepare('SELECT id FROM pipelines ORDER BY position, id LIMIT 1').get();
    const stages = db.prepare('SELECT id, name FROM stages WHERE pipeline_id = ? ORDER BY position').all(defaultPipeline.id);
    const byName = new Map(stages.map((s) => [s.name.toLowerCase(), s.id]));
    const fallback = stages[0]?.id;

    const update = db.prepare("UPDATE deals SET stage_id = ?, stage = ? WHERE id = ?");
    const tx = db.transaction(() => {
      for (const d of orphans) {
        const matchId = byName.get(String(d.stage || '').toLowerCase()) || fallback;
        const matchName = stages.find((s) => s.id === matchId)?.name || d.stage;
        if (matchId) update.run(matchId, matchName, d.id);
      }
    });
    tx();
  }
}
