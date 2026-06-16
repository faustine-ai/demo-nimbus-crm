import { Badge } from '@/components/ui/badge';
import { stageMeta, statusMeta, priorityMeta } from '@/lib/constants';

// Small helpers that render a colored badge for known enum values.

export function StageBadge({ stage }) {
  const meta = stageMeta(stage);
  return <Badge className={meta.color}>{meta.label}</Badge>;
}

export function StatusBadge({ status }) {
  const meta = statusMeta(status);
  return <Badge className={meta.color}>{meta.label}</Badge>;
}

export function PriorityBadge({ priority }) {
  const meta = priorityMeta(priority);
  return <Badge className={meta.color}>{meta.label}</Badge>;
}
