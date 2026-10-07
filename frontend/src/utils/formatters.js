/** Display formatters. All currency in this app is INR. */

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const currencyCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat('en-IN');

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });

/** `null`/`undefined` become an em dash rather than "NaN". */
function safe(value, formatter, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return formatter.format(date);
}

export const formatCurrency = (value) =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? '—'
    : currency.format(Number(value));

export const formatCompactCurrency = (value) => {
  const n = Number(value ?? 0);
  if (!n) return '—';
  return currencyCompact.format(n);
};

export const formatNumber = (value) =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? '—' : number.format(Number(value));

export const formatCompactNumber = (value) => {
  const n = Number(value ?? 0);
  if (!n) return '0';
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
};

export const formatPercent = (value, digits = 1) =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? '—'
    : `${Number(value).toFixed(digits)}%`;

export const formatDate = (value) => safe(value, dateFmt);
export const formatDateTime = (value) => safe(value, dateTimeFmt);
export const formatTime = (value) => safe(value, timeFmt);
export const formatWeekday = (value) => safe(value, weekdayFmt);

/** "3 hours ago", "in 2 days" — tuned for a dense activity feed. */
export function formatRelative(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const units = [
    { limit: 45_000, div: 1000, unit: 'second' },
    { limit: 3_600_000, div: 60_000, unit: 'minute' },
    { limit: 86_400_000, div: 3_600_000, unit: 'hour' },
    { limit: 604_800_000, div: 86_400_000, unit: 'day' },
    { limit: 2_629_800_000, div: 604_800_000, unit: 'week' },
    { limit: 31_557_600_000, div: 2_629_800_000, unit: 'month' },
    { limit: Infinity, div: 31_557_600_000, unit: 'year' },
  ];
  const match = units.find((u) => abs < u.limit) ?? units.at(-1);
  const amount = Math.round(diffMs / match.div);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return formatter.format(amount, match.unit);
}

/** "Today", "Tomorrow", "Yesterday" or a date — used on due-date chips. */
export function formatDueDate(value) {
  if (!value) return 'No due date';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'No due date';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target - today) / 86_400_000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days <= 6) return `In ${days} days`;
  if (days < -1 && days >= -6) return `${Math.abs(days)} days ago`;
  return dateFmt.format(date);
}

export function formatHours(value) {
  const n = Number(value ?? 0);
  if (!n) return '—';
  if (n < 1) return `${Math.round(n * 60)}m`;
  if (n < 48) return `${n.toFixed(n < 10 ? 1 : 0)}h`;
  return `${Math.round(n / 24)}d`;
}

/** Splits "Priya Nair" into initials for an avatar fallback. */
export function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts.at(-1)[0]).toUpperCase();
}

/** Stable pseudo-random index so a given name always gets the same hue. */
export function colorIndexFor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

export { number as formatInteger };