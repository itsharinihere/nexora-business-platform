import { cn } from '../../utils/cn';
import { CHART_COLORS } from '../../utils/constants';
import { formatCompactCurrency, formatNumber } from '../../utils/formatters';
import { Card } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';

/** Shared axis/grid/tooltip styling so every chart reads as one system. */
const AXIS = {
  stroke: CHART_COLORS.text,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const GRID = {
  stroke: CHART_COLORS.grid,
  strokeDasharray: '3 3',
  vertical: false,
};

export const chartAxisProps = AXIS;
export const chartGridProps = GRID;

export const currencyTick = (value) => formatCompactCurrency(value);
export const numberTick = (value) => formatNumber(value);

/** Lightweight chart tooltip used by every Recharts surface. */
export function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-line bg-surface/95 px-2.5 py-2 text-xs shadow-lg backdrop-blur-sm">
      {label !== undefined && label !== null ? (
        <p className="mb-1 font-semibold text-ink">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {payload.map((entry) => (
          <li key={entry.dataKey ?? entry.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color || entry.fill }}
              aria-hidden="true"
            />
            <span className="text-ink-muted">{entry.name}</span>
            <span className="nums ml-auto font-medium text-ink">
              {formatter ? formatter(entry.value, entry) : formatNumber(entry.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Card wrapper for a chart, including a title, optional subtitle, an action slot
 * and a skeleton state that reserves the chart's height.
 */
export function ChartCard({ title, subtitle, action, children, className, bodyClassName, loading = false, height = 260, footer }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-ink">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}

      <div className={cn('flex-1 px-2 pb-4 pt-3 sm:px-3', bodyClassName)} style={{ minHeight: loading ? height : undefined }}>
        {loading ? (
          <div className="space-y-3 p-2" style={{ height }}>
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          children
        )}
      </div>

      {footer ? <div className="border-t border-line px-4 py-2.5 sm:px-5">{footer}</div> : null}
    </Card>
  );
}

/** Legend dots rendered outside the SVG, for a consistent look. */
export function ChartLegend({ items = [], className }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Label + value block used as a chart's inline header stat. */
export function ChartStat({ label, value, delta, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="truncate text-xs text-ink-subtle">{label}</p>
      <p className="nums mt-0.5 truncate text-lg font-semibold text-ink">{value}</p>
      {delta !== undefined && delta !== null ? (
        <p
          className={cn(
            'nums mt-0.5 text-2xs font-medium',
            delta >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400',
          )}
        >
          {delta >= 0 ? '+' : ''}
          {delta}%
        </p>
      ) : null}
    </div>
  );
}