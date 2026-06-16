import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CONTACT_STATUSES } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';

const NONE = '__none__';

const empty = {
  first_name: '', last_name: '', email: '', phone: '', job_title: '',
  company_id: NONE, status: 'lead', notes: '',
};

export function ContactFormDialog({ open, onOpenChange, contact, defaultCompanyId, onSaved }) {
  const [form, setForm] = useState(empty);
  const [companies, setCompanies] = useState([]);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(contact);

  useEffect(() => {
    if (!open) return;
    api.get('/companies').then(setCompanies).catch(() => {});
    if (contact) {
      setForm({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        job_title: contact.job_title || '',
        company_id: contact.company_id ? String(contact.company_id) : NONE,
        status: contact.status || 'lead',
        notes: contact.notes || '',
      });
    } else {
      setForm({ ...empty, company_id: defaultCompanyId ? String(defaultCompanyId) : NONE });
    }
  }, [open, contact, defaultCompanyId]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error('First and last name are required');
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      company_id: form.company_id === NONE ? null : Number(form.company_id),
    };
    try {
      const saved = isEdit ? await api.put(`/contacts/${contact.id}`, payload) : await api.post('/contacts', payload);
      toast.success(isEdit ? 'Contact updated' : 'Contact created');
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
          <DialogTitle>{isEdit ? 'Edit contact' : 'New contact'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update the contact details.' : 'Add a new person to your CRM.'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>First name *</Label>
              <Input value={form.first_name} onChange={set('first_name')} required />
            </div>
            <div className="space-y-2">
              <Label>Last name *</Label>
              <Input value={form.last_name} onChange={set('last_name')} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={set('email')} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={set('phone')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Job title</Label>
            <Input value={form.job_title} onChange={set('job_title')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm((f) => ({ ...f, company_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No company</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTACT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={set('notes')} placeholder="Anything worth remembering…" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create contact'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
