import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

/** Format a number as USD currency, compact for large values. */
export function formatCurrency(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function toDate(value) {
  if (!value) return null;
  // SQLite returns "YYYY-MM-DD HH:MM:SS"; normalize to ISO for parsing.
  const iso = value.includes('T') ? value : value.replace(' ', 'T') + 'Z';
  const d = parseISO(iso);
  return isValid(d) ? d : null;
}

/** Format a date as e.g. "Jun 16, 2026". */
export function formatDate(value) {
  const d = toDate(value);
  return d ? format(d, 'MMM d, yyyy') : '—';
}

/** Relative time, e.g. "3 hours ago". */
export function formatRelative(value) {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : '';
}

/** Initials from a name or first/last pair. */
export function initials(first = '', last = '') {
  return `${(first[0] || '').toUpperCase()}${(last[0] || '').toUpperCase()}` || '?';
}
