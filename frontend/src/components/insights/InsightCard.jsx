import { AlertTriangle, ArrowDownRight, ArrowUpRight, Info, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '../../utils/cn';
import { severityMeta } from '../../utils/constants';
import { formatNumber } from '../../utils/formatters';
import { Card } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/StateBlock';

const SEVERITY_ICONS = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  success: Sparkles,
};

/**
 * A single rule-based insight.
 *
 * Nothing here calls an AI service: the engine on the server compares stored
 * metrics to fixed thresholds and returns these fields.
 */
export function InsightCard({ insight, className, onAction }) {
  const meta = severityMeta(insight.severity);
  const Icon = SEVERITY_ICONS[insight.severity] ?? Info;

  const tones = {
    critical: 'border-danger-500/30 bg-danger-50/70 dark:bg-danger-500/10',
    warning: 'border-warning-500/30 bg-warning-50/70 dark:bg-warning-500/10',
    info: 'border-info-500/30 bg-info-50/70 dark:bg-info-500/10',
    success: 'border-success-500/30 bg-success-50/70 dark:bg-success-500/10',
  };

  const iconTones = {
    critical: 'bg-danger-500/15 text-danger-600 dark:text-danger-400',
    warning: 'bg-warning-500/15 text-warning-600 dark:text-warning-400',
    info: 'bg-info-500/15 text-info-600 dark:text-info-400',
    success: 'bg-success-500/15 text-success-600 dark:text-success-400',
  };

  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border p-3.5 transition hover:shadow-sm',
        tones[insight.severity] ?? tones.info,
        className,
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          iconTones[insight.severity] ?? iconTones.info,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-semibold text-ink">{insight.title}</p>
          {insight.metric_value !== null && insight.metric_value !== undefined ? (
            <span className="nums shrink-0 rounded-full bg-surface/70 px-2 py-0.5 text-2xs font-semibold text-ink-muted ring-1 ring-line">
              {formatNumber(insight.metric_value)} {insight.metric_label}
            </span>
          ) : null}
        </div>

        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{insight.message}</p>

        {insight.action ? (
          <p className="mt-1.5 text-xs text-ink-muted">
            <span className="font-medium text-ink">Recommended:</span> {insight.action}
          </p>
        ) : null}

        {insight.action_label && insight.link ? (
          onAction ? (
            <button
              type="button"
              onClick={() => onAction(insight)}
              className="mt-2 text-xs font-semibold text-brand-700 underline underline-offset-2 hover:opacity-80 dark:text-brand-300"
            >
              {insight.action_label}
            </button>
          ) : (
            <Link
              to={insight.link}
              className="mt-2 inline-block text-xs font-semibold text-brand-700 underline underline-offset-2 hover:opacity-80 dark:text-brand-300"
            >
              {insight.action_label}
            </Link>
          )
        ) : null}

        <p className="mt-2 text-2xs uppercase tracking-wide text-ink-subtle">
          {meta.label} · {insight.module}
        </p>
      </div>
    </div>
  );
}

/** Insight list grouped by severity, used on the Analytics page. */
export function InsightList({ insights = [], loading = false, className, max, onAction }) {
  if (loading) {
    return (
      <div className={cn('space-y-2.5', className)}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-line p-3.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="mt-1.5 h-3 w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  if (!insights.length) {
    return (
      <EmptyState
        title="No insights to report"
        description="Every rule is currently within its threshold. That is a good sign."
        className={className}
      />
    );
  }

  const rows = max ? insights.slice(0, max) : insights;

  return (
    <div className={cn('space-y-2.5', className)}>
      {rows.map((insight) => (
        <InsightCard key={insight.id ?? insight.type} insight={insight} onAction={onAction} />
      ))}
    </div>
  );
}

/** Compact severity counters. */
export function InsightSummary({ summary = {}, className }) {
  const items = [
    { key: 'critical', label: 'Critical', tone: 'text-danger-600 dark:text-danger-400' },
    { key: 'warning', label: 'Warning', tone: 'text-warning-600 dark:text-warning-400' },
    { key: 'info', label: 'Info', tone: 'text-info-600 dark:text-info-400' },
    { key: 'success', label: 'Positive', tone: 'text-success-600 dark:text-success-400' },
  ];

  return (
    <Card className={cn('p-4', className)}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <li key={item.key} className="min-w-0">
            <p className={cn('nums text-xl font-semibold', item.tone)}>{summary[item.key] ?? 0}</p>
            <p className="truncate text-xs text-ink-subtle">{item.label}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Delta indicator. An "up is good" default matches how most CRM metrics read;
 * pass `invert` for metrics where a rise is bad.
 */
export function DeltaBadge({ delta, invert = false, className, suffix = '%' }) {
  if (delta === null || delta === undefined) return null;

  const value = Number(delta);
  if (!Number.isFinite(value) || value === 0) {
    return <span className={cn('text-xs text-ink-subtle', className)}>No change</span>;
  }

  const positive = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        'nums inline-flex items-center gap-0.5 text-xs font-medium',
        positive ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400',
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {value > 0 ? '+' : ''}
      {value}
      {suffix}
    </span>
  );
}