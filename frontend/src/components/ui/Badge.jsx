import { cn } from '../../utils/cn';

function tonesFor(tone = 'neutral') {
  return {
    brand: 'bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/25',
    success:
      'bg-success-50 text-success-700 ring-success-600/20 dark:bg-success-500/10 dark:text-success-400 dark:ring-success-400/25',
    warning:
      'bg-warning-50 text-warning-700 ring-warning-600/20 dark:bg-warning-500/10 dark:text-warning-400 dark:ring-warning-400/25',
    danger:
      'bg-danger-50 text-danger-700 ring-danger-600/20 dark:bg-danger-500/10 dark:text-danger-400 dark:ring-danger-400/25',
    info: 'bg-info-50 text-info-700 ring-info-600/20 dark:bg-info-500/10 dark:text-info-400 dark:ring-info-400/25',
    neutral:
      'bg-sunken text-ink-muted ring-line-strong/40 dark:bg-white/5 dark:text-ink-muted dark:ring-white/10',
  }[tone] ?? 'bg-sunken text-ink-muted ring-line-strong/40 dark:bg-white/5 dark:ring-white/10';
}

export function Badge({ tone = 'neutral', size = 'md', icon: Icon, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium ring-1 ring-inset',
        size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-0.5 text-xs',
        tonesFor(tone),
        className,
      )}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function Dot({ tone = 'neutral', pulse = false, className }) {
  const colours = {
    brand: 'bg-brand-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
    info: 'bg-info-500',
    neutral: 'bg-ink-subtle',
  };

  return (
    <span className={cn('relative inline-flex h-2 w-2 shrink-0', className)}>
      {pulse ? (
        <span
          className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', colours[tone])}
          aria-hidden="true"
        />
      ) : null}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', colours[tone])} aria-hidden="true" />
    </span>
  );
}

/** Small uppercase label used above grouped content. */
export function Eyebrow({ className, children }) {
  return (
    <p className={cn('text-2xs font-semibold uppercase tracking-wider text-ink-subtle', className)}>
      {children}
    </p>
  );
}

/** Heading + supporting text + optional action, used at the top of every page. */
export function PageHeader({ title, description, eyebrow, actions, className, children }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
        <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Card wrapper with an optional header slot. */
export function Card({ className, children, ...props }) {
  return (
    <div className={cn('nx-card', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className, children }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4', className)}>
      <div className="min-w-0">
        {title ? <h2 className="text-sm font-semibold text-ink">{title}</h2> : null}
        {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Divider({ className, label }) {
  if (!label) return <hr className={cn('border-t border-line', className)} />;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <hr className="flex-1 border-t border-line" />
      <span className="text-2xs font-medium uppercase tracking-wider text-ink-subtle">{label}</span>
      <hr className="flex-1 border-t border-line" />
    </div>
  );
}
