import { Link } from 'react-router-dom';

import { cn } from '../../utils/cn';

/** Wordmark used in the sidebar, topbar and public pages. */
export function Logo({ size = 'md', to = '/app/dashboard', className, showWordmark = true }) {
  const markSize = size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const textSize = size === 'lg' ? 'text-xl' : 'text-base';

  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-600 font-bold text-white shadow-xs',
          markSize,
        )}
        aria-hidden="true"
      >
        N
      </span>
      {showWordmark ? (
        <span className={cn('font-semibold tracking-tight text-ink', textSize)}>NEXORA</span>
      ) : null}
    </span>
  );

  if (!to) return content;

  return (
    <Link to={to} className="rounded-lg focus-visible:ring-2 focus-visible:ring-brand-500/50">
      {content}
    </Link>
  );
}