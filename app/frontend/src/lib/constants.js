// Shared option lists and display metadata used across the app.

export const DEAL_STAGES = [
  { value: 'lead', label: 'Lead', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'qualified', label: 'Qualified', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'proposal', label: 'Proposal', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'won', label: 'Won', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'lost', label: 'Lost', color: 'bg-rose-100 text-rose-700 border-rose-200' },
];

export const CONTACT_STATUSES = [
  { value: 'lead', label: 'Lead', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'active', label: 'Active', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'customer', label: 'Customer', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'inactive', label: 'Inactive', color: 'bg-slate-100 text-slate-500 border-slate-200' },
];

export const TASK_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'high', label: 'High', color: 'bg-rose-100 text-rose-700 border-rose-200' },
];

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

export function stageMeta(value) {
  return DEAL_STAGES.find((s) => s.value === value) || DEAL_STAGES[0];
}
export function statusMeta(value) {
  return CONTACT_STATUSES.find((s) => s.value === value) || CONTACT_STATUSES[0];
}
export function priorityMeta(value) {
  return TASK_PRIORITIES.find((p) => p.value === value) || TASK_PRIORITIES[1];
}
