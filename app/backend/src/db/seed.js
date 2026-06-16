import bcrypt from 'bcryptjs';
import db, { initSchema } from './index.js';
import { createDefaultPipeline } from './migrate.js';

/**
 * Seed the database with a default admin user and a useful set of demo data.
 * Safe to run multiple times: it only seeds when the database is empty.
 */
export function seed({ force = false } = {}) {
  initSchema();

  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount > 0 && !force) {
    return { seeded: false };
  }

  if (force) {
    for (const t of ['invoice_items', 'invoices', 'activities', 'notes', 'tasks', 'deals', 'stages', 'pipelines', 'contacts', 'companies', 'users']) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
  }

  // Ensure the default pipeline exists (normally created by migrate() at
  // startup, but also needed for the standalone `seed --force` path).
  if (db.prepare('SELECT COUNT(*) AS c FROM pipelines').get().c === 0) {
    createDefaultPipeline();
  }

  const tx = db.transaction(() => {
    // --- Users ---
    const adminHash = bcrypt.hashSync('admin123', 10);
    const repHash = bcrypt.hashSync('sales123', 10);
    const adminId = db
      .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
      .run('Admin User', 'admin@crm.test', adminHash).lastInsertRowid;
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'member')")
      .run('Sales Rep', 'rep@crm.test', repHash);

    // --- Companies ---
    const companies = [
      ['Acme Corporation', 'https://acme.example.com', 'Manufacturing', '201-500', 'Chicago, IL', 'Long-standing enterprise account.'],
      ['Globex Inc', 'https://globex.example.com', 'Technology', '51-200', 'San Francisco, CA', 'Fast-growing SaaS company.'],
      ['Initech', 'https://initech.example.com', 'Finance', '11-50', 'Austin, TX', 'Evaluating our premium plan.'],
      ['Umbrella LLC', 'https://umbrella.example.com', 'Healthcare', '500+', 'Boston, MA', 'Strategic partnership opportunity.'],
      ['Hooli', 'https://hooli.example.com', 'Technology', '500+', 'Palo Alto, CA', 'Inbound lead from website.'],
    ];
    const companyIds = companies.map((c) =>
      db.prepare('INSERT INTO companies (name, website, industry, size, location, notes) VALUES (?, ?, ?, ?, ?, ?)').run(...c).lastInsertRowid
    );

    // --- Contacts ---
    const contacts = [
      ['Jane', 'Cooper', 'jane.cooper@acme.example.com', '+1 555 0101', 'VP of Operations', companyIds[0], 'customer'],
      ['Wade', 'Warren', 'wade.warren@acme.example.com', '+1 555 0102', 'Procurement Lead', companyIds[0], 'active'],
      ['Esther', 'Howard', 'esther.howard@globex.example.com', '+1 555 0103', 'CTO', companyIds[1], 'active'],
      ['Cameron', 'Williamson', 'cameron@globex.example.com', '+1 555 0104', 'Product Manager', companyIds[1], 'lead'],
      ['Brooklyn', 'Simmons', 'brooklyn@initech.example.com', '+1 555 0105', 'CFO', companyIds[2], 'lead'],
      ['Leslie', 'Alexander', 'leslie@umbrella.example.com', '+1 555 0106', 'Head of IT', companyIds[3], 'customer'],
      ['Guy', 'Hawkins', 'guy.hawkins@hooli.example.com', '+1 555 0107', 'Engineering Director', companyIds[4], 'lead'],
      ['Robert', 'Fox', 'robert.fox@hooli.example.com', '+1 555 0108', 'CEO', companyIds[4], 'inactive'],
    ];
    const contactIds = contacts.map((c) =>
      db.prepare('INSERT INTO contacts (first_name, last_name, email, phone, job_title, company_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(...c).lastInsertRowid
    );

    // --- Deals ---
    // Resolve stage ids from the default pipeline (created by migrate()).
    const defaultPipeline = db.prepare('SELECT id FROM pipelines ORDER BY position, id LIMIT 1').get();
    const stageRows = db.prepare('SELECT id, name FROM stages WHERE pipeline_id = ?').all(defaultPipeline.id);
    const stageByName = new Map(stageRows.map((s) => [s.name.toLowerCase(), s]));

    const deals = [
      ['Acme annual renewal', companyIds[0], contactIds[0], 48000, 'negotiation', '2026-07-15'],
      ['Globex platform rollout', companyIds[1], contactIds[2], 120000, 'proposal', '2026-08-01'],
      ['Initech pilot', companyIds[2], contactIds[4], 15000, 'qualified', '2026-07-30'],
      ['Umbrella expansion', companyIds[3], contactIds[5], 86000, 'won', '2026-06-01'],
      ['Hooli evaluation', companyIds[4], contactIds[6], 32000, 'lead', '2026-09-10'],
      ['Acme add-on seats', companyIds[0], contactIds[1], 9000, 'won', '2026-05-20'],
      ['Globex churn risk', companyIds[1], contactIds[3], 24000, 'lost', '2026-05-12'],
    ];
    for (const [name, companyId, contactId, value, stageKey, closeDate] of deals) {
      const stage = stageByName.get(stageKey);
      db.prepare('INSERT INTO deals (name, company_id, contact_id, value, stage, stage_id, close_date) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(name, companyId, contactId, value, stage.name, stage.id, closeDate);
    }

    // --- Tasks ---
    const tasks = [
      ['Send renewal proposal to Jane', 'Include updated pricing tiers.', '2026-06-20', 'high', 0, 'contact', contactIds[0]],
      ['Follow up with Globex on rollout', null, '2026-06-18', 'high', 0, 'company', companyIds[1]],
      ['Prepare pilot onboarding doc', null, '2026-06-25', 'medium', 0, 'deal', null],
      ['Call Brooklyn re: budget', null, '2026-06-17', 'medium', 1, 'contact', contactIds[4]],
      ['Quarterly check-in with Umbrella', null, '2026-07-05', 'low', 0, 'company', companyIds[3]],
    ];
    for (const t of tasks) {
      db.prepare('INSERT INTO tasks (title, description, due_date, priority, completed, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(...t);
    }

    // --- Notes ---
    db.prepare("INSERT INTO notes (body, entity_type, entity_id, author_id) VALUES (?, 'contact', ?, ?)")
      .run('Jane prefers email over calls. Decision expected by end of quarter.', contactIds[0], adminId);
    db.prepare("INSERT INTO notes (body, entity_type, entity_id, author_id) VALUES (?, 'company', ?, ?)")
      .run('Globex secured Series B funding — strong expansion potential.', companyIds[1], adminId);

    // --- Activities (seed a small recent feed) ---
    const activities = [
      ['company.created', 'Company "Acme Corporation" was created'],
      ['contact.created', 'Contact "Jane Cooper" was created'],
      ['deal.created', 'Deal "Globex platform rollout" was created'],
      ['deal.stage_changed', 'Deal "Umbrella expansion" moved to Won'],
      ['task.completed', 'Task "Call Brooklyn re: budget" was completed'],
    ];
    for (const a of activities) {
      db.prepare('INSERT INTO activities (type, message, actor_id) VALUES (?, ?, ?)').run(a[0], a[1], adminId);
    }

    // --- Invoices ---
    const invoices = [
      {
        number: 'INV-0001', company_id: companyIds[0], contact_id: contactIds[0], status: 'paid',
        issue_date: '2026-05-01', due_date: '2026-05-31', tax_rate: 8.5,
        items: [
          ['Annual platform license', 1, 36000],
          ['Onboarding & training', 1, 6000],
        ],
      },
      {
        number: 'INV-0002', company_id: companyIds[1], contact_id: contactIds[2], status: 'sent',
        issue_date: '2026-06-05', due_date: '2026-07-05', tax_rate: 0,
        items: [
          ['Platform rollout — phase 1', 1, 60000],
          ['Custom integrations', 40, 250],
        ],
      },
      {
        number: 'INV-0003', company_id: companyIds[2], contact_id: contactIds[4], status: 'draft',
        issue_date: '2026-06-12', due_date: '2026-07-12', tax_rate: 8.5,
        items: [['Pilot program (3 months)', 3, 5000]],
      },
      {
        number: 'INV-0004', company_id: companyIds[3], contact_id: contactIds[5], status: 'overdue',
        issue_date: '2026-04-20', due_date: '2026-05-20', tax_rate: 8.5,
        items: [['Expansion seats', 50, 120], ['Premium support', 1, 4000]],
      },
    ];
    for (const inv of invoices) {
      const id = db
        .prepare('INSERT INTO invoices (number, company_id, contact_id, status, issue_date, due_date, tax_rate) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(inv.number, inv.company_id, inv.contact_id, inv.status, inv.issue_date, inv.due_date, inv.tax_rate).lastInsertRowid;
      inv.items.forEach((it, i) =>
        db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, position) VALUES (?, ?, ?, ?, ?)').run(id, it[0], it[1], it[2], i)
      );
    }
  });

  tx();
  return { seeded: true };
}

// Allow running directly: `node src/db/seed.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = seed({ force: process.argv.includes('--force') });
  console.log(result.seeded ? 'Database seeded.' : 'Database already has data, skipping seed.');
  process.exit(0);
}
