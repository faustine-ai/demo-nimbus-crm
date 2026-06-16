import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useRealtime } from '@/hooks/useWebSocket';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';

/**
 * Add and list notes for a given entity.
 * `notes` is the current array; `onChange` is called with the updated array.
 *
 * Notes update in real time: when anyone adds or removes a note on this same
 * record, the WebSocket event keeps every connected client in sync.
 */
export function NotesPanel({ entityType, entityId, notes = [], onChange }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  // Only react to events for *this* record. Dedupe by id so the author who
  // already added the note optimistically doesn't see it twice.
  useRealtime(['note.created', 'note.deleted'], (msg) => {
    if (msg.type === 'note.created') {
      const note = msg.payload;
      if (note.entity_type !== entityType || Number(note.entity_id) !== Number(entityId)) return;
      if (notes.some((n) => n.id === note.id)) return;
      onChange?.([note, ...notes]);
    } else {
      const { id } = msg.payload;
      if (!notes.some((n) => n.id === id)) return;
      onChange?.(notes.filter((n) => n.id !== id));
    }
  });

  async function addNote(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      const note = await api.post('/notes', { body: body.trim(), entity_type: entityType, entity_id: entityId });
      onChange?.([note, ...notes]);
      setBody('');
      toast.success('Note added');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(id) {
    try {
      await api.del(`/notes/${id}`);
      onChange?.(notes.filter((n) => n.id !== id));
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addNote} className="space-y-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a note…" />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={saving || !body.trim()}>
            {saving ? 'Adding…' : 'Add note'}
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
        {notes.map((note) => (
          <div key={note.id} className="group rounded-lg border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
              <button
                onClick={() => removeNote(note.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                aria-label="Delete note"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{formatRelative(note.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
