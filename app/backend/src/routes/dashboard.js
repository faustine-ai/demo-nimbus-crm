import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// Aggregate counts and stats for the dashboard.
router.get('/', (req, res) => {
  const totalContacts = db.prepare('SELECT COUNT(*) AS c FROM contacts').get().c;
  const totalCompanies = db.prepare('SELECT COUNT(*) AS c FROM companies').get().c;
  const totalDeals = db.prepare('SELECT COUNT(*) AS c FROM deals').get().c;

  // Won/lost/open are derived from the stage *type*, not a fixed stage name,
  // so custom pipelines report correctly.
  const byType = (type, col = 'COUNT(*)') =>
    db.prepare(`SELECT ${col} AS v FROM deals d JOIN stages s ON s.id = d.stage_id WHERE s.type = ?`).get(type).v;

  const openDeals = byType('open');
  const wonDeals = byType('won');
  const lostDeals = byType('lost');
  const openValue = byType('open', 'COALESCE(SUM(d.value),0)');
  const wonValue = byType('won', 'COALESCE(SUM(d.value),0)');

  const openTasks = db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE completed = 0').get().c;

  // Invoice rollups: outstanding = unpaid (draft/sent/overdue), plus paid total.
  const invoiceRows = db
    .prepare(
      `SELECT i.status, i.tax_rate,
              (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM invoice_items WHERE invoice_id = i.id) AS subtotal
       FROM invoices i`
    )
    .all();
  let invoiceOutstanding = 0;
  let invoicePaid = 0;
  for (const r of invoiceRows) {
    const total = r.subtotal * (1 + (r.tax_rate || 0) / 100);
    if (r.status === 'paid') invoicePaid += total;
    else if (['draft', 'sent', 'overdue'].includes(r.status)) invoiceOutstanding += total;
  }
  invoiceOutstanding = Math.round(invoiceOutstanding * 100) / 100;
  invoicePaid = Math.round(invoicePaid * 100) / 100;
  const invoiceCount = invoiceRows.length;

  // Pipeline chart: stages of the default (first) pipeline with deal counts.
  const defaultPipeline = db.prepare('SELECT * FROM pipelines ORDER BY position, id LIMIT 1').get();
  let pipelineName = null;
  let stages = [];
  if (defaultPipeline) {
    pipelineName = defaultPipeline.name;
    stages = db
      .prepare(
        `SELECT s.name, s.type,
                (SELECT COUNT(*) FROM deals WHERE stage_id = s.id) AS count,
                (SELECT COALESCE(SUM(value),0) FROM deals WHERE stage_id = s.id) AS value
         FROM stages s WHERE s.pipeline_id = ? ORDER BY s.position, s.id`
      )
      .all(defaultPipeline.id);
  }

  res.json({
    totalContacts,
    totalCompanies,
    totalDeals,
    openDeals,
    wonDeals,
    lostDeals,
    openValue,
    wonValue,
    openTasks,
    invoiceOutstanding,
    invoicePaid,
    invoiceCount,
    pipelineName,
    stages,
  });
});

export default router;
