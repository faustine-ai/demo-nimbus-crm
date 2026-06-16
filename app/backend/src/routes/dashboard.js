import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// Aggregate counts and stats for the dashboard.
router.get('/', (req, res) => {
  const totalContacts = db.prepare('SELECT COUNT(*) AS c FROM contacts').get().c;
  const totalCompanies = db.prepare('SELECT COUNT(*) AS c FROM companies').get().c;
  const totalDeals = db.prepare('SELECT COUNT(*) AS c FROM deals').get().c;

  const openStages = "('lead','qualified','proposal','negotiation')";
  const openDeals = db.prepare(`SELECT COUNT(*) AS c FROM deals WHERE stage IN ${openStages}`).get().c;
  const wonDeals = db.prepare("SELECT COUNT(*) AS c FROM deals WHERE stage = 'won'").get().c;
  const lostDeals = db.prepare("SELECT COUNT(*) AS c FROM deals WHERE stage = 'lost'").get().c;

  const openValue = db.prepare(`SELECT COALESCE(SUM(value),0) AS v FROM deals WHERE stage IN ${openStages}`).get().v;
  const wonValue = db.prepare("SELECT COALESCE(SUM(value),0) AS v FROM deals WHERE stage = 'won'").get().v;

  const openTasks = db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE completed = 0').get().c;

  // Deal counts grouped by stage, for the pipeline chart.
  const byStageRows = db.prepare('SELECT stage, COUNT(*) AS count, COALESCE(SUM(value),0) AS value FROM deals GROUP BY stage').all();
  const dealsByStage = {};
  for (const row of byStageRows) {
    dealsByStage[row.stage] = { count: row.count, value: row.value };
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
    dealsByStage,
  });
});

export default router;
