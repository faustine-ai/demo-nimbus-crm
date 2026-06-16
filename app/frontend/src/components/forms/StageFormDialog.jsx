import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { STAGE_TYPES } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';

/**
 * Add a column to `pipelineId`, or edit an existing `stage`.
 * The stage `type` (open/won/lost) drives win/loss reporting.
 */
export function StageFormDialog({ open, onOpenChange, pipelineId, stage, onSaved }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('open');
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(stage);

  useEffect(() => {
    if (!open) return;
    setName(stage?.name || '');
    setType(stage?.type || 'open');
  }, [open, stage]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Column name is required');
    setSaving(true);
    try {
      const saved = isEdit
        ? await api.put(`/stages/${stage.id}`, { name, type })
        : await api.post(`/pipelines/${pipelineId}/stages`, { name, type });
      toast.success(isEdit ? 'Column updated' : 'Column added');
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit column' : 'Add column'}</DialogTitle>
          <DialogDescription>Columns of type Won / Lost are used for win-rate reporting.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Demo scheduled" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save' : 'Add column'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
