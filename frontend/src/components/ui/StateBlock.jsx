import { AlertTriangle, Inbox, RefreshCw, SearchX, WifiOff } from 'lucide-react';

import { cn } from '../../utils/cn';
import { ApiError } from '../../services/api';
import { Button } from './Button';

/** Shared empty / error presentation so every page fails the same way. */
export function StateBlock({ icon: Icon = Inbox, title, description, action, tone = 'neutral', className }) {
  const tones = {
    neutral: 'bg-sunken text-ink-subtle',
    danger: 'bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400',
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center',
        className,
      )}
    >
      <span className={cn('flex h-11 w-11 items-center justify-center rounded-full', tones[tone])}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="max-w-sm">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', description, action, className }) {
  return (
    <StateBlock
      icon={Inbox}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

export function NoResultsState({ query, onClear, entity = 'results' }) {
  return (
    <StateBlock
      icon={SearchX}
      title="No matches found"
      description={
        query
          ? `Nothing matched “${query}”. Try a different search term or clear the filters.`
          : `No ${entity} match the current filters.`
      }
      action={
        onClear ? (
          <Button variant="secondary" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        ) : null
      }
    />
  );
}

/**
 * Error state. Distinguishes an offline client from a rejected request, since
 * the fix a user needs is different in each case.
 */
export function ErrorState({ error, onRetry, className, title }) {
  if (!error) return null;

  const isNetwork = error instanceof ApiError && error.isNetworkError;
  const Icon = isNetwork ? WifiOff : AlertTriangle;
  const heading = title ?? (isNetwork ? 'Cannot reach the server' : 'Something went wrong');

  return (
    <StateBlock
      icon={Icon}
      tone="danger"
      title={heading}
      description={error.message}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        ) : null
      }
      className={className}
    />
  );
}

/** Compact inline error for a form or panel. */
export function InlineError({ error, onRetry }) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-danger-500/30 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:bg-danger-500/10 dark:text-danger-400"
    >
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{error.message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          Retry
        </button>
      ) : null}
    </div>
  );
}
