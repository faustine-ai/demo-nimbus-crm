import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TASK_PRIORITIES } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';

const NONE = '__none__';
const empty = { title: '', description: '', due_date: '', priority: 'medium', entity_type: NONE, entity_id: NONE };

const ENTITY_TYPES = [
  { value: 'contact', label: 'Contact', path: '/contacts' },
  { value: 'company', label: 'Company', path: '/companies' },
  { value: 'deal', label: 'Deal', path: '/deals' },
];

export function TaskFormDialog({ open, onOpenChange, task, link, onSaved }) {
  const [form, setForm] = useState(empty);
  const [options, setOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(task);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        due_date: task.due_date || '',
        priority: task.priority || 'medium',
        entity_type: task.entity_type || NONE,
        entity_id: task.entity_id ? String(task.entity_id) : NONE,
      });
    } else if (link) {
      // Pre-link the task to a specific entity (from a detail page).
      setForm({ ...empty, entity_type: link.type, entity_id: String(link.id) });
    } else {
      setForm(empty);
    }
  }, [open, task, link]);

  // Load the option list for the selected entity type.
  useEffect(() => {
    if (!open || form.entity_type === NONE) {
      setOptions([]);
      return;
    }
    const meta = ENTITY_TYPES.find((t) => t.value === form.entity_type);
    if (!meta) return;
    api.get(meta.path).then((rows) => {
      setOptions(
        rows.map((r) => ({
          id: r.id,
          label: form.entity_type === 'contact' ? `${r.first_name} ${r.last_name}` : r.name,
        }))
      );
    }).catch(() => {});
  }, [open, form.entity_type]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description,
      due_date: form.due_date || null,
      priority: form.priority,
      entity_type: form.entity_type === NONE ? null : form.entity_type,
      entity_id: form.entity_id === NONE ? null : Number(form.entity_id),
    };
    try {
      const saved = isEdit ? await api.put(`/tasks/${task.id}`, payload) : await api.post('/tasks', payload);
      toast.success(isEdit ? 'Task updated' : 'Task created');
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
          <DialogTitle>{isEdit ? 'Edit task' : 'New task'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update the task.' : 'Create a task and optionally link it to a record.'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={set('title')} required />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={set('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={form.due_date || ''} onChange={set('due_date')} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Related to</Label>
              <Select
                value={form.entity_type}
                onValueChange={(v) => setForm((f) => ({ ...f, entity_type: v, entity_id: NONE }))}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nothing</SelectItem>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Record</Label>
              <Select
                value={form.entity_id}
                onValueChange={(v) => setForm((f) => ({ ...f, entity_id: v }))}
                disabled={form.entity_type === NONE}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
