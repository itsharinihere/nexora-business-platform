import { cn } from '../../utils/cn';
import { Skeleton } from './Skeleton';
import { EmptyState, ErrorState } from './StateBlock';

/** True when a click targets an interactive control rather than the row itself. */
function isInteractiveTarget(target) {
  return Boolean(target?.closest?.('button, a, input, select, textarea, [role="button"], [data-nav-skip]'));
}

/**
 * Responsive data table.
 *
 * Below `md` each row collapses into a stacked card using the `mobile` renderer,
 * because a horizontally scrolling table is unusable on a 320px screen.
 */
export function DataTable({
  columns = [],
  rows = [],
  keyField = 'id',
  loading = false,
  error = null,
  onRetry,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyAction,
  onRowClick,
  rowHighlight = null,
  className,
  cardClassName,
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} className={className} />;

  if (loading) {
    return (
      <div className={cn('nx-card divide-y divide-line/70', className)}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-3 w-1/4" />
            <div className="flex-1" />
            <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} className={className} />;
  }

  return (
    <>
      {/* Desktop / tablet */}
      <div className={cn('nx-card hidden overflow-hidden md:block', className)}>
        <div className="nx-scroll overflow-x-auto">
          <table className="nx-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn('nx-th', column.align === 'right' && 'text-right', column.className)}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row[keyField] ?? row.reference}
                  onClick={
                    onRowClick
                      ? (event) => {
                          if (isInteractiveTarget(event.target)) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key !== 'Enter' || isInteractiveTarget(event.target)) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-sunken/70',
                    rowHighlight?.(row) && 'bg-brand-50/60 dark:bg-brand-500/5',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('nx-td', column.align === 'right' && 'text-right', column.cellClassName)}
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className={cn('space-y-2.5 md:hidden', cardClassName)}>
        {rows.map((row) => (
          <div
            key={row[keyField] ?? row.reference}
            role="button"
            tabIndex={onRowClick ? 0 : undefined}
            aria-label={onRowClick ? 'Open record' : undefined}
            onClick={
              onRowClick
                ? (event) => {
                    if (isInteractiveTarget(event.target)) return;
                    onRowClick(row);
                  }
                : undefined
            }
            onKeyDown={
              onRowClick
                ? (event) => {
                    if (event.key !== 'Enter' || isInteractiveTarget(event.target)) return;
                    onRowClick(row);
                  }
                : undefined
            }
            className={cn('nx-card nx-card-hover w-full p-3.5 text-left', className)}
          >
            <div className="space-y-2">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.key} className="flex items-start justify-between gap-3">
                    {column.mobileLabel !== undefined ? (
                      <span className="shrink-0 text-xs text-ink-subtle">{column.mobileLabel}</span>
                    ) : null}
                    <div
                      className={cn(
                        'min-w-0 flex-1 text-right',
                        column.primary && 'text-sm font-semibold text-ink',
                        !column.primary && 'text-sm text-ink-muted',
                      )}
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}