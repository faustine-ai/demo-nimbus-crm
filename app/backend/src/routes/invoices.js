import { Router } from 'express';
import db from '../db/index.js';
import { broadcast } from '../websocket/hub.js';
import { logActivity } from '../services/activity.js';

const router = Router();

const STATUSES = ['draft', 'sent', 'paid', 'overdue', 'void'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Compute subtotal / tax / total for an invoice from its items + tax rate. */
function totals(items, taxRate = 0) {
  const subtotal = round2(items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0));
  const tax = round2((subtotal * (Number(taxRate) || 0)) / 100);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

const getItems = (invoiceId) =>
  db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position, id').all(invoiceId);

/** Generate the next sequential invoice number, e.g. INV-0007. */
function nextNumber() {
  const rows = db.prepare('SELECT number FROM invoices').all();
  let max = 0;
  for (const r of rows) {
    const m = /(\d+)\s*$/.exec(r.number || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `INV-${String(max + 1).padStart(4, '0')}`;
}

function withRelations(invoice) {
  const company = invoice.company_id ? db.prepare('SELECT id, name FROM companies WHERE id = ?').get(invoice.company_id) : null;
  const contact = invoice.contact_id ? db.prepare('SELECT id, first_name, last_name, email FROM contacts WHERE id = ?').get(invoice.contact_id) : null;
  const items = getItems(invoice.id);
  return { ...invoice, company, contact, items, ...totals(items, invoice.tax_rate) };
}

// List invoices with company name and computed total (search + status filter).
router.get('/', (req, res) => {
  const { search = '', status = '' } = req.query;
  const clauses = [];
  const params = [];
  if (search) {
    clauses.push('(i.number LIKE ? OR co.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    clauses.push('i.status = ?');
    params.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT i.*, co.name AS company_name,
              (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM invoice_items WHERE invoice_id = i.id) AS subtotal
       FROM invoices i
       LEFT JOIN companies co ON co.id = i.company_id
       ${where}
       ORDER BY i.created_at DESC`
    )
    .all(...params);

  res.json(
    rows.map((r) => {
      const subtotal = round2(r.subtotal);
      const tax = round2((subtotal * (r.tax_rate || 0)) / 100);
      return { ...r, subtotal, tax, total: round2(subtotal + tax) };
    })
  );
});

router.get('/:id', (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json(withRelations(invoice));
});

// Insert the line items for an invoice (used by create + update).
function insertItems(invoiceId, items = []) {
  const stmt = db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, position) VALUES (?, ?, ?, ?, ?)');
  items
    .filter((it) => it && (it.description || '').trim())
    .forEach((it, i) => stmt.run(invoiceId, it.description.trim(), Number(it.quantity) || 0, Number(it.unit_price) || 0, i));
}

router.post('/', (req, res) => {
  const { number, company_id, contact_id, status, issue_date, due_date, tax_rate, notes, items = [] } = req.body || {};
  const invoiceStatus = STATUSES.includes(status) ? status : 'draft';

  const result = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO invoices (number, company_id, contact_id, status, issue_date, due_date, tax_rate, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        (number && number.trim()) || nextNumber(),
        company_id || null,
        contact_id || null,
        invoiceStatus,
        issue_date || null,
        due_date || null,
        Number(tax_rate) || 0,
        notes || null
      );
    insertItems(info.lastInsertRowid, items);
    return info.lastInsertRowid;
  })();

  const invoice = withRelations(db.prepare('SELECT * FROM invoices WHERE id = ?').get(result));
  broadcast('invoice.created', invoice);
  logActivity({
    type: 'invoice.created',
    message: `Invoice ${invoice.number} was created`,
    entityType: 'invoice',
    entityId: invoice.id,
    actorId: req.user.id,
  });
  res.status(201).json(invoice);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Invoice not found' });

  const { number, company_id, contact_id, status, issue_date, due_date, tax_rate, notes, items } = req.body || {};
  const invoiceStatus = STATUSES.includes(status) ? status : existing.status;

  db.transaction(() => {
    db.prepare(
      `UPDATE invoices SET number = ?, company_id = ?, contact_id = ?, status = ?, issue_date = ?,
         due_date = ?, tax_rate = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      (number && number.trim()) || existing.number,
      company_id === undefined ? existing.company_id : company_id || null,
      contact_id === undefined ? existing.contact_id : contact_id || null,
      invoiceStatus,
      issue_date === undefined ? existing.issue_date : issue_date || null,
      due_date === undefined ? existing.due_date : due_date || null,
      tax_rate === undefined ? existing.tax_rate : Number(tax_rate) || 0,
      notes === undefined ? existing.notes : notes || null,
      req.params.id
    );
    // Replace line items wholesale when provided.
    if (Array.isArray(items)) {
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
      insertItems(req.params.id, items);
    }
  })();

  const invoice = withRelations(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id));
  broadcast('invoice.updated', invoice);
  logActivity({
    type: 'invoice.updated',
    message: `Invoice ${invoice.number} was updated`,
    entityType: 'invoice',
    entityId: invoice.id,
    actorId: req.user.id,
  });
  res.json(invoice);
});

// Quick status change (e.g. mark as sent / paid).
router.patch('/:id/status', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Invoice not found' });

  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  db.prepare("UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);
  const invoice = withRelations(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id));
  broadcast('invoice.updated', invoice);

  if (status !== existing.status) {
    logActivity({
      type: 'invoice.status_changed',
      message: `Invoice ${invoice.number} marked as ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      entityType: 'invoice',
      entityId: invoice.id,
      actorId: req.user.id,
    });
  }
  res.json(invoice);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Invoice not found' });

  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id); // cascades to items
  broadcast('invoice.deleted', { id: Number(req.params.id) });
  logActivity({
    type: 'invoice.deleted',
    message: `Invoice ${existing.number} was deleted`,
    entityType: 'invoice',
    entityId: existing.id,
    actorId: req.user.id,
  });
  res.json({ ok: true });
});

export default router;
