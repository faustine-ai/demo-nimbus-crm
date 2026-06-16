import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';

const NONE = '__none__';
const empty = {
  name: '', company_id: NONE, contact_id: NONE, value: '',
  stage_id: '', close_date: '', notes: '',
};

// `stages` is the column list for the current pipeline; `defaultStageId` is the
// column a new deal should land in (e.g. the column whose "+" was clicked).
export function DealFormDialog({ open, onOpenChange, deal, stages = [], defaultStageId, onSaved }) {
  const [form, setForm] = useState(empty);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(deal);

  useEffect(() => {
    if (!open) return;
    Promise.all([api.get('/companies'), api.get('/contacts')])
      .then(([co, ct]) => { setCompanies(co); setContacts(ct); })
      .catch(() => {});
    const firstStageId = stages[0] ? String(stages[0].id) : '';
    if (deal) {
      setForm({
        name: deal.name || '',
        company_id: deal.company_id ? String(deal.company_id) : NONE,
        contact_id: deal.contact_id ? String(deal.contact_id) : NONE,
        value: deal.value != null ? String(deal.value) : '',
        stage_id: deal.stage_id ? String(deal.stage_id) : firstStageId,
        close_date: deal.close_date || '',
        notes: deal.notes || '',
      });
    } else {
      setForm({ ...empty, stage_id: defaultStageId ? String(defaultStageId) : firstStageId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deal, defaultStageId]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Deal name is required');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      company_id: form.company_id === NONE ? null : Number(form.company_id),
      contact_id: form.contact_id === NONE ? null : Number(form.contact_id),
      value: Number(form.value) || 0,
      stage_id: form.stage_id ? Number(form.stage_id) : null,
      close_date: form.close_date || null,
      notes: form.notes,
    };
    try {
      const saved = isEdit ? await api.put(`/deals/${deal.id}`, payload) : await api.post('/deals', payload);
      toast.success(isEdit ? 'Deal updated' : 'Deal created');
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit deal' : 'New deal'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update the deal details.' : 'Add a deal to your pipeline.'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Deal name *</Label>
            <Input value={form.name} onChange={set('name')} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Value (USD)</Label>
              <Input type="number" min="0" step="100" value={form.value} onChange={set('value')} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={form.stage_id} onValueChange={(v) => setForm((f) => ({ ...f, stage_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm((f) => ({ ...f, company_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No company</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select value={form.contact_id} onValueChange={(v) => setForm((f) => ({ ...f, contact_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No contact</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.first_name} {c.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Expected close date</Label>
            <Input type="date" value={form.close_date || ''} onChange={set('close_date')} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={set('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create deal'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
