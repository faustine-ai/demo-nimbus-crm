import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { COMPANY_SIZES } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';

const NONE = '__none__';
const empty = { name: '', website: '', industry: '', size: NONE, location: '', notes: '' };

export function CompanyFormDialog({ open, onOpenChange, company, onSaved }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(company);

  useEffect(() => {
    if (!open) return;
    if (company) {
      setForm({
        name: company.name || '',
        website: company.website || '',
        industry: company.industry || '',
        size: company.size || NONE,
        location: company.location || '',
        notes: company.notes || '',
      });
    } else {
      setForm(empty);
    }
  }, [open, company]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    setSaving(true);
    const payload = { ...form, size: form.size === NONE ? null : form.size };
    try {
      const saved = isEdit ? await api.put(`/companies/${company.id}`, payload) : await api.post('/companies', payload);
      toast.success(isEdit ? 'Company updated' : 'Company created');
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
          <DialogTitle>{isEdit ? 'Edit company' : 'New company'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update the company details.' : 'Add a company to your CRM.'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={set('name')} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website} onChange={set('website')} placeholder="https://…" />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={form.industry} onChange={set('industry')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Size</Label>
              <Select value={form.size} onValueChange={(v) => setForm((f) => ({ ...f, size: v }))}>
                <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unspecified</SelectItem>
                  {COMPANY_SIZES.map((s) => (
                    <SelectItem key={s} value={s}>{s} employees</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={set('location')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={set('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create company'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
