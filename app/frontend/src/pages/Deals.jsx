import { useEffect, useState, useCallback } from 'react';
import { Plus, MoreHorizontal, MoreVertical, Pencil, Trash2, GripVertical } from 'lucide-react';
import { api } from '@/lib/api';
import { useRealtime } from '@/hooks/useWebSocket';
import { stageTypeMeta } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PageLoader } from '@/components/Spinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DealFormDialog } from '@/components/forms/DealFormDialog';
import { PipelineFormDialog } from '@/components/forms/PipelineFormDialog';
import { StageFormDialog } from '@/components/forms/StageFormDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/sonner';

const STORAGE_KEY = 'crm_pipeline';

function DealCard({ deal, onEdit, onDelete, onDragStart, onDragEnd }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal)}
      onDragEnd={onDragEnd}
      className="group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-tight">{deal.name}</div>
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
      {deal.company_name && <div className="mt-0.5 text-xs text-muted-foreground">{deal.company_name}</div>}
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
  const [pipelines, setPipelines] = useState([]);
  const [selectedId, setSelectedId] = useState(() => Number(localStorage.getItem(STORAGE_KEY)) || null);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Drag state: { type: 'card' | 'col', id }.
  const [drag, setDrag] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // Dialog state.
  const [dealForm, setDealForm] = useState({ open: false, deal: null, stageId: null });
  const [pipelineForm, setPipelineForm] = useState({ open: false, pipeline: null });
  const [stageForm, setStageForm] = useState({ open: false, stage: null });
  const [deletingDeal, setDeletingDeal] = useState(null);
  const [deletingStage, setDeletingStage] = useState(null);
  const [deletingPipeline, setDeletingPipeline] = useState(false);

  const selectedPipeline = pipelines.find((p) => p.id === selectedId) || null;
  const stages = selectedPipeline?.stages || [];

  const loadPipelines = useCallback(async () => {
    const data = await api.get('/pipelines');
    setPipelines(data);
    setSelectedId((prev) => {
      if (prev && data.some((p) => p.id === prev)) return prev;
      const stored = Number(localStorage.getItem(STORAGE_KEY));
      if (stored && data.some((p) => p.id === stored)) return stored;
      return data[0]?.id ?? null;
    });
  }, []);

  const loadDeals = useCallback(async () => {
    if (!selectedId) return;
    const data = await api.get(`/deals?pipeline_id=${selectedId}`);
    setDeals(data);
  }, [selectedId]);

  useEffect(() => {
    setLoading(true);
    loadPipelines().catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, [loadPipelines]);

  useEffect(() => {
    if (selectedId) {
      localStorage.setItem(STORAGE_KEY, String(selectedId));
      loadDeals().catch(() => {});
    }
  }, [selectedId, loadDeals]);

  useRealtime(['deal.created', 'deal.updated', 'deal.deleted'], () => loadDeals());
  useRealtime('pipeline.changed', () => { loadPipelines(); loadDeals(); });

  // --- Drag handlers ---
  function onCardDragStart(e, deal) {
    setDrag({ type: 'card', id: deal.id });
    e.dataTransfer.effectAllowed = 'move';
  }
  function onColDragStart(e, stage) {
    setDrag({ type: 'col', id: stage.id });
    e.dataTransfer.effectAllowed = 'move';
  }
  function clearDrag() {
    setDrag(null);
    setDragOver(null);
  }

  async function moveDeal(dealId, stageId) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === stageId) return;
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: stageId } : d)));
    try {
      await api.patch(`/deals/${dealId}/stage`, { stage_id: stageId });
    } catch (err) {
      toast.error(err.message);
      loadDeals();
    }
  }

  async function reorderColumns(draggedId, targetId) {
    if (draggedId === targetId) return;
    const ids = stages.map((s) => s.id);
    const from = ids.indexOf(draggedId);
    if (from < 0) return;
    ids.splice(from, 1);
    const insertAt = ids.indexOf(targetId);
    ids.splice(insertAt < 0 ? ids.length : insertAt, 0, draggedId);

    // Optimistic reorder.
    setPipelines((prev) =>
      prev.map((p) =>
        p.id === selectedId
          ? { ...p, stages: ids.map((id, i) => ({ ...p.stages.find((s) => s.id === id), position: i })) }
          : p
      )
    );
    try {
      await api.put(`/pipelines/${selectedId}/stages/reorder`, { order: ids });
    } catch (err) {
      toast.error(err.message);
      loadPipelines();
    }
  }

  function onColumnDrop(stage) {
    if (drag?.type === 'card') moveDeal(drag.id, stage.id);
    else if (drag?.type === 'col') reorderColumns(drag.id, stage.id);
    clearDrag();
  }

  async function confirmDeleteDeal() {
    try {
      await api.del(`/deals/${deletingDeal.id}`);
      toast.success('Deal deleted');
      loadDeals();
    } catch (err) { toast.error(err.message); }
  }
  async function confirmDeleteStage() {
    try {
      await api.del(`/stages/${deletingStage.id}`);
      toast.success('Column deleted');
      loadPipelines();
    } catch (err) { toast.error(err.message); }
  }
  async function confirmDeletePipeline() {
    try {
      await api.del(`/pipelines/${selectedId}`);
      toast.success('Pipeline deleted');
      setSelectedId(null);
      loadPipelines();
    } catch (err) { toast.error(err.message); }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0">
      <PageHeader title="Deals" description="Customize columns, reorder them, and switch between funnels.">
        <Select value={selectedId ? String(selectedId) : ''} onValueChange={(v) => setSelectedId(Number(v))}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Pipeline" /></SelectTrigger>
          <SelectContent>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Pipeline actions"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Pipeline</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setPipelineForm({ open: true, pipeline: null })}><Plus className="h-4 w-4" /> New funnel</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPipelineForm({ open: true, pipeline: selectedPipeline })} disabled={!selectedPipeline}>
              <Pencil className="h-4 w-4" /> Rename funnel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingPipeline(true)} disabled={!selectedPipeline}>
              <Trash2 className="h-4 w-4" /> Delete funnel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={() => setDealForm({ open: true, deal: null, stageId: stages[0]?.id ?? null })} disabled={!stages.length}>
          <Plus className="h-4 w-4" /> New deal
        </Button>
      </PageHeader>

      {loading ? (
        <PageLoader />
      ) : (
        <div className="flex flex-1 min-h-0 gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const items = deals.filter((d) => d.stage_id === stage.id);
            const total = items.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
            const meta = stageTypeMeta(stage.type);
            return (
              <div
                key={stage.id}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id); }}
                onDragLeave={() => setDragOver((s) => (s === stage.id ? null : s))}
                onDrop={() => onColumnDrop(stage)}
                className={cn(
                  'flex w-72 shrink-0 flex-col min-h-0 rounded-xl border bg-muted/40 transition-colors',
                  dragOver === stage.id && 'border-primary bg-accent/60'
                )}
              >
                <div className="flex items-center justify-between gap-1 border-b px-2 py-2.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      draggable
                      onDragStart={(e) => onColDragStart(e, stage)}
                      onDragEnd={clearDrag}
                      className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
                      title="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <span className={cn('truncate rounded-full border px-2 py-0.5 text-xs font-medium', meta.color)}>{stage.name}</span>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="flex items-center">
                    <button onClick={() => setDealForm({ open: true, deal: null, stageId: stage.id })} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Add deal">
                      <Plus className="h-4 w-4" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 text-muted-foreground hover:text-foreground" aria-label="Column actions"><MoreVertical className="h-4 w-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setStageForm({ open: true, stage })}><Pencil className="h-4 w-4" /> Edit column</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingStage(stage)}><Trash2 className="h-4 w-4" /> Delete column</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="px-3 pb-1 pt-2 text-xs text-muted-foreground">{formatCurrency(total)}</div>
                <div className="flex-1 space-y-2 overflow-y-auto p-3 pt-1 min-h-0">
                  {items.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      onEdit={(d) => setDealForm({ open: true, deal: d, stageId: d.stage_id })}
                      onDelete={setDeletingDeal}
                      onDragStart={onCardDragStart}
                      onDragEnd={clearDrag}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">Drop deals here</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add column */}
          {selectedPipeline && (
            <button
              onClick={() => setStageForm({ open: true, stage: null })}
              className="flex h-11 w-44 shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Add column
            </button>
          )}
        </div>
      )}

      <DealFormDialog
        open={dealForm.open}
        onOpenChange={(v) => setDealForm((s) => ({ ...s, open: v }))}
        deal={dealForm.deal}
        stages={stages}
        defaultStageId={dealForm.stageId}
        onSaved={loadDeals}
      />
      <PipelineFormDialog
        open={pipelineForm.open}
        onOpenChange={(v) => setPipelineForm((s) => ({ ...s, open: v }))}
        pipeline={pipelineForm.pipeline}
        onSaved={(saved) => { loadPipelines(); if (saved?.id) setSelectedId(saved.id); }}
      />
      <StageFormDialog
        open={stageForm.open}
        onOpenChange={(v) => setStageForm((s) => ({ ...s, open: v }))}
        pipelineId={selectedId}
        stage={stageForm.stage}
        onSaved={loadPipelines}
      />

      <ConfirmDialog
        open={Boolean(deletingDeal)}
        onOpenChange={(v) => !v && setDeletingDeal(null)}
        title="Delete deal?"
        description={deletingDeal ? `This will permanently remove "${deletingDeal.name}".` : ''}
        onConfirm={confirmDeleteDeal}
      />
      <ConfirmDialog
        open={Boolean(deletingStage)}
        onOpenChange={(v) => !v && setDeletingStage(null)}
        title="Delete column?"
        description={deletingStage ? `This will remove the "${deletingStage.name}" column. Columns with deals can't be deleted.` : ''}
        onConfirm={confirmDeleteStage}
      />
      <ConfirmDialog
        open={deletingPipeline}
        onOpenChange={setDeletingPipeline}
        title="Delete pipeline?"
        description={selectedPipeline ? `This will permanently remove the "${selectedPipeline.name}" pipeline and its columns.` : ''}
        onConfirm={confirmDeletePipeline}
      />
    </div>
  );
}
