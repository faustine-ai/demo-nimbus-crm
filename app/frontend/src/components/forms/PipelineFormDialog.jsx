import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';

/** Create or rename a pipeline (funnel). Pass `pipeline` to edit. */
export function PipelineFormDialog({ open, onOpenChange, pipeline, onSaved }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(pipeline);

  useEffect(() => {
    if (open) setName(pipeline?.name || '');
  }, [open, pipeline]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Pipeline name is required');
    setSaving(true);
    try {
      const saved = isEdit
        ? await api.put(`/pipelines/${pipeline.id}`, { name })
        : await api.post('/pipelines', { name });
      toast.success(isEdit ? 'Pipeline renamed' : 'Pipeline created');
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
          <DialogTitle>{isEdit ? 'Rename pipeline' : 'New pipeline'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Give this funnel a new name.' : 'A new funnel starts with a few default columns you can customize.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Onboarding" autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
