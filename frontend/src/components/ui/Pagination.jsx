import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import { cn } from '../../utils/cn';
import { formatNumber } from '../../utils/formatters';
import { IconButton } from './Button';

const PAGE_SIZES = [10, 20, 50];

/**
 * Pagination bar for the list endpoints.
 *
 * `meta` is the API's `pagination` object: `{ page, per_page, total,
 * total_pages, has_next, has_prev }`.
 */
export function Pagination({ meta, onPageChange, onPageSizeChange, className }) {
  if (!meta) return null;

  const { page = 1, per_page: perPage = 20, total = 0, total_pages: totalPages = 1 } = meta;

  if (total === 0) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <p className="nums text-xs text-ink-muted">
          Showing <span className="font-medium text-ink">{from}</span>–
          <span className="font-medium text-ink">{to}</span> of{' '}
          <span className="font-medium text-ink">{formatNumber(total)}</span>
        </p>

        {onPageSizeChange ? (
          <label className="hidden items-center gap-1.5 text-xs text-ink-muted sm:flex">
            <span>Rows</span>
            <select
              value={perPage}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-7 cursor-pointer rounded-md border border-line bg-surface px-1.5 text-xs text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <IconButton
            label="First page"
            size="icon-sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Previous page"
            size="icon-sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </IconButton>

          <span className="nums px-2 text-xs text-ink-muted">
            Page {page} of {totalPages}
          </span>

          <IconButton
            label="Next page"
            size="icon-sm"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Last page"
            size="icon-sm"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
          >
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </nav>
      ) : null}
    </div>
  );
}