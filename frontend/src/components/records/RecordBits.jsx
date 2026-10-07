import { cn } from '../../utils/cn';
import {
  customerStatusMeta,
  leadStatusMeta,
  priorityMeta,
  taskStatusMeta,
  ticketStatusMeta,
} from '../../utils/constants';
import { formatCurrency, formatDueDate, formatHours } from '../../utils/formatters';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { healthTone } from '../../utils/constants';

/** Maps a record type to its status presentation. */
const STATUS_RESOLVERS = {
  lead: leadStatusMeta,
  customer: customerStatusMeta,
  task: taskStatusMeta,
  ticket: ticketStatusMeta,
};

export function StatusBadge({ type = 'task', value, className }) {
  const resolve = STATUS_RESOLVERS[type] ?? taskStatusMeta;
  const meta = resolve(value);

  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

/** Priority chip. Colour-coded and label-bearing, never colour alone. */
export function PriorityPill({ priority, className }) {
  const meta = priorityMeta(priority);

  return (
    <Badge tone={meta.tone} size="sm" className={className}>
      {meta.label}
    </Badge>
  );
}

/** Monospace record number, e.g. LD-2026-0007. */
export function Reference({ value, className }) {
  if (!value) return <span className="text-ink-subtle">—</span>;

  return (
    <span className={cn('font-mono text-2xs text-ink-subtle', className)}>{value}</span>
  );
}

/** Due date with urgency colouring derived from the record's overdue flag. */
export function DueDateChip({ value, isOverdue = false, completed = false, className }) {
  if (!value) return <span className={cn('text-2xs text-ink-subtle', className)}>No due date</span>;

  const tone = completed
    ? 'text-ink-subtle'
    : isOverdue
      ? 'text-danger-600 dark:text-danger-400 font-medium'
      : 'text-ink-subtle';

  return <span className={cn('text-2xs', tone, className)}>{formatDueDate(value)}</span>;
}

/** Owner / assignee cell with an explicit "unassigned" state. */
export function UserCell({ user, fallback = 'Unassigned', size = 'xs', showName = true, className }) {
  if (!user) {
    return <span className={cn('text-2xs text-ink-subtle italic', className)}>{fallback}</span>;
  }

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <Avatar name={user.name} size={size} />
      {showName ? <span className="truncate text-xs text-ink">{user.name}</span> : null}
    </span>
  );
}

/** Money cell that keeps the amount visually dominant. */
export function MoneyCell({ value, className, muted = false }) {
  return (
    <span
      className={cn(
        'nums text-sm',
        muted ? 'text-ink-muted' : 'font-medium text-ink',
        className,
      )}
    >
      {formatCurrency(value)}
    </span>
  );
}

/** Health score chip with a tone that matches the band. */
export function HealthChip({ score, className }) {
  const value = Number(score ?? 0);

  return (
    <Badge tone={healthTone(value)} size="sm" className={className}>
      <span className="nums">{value}</span>
      <span className="sr-only"> health score out of 100</span>
    </Badge>
  );
}

/** SLA / ageing indicator for support tickets. */
export function AgeChip({ hours, breached = false, className }) {
  return (
    <span
      className={cn(
        'nums text-2xs',
        breached ? 'font-medium text-danger-600 dark:text-danger-400' : 'text-ink-subtle',
        className,
      )}
    >
      {breached ? 'SLA breached · ' : ''}
      {formatHours(hours)}
    </span>
  );
}

/** Primary + secondary line for a record, used in list rows. */
export function RecordTitle({ primary, secondary, secondaryClassName, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="truncate text-sm font-medium text-ink">{primary}</p>
      {secondary ? (
        <p className={cn('truncate text-2xs text-ink-subtle', secondaryClassName)}>{secondary}</p>
      ) : null}
    </div>
  );
}