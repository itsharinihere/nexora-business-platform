/**
 * Client-side presentation metadata.
 *
 * Values here mirror the backend vocabularies in `app/constants.py`. The API
 * is still the authority (it returns 400 on an unknown value); this map only
 * controls how a known value looks and reads.
 */

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
export const LEAD_PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const LEAD_SOURCES = [
  'website',
  'referral',
  'linkedin',
  'cold_call',
  'email_campaign',
  'event',
  'partner',
  'social_media',
];
export const CUSTOMER_STATUSES = ['active', 'onboarding', 'at_risk', 'churned'];
export const CUSTOMER_INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Retail',
  'Manufacturing',
  'Education',
  'Logistics',
  'Real Estate',
  'Media',
  'Hospitality',
];
export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'completed'];
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const TICKET_STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
export const TICKET_CATEGORIES = [
  'technical',
  'billing',
  'account',
  'integration',
  'training',
  'bug',
  'feature_request',
];
export const USER_STATUSES = ['active', 'invited', 'inactive'];
export const ROLES = ['admin', 'manager', 'employee'];

export const ANALYTICS_RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
];

/** Tones map onto a consistent semantic colour set in both themes. */
export const TONES = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/25',
  success:
    'bg-success-50 text-success-700 ring-success-600/20 dark:bg-success-500/10 dark:text-success-400 dark:ring-success-400/25',
  warning:
    'bg-warning-50 text-warning-700 ring-warning-600/20 dark:bg-warning-500/10 dark:text-warning-400 dark:ring-warning-400/25',
  danger:
    'bg-danger-50 text-danger-700 ring-danger-600/20 dark:bg-danger-500/10 dark:text-danger-400 dark:ring-danger-400/25',
  info: 'bg-info-50 text-info-700 ring-info-600/20 dark:bg-info-500/10 dark:text-info-400 dark:ring-info-400/25',
  neutral:
    'bg-sunken text-ink-muted ring-line-strong/40 dark:bg-white/5 dark:text-ink-muted dark:ring-white/10',
};

/** Solid dot colours for charts and legends. */
export const DOT_TONES = {
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  neutral: 'bg-ink-subtle',
};

/** CSS custom-property strings for Recharts (SVG cannot use Tailwind classes). */
export const CHART_COLORS = {
  brand: 'rgb(var(--nx-brand))',
  brandSoft: 'rgb(129 140 248)',
  success: 'rgb(16 185 129)',
  warning: 'rgb(245 158 11)',
  danger: 'rgb(239 68 68)',
  info: 'rgb(59 130 246)',
  neutral: 'rgb(148 163 184)',
  grid: 'rgb(var(--nx-chart-grid))',
  text: 'rgb(var(--nx-ink-subtle))',
  tooltipBg: 'rgb(var(--nx-surface))',
};

export const CHART_PALETTE = [
  CHART_COLORS.brand,
  CHART_COLORS.info,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
  CHART_COLORS.neutral,
];

const titleCase = (value) =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const LEAD_STATUS_META = {
  new: { label: 'New', tone: 'info' },
  contacted: { label: 'Contacted', tone: 'brand' },
  qualified: { label: 'Qualified', tone: 'brand' },
  proposal: { label: 'Proposal', tone: 'warning' },
  won: { label: 'Won', tone: 'success' },
  lost: { label: 'Lost', tone: 'danger' },
};

const CUSTOMER_STATUS_META = {
  active: { label: 'Active', tone: 'success' },
  onboarding: { label: 'Onboarding', tone: 'info' },
  at_risk: { label: 'At risk', tone: 'danger' },
  churned: { label: 'Churned', tone: 'neutral' },
};

const TASK_STATUS_META = {
  todo: { label: 'To do', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'brand' },
  review: { label: 'In review', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
};

const TICKET_STATUS_META = {
  open: { label: 'Open', tone: 'danger' },
  in_progress: { label: 'In progress', tone: 'brand' },
  waiting: { label: 'Waiting', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};

const PRIORITY_META = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warning' },
  critical: { label: 'Critical', tone: 'danger' },
};

const USER_STATUS_META = {
  active: { label: 'Active', tone: 'success' },
  invited: { label: 'Invited', tone: 'info' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};

const ROLE_META = {
  admin: { label: 'Admin', tone: 'brand' },
  manager: { label: 'Manager', tone: 'info' },
  employee: { label: 'Employee', tone: 'neutral' },
};

const SEVERITY_META = {
  critical: { label: 'Critical', tone: 'danger' },
  warning: { label: 'Warning', tone: 'warning' },
  info: { label: 'Info', tone: 'info' },
  success: { label: 'Positive', tone: 'success' },
};

const NOTIFICATION_META = {
  task_reminder: { label: 'Task reminder', tone: 'warning', icon: 'check' },
  new_lead: { label: 'New lead', tone: 'brand', icon: 'lead' },
  support_ticket: { label: 'Support', tone: 'info', icon: 'ticket' },
  assignment: { label: 'Assignment', tone: 'brand', icon: 'assign' },
  system: { label: 'System', tone: 'neutral', icon: 'system' },
};

export const leadStatusMeta = (v) => LEAD_STATUS_META[v] ?? { label: titleCase(v), tone: 'neutral' };
export const customerStatusMeta = (v) => CUSTOMER_STATUS_META[v] ?? { label: titleCase(v), tone: 'neutral' };
export const taskStatusMeta = (v) => TASK_STATUS_META[v] ?? { label: titleCase(v), tone: 'neutral' };
export const ticketStatusMeta = (v) => TICKET_STATUS_META[v] ?? { label: titleCase(v), tone: 'neutral' };
export const priorityMeta = (v) => PRIORITY_META[v] ?? { label: titleCase(v), tone: 'neutral' };
export const userStatusMeta = (v) => USER_STATUS_META[v] ?? { label: titleCase(v), tone: 'neutral' };
export const roleMeta = (v) => ROLE_META[v] ?? { label: titleCase(v), tone: 'neutral' };
export const severityMeta = (v) => SEVERITY_META[v] ?? { label: titleCase(v), tone: 'neutral' };
export const notificationMeta = (v) => NOTIFICATION_META[v] ?? { label: 'Notice', tone: 'neutral', icon: 'system' };

export const sourceLabel = (v) => titleCase(v);
export const categoryLabel = (v) => titleCase(v);
export const roleLabel = (v) => ROLE_META[v]?.label ?? titleCase(v);

/** Health score (0-100) to a semantic tone. */
export function healthTone(score) {
  if (score >= 75) return 'success';
  if (score >= 60) return 'info';
  if (score >= 40) return 'warning';
  return 'danger';
}

/** Workload score to a tone, used by the Team page indicators. */
export function workloadTone(score) {
  if (score >= 12) return 'danger';
  if (score >= 7) return 'warning';
  if (score > 0) return 'success';
  return 'neutral';
}