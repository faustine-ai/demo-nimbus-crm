import { useEffect, useState, useCallback } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, GripVertical } from 'lucide-react';
import { api } from '@/lib/api';
import { useRealtime } from '@/hooks/useWebSocket';
import { DEAL_STAGES } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PageLoader } from '@/components/Spinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DealFormDialog } from '@/components/forms/DealFormDialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/sonner';

function DealCard({ deal, onEdit, onDelete, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal)}
      className="group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5">
          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
          <div>
            <div className="text-sm font-medium leading-tight">{deal.name}</div>
            {deal.company_name && <div className="mt-0.5 text-xs text-muted-foreground">{deal.company_name}</div>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(deal)}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(deal)}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{formatCurrency(deal.value)}</span>
        {deal.close_date && <span className="text-xs text-muted-foreground">{formatDate(deal.close_date)}</span>}
      </div>
      {(deal.contact_first_name || deal.contact_last_name) && (
        <div className="mt-1 text-xs text-muted-foreground">{deal.contact_first_name} {deal.contact_last_name}</div>
      )}
    </div>
  );
}

export default function Deals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [defaultStage, setDefaultStage] = useState('lead');
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => api.get('/deals').then(setDeals).catch((e) => toast.error(e.message)), []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useRealtime(['deal.created', 'deal.updated', 'deal.deleted'], load);

  function onDragStart(e, deal) {
    setDragId(deal.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  async function onDrop(stage) {
    setDragOver(null);
    const deal = deals.find((d) => d.id === dragId);
    setDragId(null);
    if (!deal || deal.stage === stage) return;

    // Optimistic update, then persist.
    setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, stage } : d)));
    try {
      await api.patch(`/deals/${deal.id}/stage`, { stage });
    } catch (err) {
      toast.error(err.message);
      load();
    }
  }

  function openCreate(stage) {
    setEditing(null);
    setDefaultStage(stage || 'lead');
    setFormOpen(true);
  }

  async function confirmDelete() {
    try {
      await api.del(`/deals/${deleting.id}`);
      toast.success('Deal deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Deals" description="Drag deals across stages to update your pipeline.">
        <Button onClick={() => openCreate('lead')}><Plus className="h-4 w-4" /> New deal</Button>
      </PageHeader>

      {loading ? (
        <PageLoader />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {DEAL_STAGES.map((stage) => {
            const items = deals.filter((d) => d.stage === stage.value);
            const total = items.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
            return (
              <div
                key={stage.value}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage.value); }}
                onDragLeave={() => setDragOver((s) => (s === stage.value ? null : s))}
                onDrop={() => onDrop(stage.value)}
                className={cn(
                  'flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors',
                  dragOver === stage.value && 'border-primary bg-accent/60'
                )}
              >
                <div className="flex items-center justify-between border-b px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', stage.color)}>{stage.label}</span>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <button onClick={() => openCreate(stage.value)} className="text-muted-foreground hover:text-foreground" aria-label="Add deal">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-3 pb-1 pt-2 text-xs text-muted-foreground">{formatCurrency(total)}</div>
                <div className="flex-1 space-y-2 p-3 pt-1 min-h-[120px]">
                  {items.map((deal) => (
                    <DealCard key={deal.id} deal={deal} onEdit={(d) => { setEditing(d); setFormOpen(true); }} onDelete={setDeleting} onDragStart={onDragStart} />
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">Drop deals here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DealFormDialog open={formOpen} onOpenChange={setFormOpen} deal={editing} defaultStage={defaultStage} onSaved={load} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete deal?"
        description={deleting ? `This will permanently remove "${deleting.name}".` : ''}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
