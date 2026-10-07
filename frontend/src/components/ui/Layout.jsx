import { cn } from '../../utils/cn';

/** Numbered stepper used by the multi-stage record forms. */
export function Steps({ steps = [], current = 0, className }) {
  return (
    <ol className={cn('flex items-center gap-1 overflow-x-auto', className)}>
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li key={step} className="flex shrink-0 items-center gap-1">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                active && 'bg-brand-600 text-white',
                done && 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400',
                !active && !done && 'bg-sunken text-ink-subtle',
              )}
            >
              <span className="nums">{index + 1}</span>
              {step}
            </span>
            {index < steps.length - 1 ? (
              <span className={cn('h-px w-4', done ? 'bg-success-400' : 'bg-line-strong')} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Label / value row used across all detail pages. */
export function DetailRow({ label, value, icon: Icon, className, mono = false }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-1.5', className)}>
      <dt className="flex shrink-0 items-center gap-1.5 text-xs text-ink-subtle">
        {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd
        className={cn(
          'min-w-0 break-words text-right text-sm text-ink',
          mono && 'font-mono text-xs',
        )}
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}

/** Vertical key/value list with dividers. */
export function DetailList({ children, className, divided = true }) {
  return (
    <dl className={cn(divided && 'divide-y divide-line/70', className)}>{children}</dl>
  );
}

/** Vertical timeline of events. */
export function Timeline({ items = [], className, emptyLabel = 'No history yet.' }) {
  if (!items.length) {
    return <p className="py-4 text-sm text-ink-subtle">{emptyLabel}</p>;
  }

  return (
    <ol className={cn('relative space-y-0', className)}>
      {items.map((item, index) => (
        <li key={item.id ?? index} className="relative flex gap-3 pb-4 last:pb-0">
          {index < items.length - 1 ? (
            <span className="absolute left-[0.6875rem] top-6 h-full w-px bg-line" aria-hidden="true" />
          ) : null}
          <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-subtle">
            {item.icon ? (
              <item.icon className="h-3 w-3" aria-hidden="true" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug text-ink">{item.title ?? item.description}</p>
            {item.subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{item.subtitle}</p> : null}
            {item.timestamp ? (
              <p className="mt-0.5 text-2xs text-ink-subtle">{item.timestamp}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Two-column responsive form grid. */
export function FormGrid({ children, className, columns = 2 }) {
  return (
    <div
      className={cn('grid gap-4', columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-3' : '', className)}
    >
      {children}
    </div>
  );
}

/** Full-width field inside a `FormGrid`. */
export function FormRow({ children, className }) {
  return <div className={cn('sm:col-span-2', className)}>{children}</div>;
}

/** Section heading inside a long form. */
export function FormSection({ title, description, children, className }) {
  return (
    <section className={cn('space-y-3', className)}>
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}