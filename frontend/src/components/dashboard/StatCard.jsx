import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { formatNumber } from '../../utils/formatters';

/**
 * Dashboard KPI tile.
 *
 * `delta` is a percentage change against the previous period; `invert` marks
 * metrics where a rise is bad (unread tickets, overdue tasks).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel = 'vs last period',
  hint,
  tone = 'brand',
  invert = false,
  to,
  loading = false,
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400',
    success: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400',
    warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400',
    danger: 'bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400',
    info: 'bg-info-50 text-info-600 dark:bg-info-500/10 dark:text-info-400',
  };

  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(Number(delta));
  const positive = hasDelta && Number(delta) > 0;
  const good = hasDelta && (invert ? Number(delta) < 0 : Number(delta) > 0);

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        {Icon ? (
          <span
            className={cn(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              tones[tone] ?? tones.brand,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="nx-skeleton h-7 w-24" />
          <div className="nx-skeleton h-3 w-16" />
        </div>
      ) : (
        <>
          <p className="nums mt-2.5 text-2xl font-semibold tracking-tight text-ink">{value}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {hasDelta ? (
              <span
                className={cn(
                  'nums text-2xs font-medium',
                  good
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-danger-600 dark:text-danger-400',
                )}
              >
                {positive ? '▲' : '▼'} {Math.abs(Number(delta))}% {deltaLabel}
              </span>
            ) : hint ? (
              <span className="text-2xs text-ink-subtle">{hint}</span>
            ) : null}
          </div>
        </>
      )}
    </>
  );

  const className =
    'nx-card nx-card-hover block p-4 sm:p-5 focus-visible:ring-2 focus-visible:ring-brand-500/50';

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

/** Compact label + value pair used inside detail panels. */
export function MiniStat({ label, value, tone = 'neutral', className, icon: Icon }) {
  const tones = {
    neutral: 'text-ink',
    brand: 'text-brand-600 dark:text-brand-400',
    success: 'text-success-600 dark:text-success-400',
    warning: 'text-warning-600 dark:text-warning-400',
    danger: 'text-danger-600 dark:text-danger-400',
    info: 'text-info-600 dark:text-info-400',
  };

  return (
    <div className={cn('min-w-0', className)}>
      <p className="flex items-center gap-1 truncate text-xs text-ink-subtle">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
        {label}
      </p>
      <p className={cn('nums mt-0.5 truncate text-base font-semibold', tones[tone] ?? tones.neutral)}>
        {value === null || value === undefined ? '—' : value}
      </p>
    </div>
  );
}

/** Row of mini stats that wraps on narrow screens. */
export function MiniStatGrid({ children, className, columns = 4 }) {
  return (
    <div
      className={cn(
        'grid gap-3',
        columns === 3 ? 'grid-cols-3' : columns === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Row in a "needs attention" list. */
export function AttentionRow({ label, value, tone = 'brand', icon: Icon, description }) {
  const tones = {
    brand: 'text-brand-600 dark:text-brand-400',
    danger: 'text-danger-600 dark:text-danger-400',
    warning: 'text-warning-600 dark:text-warning-400',
    info: 'text-info-600 dark:text-info-400',
    success: 'text-success-600 dark:text-success-400',
  };

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {Icon ? (
          <span className={cn('shrink-0', tones[tone] ?? tones.brand)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{label}</p>
          {description ? <p className="truncate text-2xs text-ink-subtle">{description}</p> : null}
        </div>
      </div>
      <span className={cn('nums shrink-0 text-sm font-semibold', tones[tone] ?? tones.brand)}>
        {formatNumber(value)}
      </span>
    </li>
  );
}