import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { INVOICE_STATUSES } from '@/lib/constants';
import { formatCurrency } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';

const NONE = '__none__';
const blankItem = () => ({ description: '', quantity: 1, unit_price: 0 });

export function InvoiceFormDialog({ open, onOpenChange, invoice, onSaved }) {
  const [form, setForm] = useState({
    number: '', company_id: NONE, contact_id: NONE, status: 'draft',
    issue_date: '', due_date: '', tax_rate: '0', notes: '',
  });
  const [items, setItems] = useState([blankItem()]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(invoice);

  useEffect(() => {
    if (!open) return;
    Promise.all([api.get('/companies'), api.get('/contacts')])
      .then(([co, ct]) => { setCompanies(co); setContacts(ct); })
      .catch(() => {});
    if (invoice) {
      setForm({
        number: invoice.number || '',
        company_id: invoice.company_id ? String(invoice.company_id) : NONE,
        contact_id: invoice.contact_id ? String(invoice.contact_id) : NONE,
        status: invoice.status || 'draft',
        issue_date: invoice.issue_date || '',
        due_date: invoice.due_date || '',
        tax_rate: invoice.tax_rate != null ? String(invoice.tax_rate) : '0',
        notes: invoice.notes || '',
      });
      setItems(invoice.items?.length ? invoice.items.map((it) => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price })) : [blankItem()]);
    } else {
      setForm({ number: '', company_id: NONE, contact_id: NONE, status: 'draft', issue_date: '', due_date: '', tax_rate: '0', notes: '' });
      setItems([blankItem()]);
    }
  }, [open, invoice]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setItem = (i, key, value) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  const addItem = () => setItems((arr) => [...arr, blankItem()]);
  const removeItem = (i) => setItems((arr) => arr.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const tax = (subtotal * (Number(form.tax_rate) || 0)) / 100;
  const total = subtotal + tax;

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanItems = items.filter((it) => it.description.trim());
    if (!cleanItems.length) {
      toast.error('Add at least one line item');
      return;
    }
    setSaving(true);
    const payload = {
      number: form.number.trim() || undefined,
      company_id: form.company_id === NONE ? null : Number(form.company_id),
      contact_id: form.contact_id === NONE ? null : Number(form.contact_id),
      status: form.status,
      issue_date: form.issue_date || null,
      due_date: form.due_date || null,
      tax_rate: Number(form.tax_rate) || 0,
      notes: form.notes,
      items: cleanItems.map((it) => ({ description: it.description, quantity: Number(it.quantity) || 0, unit_price: Number(it.unit_price) || 0 })),
    };
    try {
      const saved = isEdit ? await api.put(`/invoices/${invoice.id}`, payload) : await api.post('/invoices', payload);
      toast.success(isEdit ? 'Invoice updated' : 'Invoice created');
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${invoice.number}` : 'New invoice'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update the invoice details and line items.' : 'Create an invoice with line items. The number is generated automatically.'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>Number</Label>
              <Input value={form.number} onChange={set('number')} placeholder="Auto" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVOICE_STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Issue date</Label>
              <Input type="date" value={form.issue_date || ''} onChange={set('issue_date')} />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={form.due_date || ''} onChange={set('due_date')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm((f) => ({ ...f, company_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No company</SelectItem>
                  {companies.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select value={form.contact_id} onValueChange={(v) => setForm((f) => ({ ...f, contact_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No contact</SelectItem>
                  {contacts.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.first_name} {c.last_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <Label>Line items</Label>
            <div className="space-y-2">
              <div className="hidden grid-cols-12 gap-2 px-1 text-xs text-muted-foreground sm:grid">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-3 text-right">Unit price</div>
                <div className="col-span-1" />
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-12 sm:col-span-6" placeholder="Description" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                  <Input className="col-span-4 sm:col-span-2 text-right" type="number" min="0" step="1" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
                  <Input className="col-span-6 sm:col-span-3 text-right" type="number" min="0" step="0.01" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} />
                  <button type="button" onClick={() => removeItem(i)} className="col-span-2 sm:col-span-1 flex items-center justify-center text-muted-foreground hover:text-destructive" aria-label="Remove line">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4" /> Add line</Button>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-56 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  Tax
                  <Input className="h-6 w-14 px-1 text-right text-xs" type="number" min="0" step="0.1" value={form.tax_rate} onChange={set('tax_rate')} />%
                </span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold text-foreground"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={set('notes')} placeholder="Payment terms, PO number, etc." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create invoice'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
