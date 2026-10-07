import { cn } from '../../utils/cn';

/** Determinate progress bar. `value` is a percentage. */
export function ProgressBar({ value = 0, tone = 'brand', className, showLabel = false, size = 'md' }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));

  const tones = {
    brand: 'bg-brand-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
    info: 'bg-info-500',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn('flex-1 overflow-hidden rounded-full bg-sunken', size === 'sm' ? 'h-1' : 'h-1.5')}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', tones[tone] ?? tones.brand)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel ? <span className="nums shrink-0 text-xs font-medium text-ink-muted">{Math.round(pct)}%</span> : null}
    </div>
  );
}

/** Health-score ring used on customer rows and detail headers. */
export function ScoreRing({ score = 0, size = 56, tone = 'brand', label, className }) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;

  const tones = {
    brand: 'stroke-brand-500',
    success: 'stroke-success-500',
    warning: 'stroke-warning-500',
    danger: 'stroke-danger-500',
    info: 'stroke-info-500',
  };

  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-sunken"
          strokeWidth="5"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={cn(tones[tone] ?? tones.brand, 'transition-[stroke-dashoffset] duration-700')}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (pct / 100) * circumference}
        />
      </svg>
      <span className="nums absolute text-sm font-semibold text-ink">{Math.round(pct)}</span>
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}

/**
 * Horizontal proportion bar (e.g. funnel stages, source mix). `segments` is a
 * list of `{ value, tone }`.
 */
export function StackedBar({ segments = [], className, height = 'h-2' }) {
  const total = segments.reduce((sum, segment) => sum + (Number(segment.value) || 0), 0);

  if (!total) {
    return <div className={cn('rounded-full bg-sunken', height, className)} />;
  }

  const tones = {
    brand: 'bg-brand-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
    info: 'bg-info-500',
    neutral: 'bg-ink-subtle',
  };

  return (
    <div className={cn('flex w-full overflow-hidden rounded-full bg-sunken', height, className)}>
      {segments.map((segment, index) => (
        <div
          key={index}
          className={cn('h-full transition-[width] duration-500', tones[segment.tone] ?? tones.brand)}
          style={{ width: `${((Number(segment.value) || 0) / total) * 100}%` }}
          title={`${segment.label ?? ''}: ${segment.value}`}
        />
      ))}
    </div>
  );
}

/** Simple two-tone sparkline-ish bar strip for tiny inline charts. */
export function MiniBars({ values = [], tone = 'brand', className, height = 32 }) {
  const max = Math.max(...values.map((v) => Number(v) || 0), 1);
  const tones = { brand: 'bg-brand-500/70', success: 'bg-success-500/70', warning: 'bg-warning-500/70', danger: 'bg-danger-500/70', info: 'bg-info-500/70' };

  return (
    <div className={cn('flex items-end gap-0.5', className)} style={{ height }} aria-hidden="true">
      {values.map((value, index) => (
        <div
          key={index}
          className={cn('flex-1 rounded-sm', tones[tone] ?? tones.brand)}
          style={{ height: `${((Number(value) || 0) / max) * 100}%` }}
        />
      ))}
    </div>
  );
}