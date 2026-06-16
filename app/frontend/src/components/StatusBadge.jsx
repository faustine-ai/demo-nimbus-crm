import { Badge } from '@/components/ui/badge';
import { stageTypeMeta, statusMeta, priorityMeta, invoiceStatusMeta } from '@/lib/constants';

// Small helpers that render a colored badge for known enum values.

// Stage labels come from custom pipelines; color is derived from the stage type.
export function StageBadge({ stage, type }) {
  const meta = stageTypeMeta(type);
  return <Badge className={meta.color}>{stage || meta.label}</Badge>;
}

export function StatusBadge({ status }) {
  const meta = statusMeta(status);
  return <Badge className={meta.color}>{meta.label}</Badge>;
}

export function PriorityBadge({ priority }) {
  const meta = priorityMeta(priority);
  return <Badge className={meta.color}>{meta.label}</Badge>;
}

export function InvoiceStatusBadge({ status }) {
  const meta = invoiceStatusMeta(status);
  return <Badge className={meta.color}>{meta.label}</Badge>;
}
