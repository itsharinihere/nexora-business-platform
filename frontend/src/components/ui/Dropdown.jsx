import { useCallback, useRef, useState } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';

import { cn } from '../../utils/cn';
import { useClickOutside, useEscapeKey } from '../../hooks';

/**
 * Dropdown menu. Closes on outside click and Escape, supports keyboard
 * navigation, and renders either a `trigger` element or a default dot button.
 */
export function Dropdown({
  trigger,
  items = [],
  align = 'right',
  width = 'w-52',
  className,
  buttonLabel = 'Open menu',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);
  useEscapeKey(close, open);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger ? (
        <div
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setOpen((v) => !v);
            }
          }}
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={open}
          className="cursor-pointer"
        >
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={buttonLabel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-sunken hover:text-ink"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute z-40 mt-1.5 animate-slide-up overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-lg',
            width,
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, index) =>
            item.separator ? (
              <hr key={`sep-${index}`} className="my-1 border-t border-line" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onClick?.();
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition',
                  item.danger ? 'text-danger-600 dark:text-danger-400' : 'text-ink',
                  'hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {item.icon ? <item.icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" /> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.shortcut ? (
                  <kbd className="shrink-0 rounded border border-line px-1 font-mono text-2xs text-ink-subtle">
                    {item.shortcut}
                  </kbd>
                ) : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Compact `select`-style control used in filter bars. */
export function SelectMenu({ value, onChange, options = [], label, className, icon: Icon, allLabel = 'All' }) {
  const current = options.find((option) => (option.value ?? option) === value);
  const currentLabel = current ? (current.label ?? current) : allLabel;

  return (
    <Dropdown
      width="w-44"
      className={className}
      trigger={
        <span
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink transition hover:border-line-strong',
            Icon && 'pl-2',
          )}
        >
          {Icon ? <Icon className="h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" /> : null}
          {label ? <span className="text-ink-subtle">{label}</span> : null}
          <span className="max-w-24 truncate">{currentLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />
        </span>
      }
      items={[
        { label: allLabel, onClick: () => onChange('all'), icon: value === 'all' ? undefined : undefined },
        ...options.map((option) => {
          const optionValue = option.value ?? option;
          const optionLabel = option.label ?? option;
          return {
            label: optionLabel,
            onClick: () => onChange(optionValue),
          };
        }),
      ]}
    />
  );
}