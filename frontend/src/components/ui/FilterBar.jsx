import { Search, X } from 'lucide-react';

import { cn } from '../../utils/cn';

/**
 * Search + filter row used above every list page.
 *
 * Search is debounced by the caller (`useDebounce`) so typing does not fire a
 * request per keystroke.
 */
export function FilterBar({ search, onSearchChange, searchPlaceholder = 'Search…', children, className }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-8 text-sm text-ink transition-colors placeholder:text-ink-subtle hover:border-line-strong focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-subtle transition hover:text-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

/**
 * Pill-style status filter backed by the counts the API returns alongside the
 * list, so the counts always match the current data.
 */
export function StatusTabs({ value, onChange, counts = {}, options = [], className, allLabel = 'All' }) {
  const total = counts.all ?? 0;

  return (
    <div className={cn('nx-scroll-none -mx-1 flex gap-1 overflow-x-auto px-1', className)} role="tablist">
      <TabButton active={value === 'all'} onClick={() => onChange('all')} count={total}>
        {allLabel}
      </TabButton>
      {options.map((option) => {
        const optionValue = option.value ?? option;
        const optionLabel = option.label ?? option;
        return (
          <TabButton
            key={optionValue}
            active={value === optionValue}
            onClick={() => onChange(optionValue)}
            count={counts[optionValue]}
          >
            {optionLabel}
          </TabButton>
        );
      })}
    </div>
  );
}

function TabButton({ active, onClick, count, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-brand-600 text-white shadow-xs'
          : 'bg-sunken text-ink-muted hover:bg-line/50 hover:text-ink',
      )}
    >
      {children}
      {count !== undefined && count !== null ? (
        <span className={cn('nums text-2xs', active ? 'text-white/70' : 'text-ink-subtle')}>{count}</span>
      ) : null}
    </button>
  );
}

/** Two-to-four option segmented control used for range and view switching. */
export function SegmentedControl({ value, onChange, options = [], className, size = 'md' }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-line bg-sunken p-0.5',
        className,
      )}
      role="group"
    >
      {options.map((option) => {
        const optionValue = option.value ?? option;
        const optionLabel = option.label ?? option;
        const active = value === optionValue;

        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            aria-pressed={active}
            className={cn(
              'rounded-[0.3rem] font-medium transition-colors',
              size === 'sm' ? 'px-2 py-1 text-2xs' : 'px-2.5 py-1 text-xs',
              active ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink',
            )}
          >
            {optionLabel}
          </button>
        );
      })}
    </div>
  );
}

/** Compact filter control sized to sit inside a `FilterBar`. */
export function FilterField({ children, className }) {
  return <div className={cn('w-full sm:w-40', className)}>{children}</div>;
}