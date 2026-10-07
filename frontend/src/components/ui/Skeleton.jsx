import { cn } from '../../utils/cn';

/**
 * Placeholder shown while data loads. Mirrors the shape of the real content so
 * the layout does not jump when data arrives.
 */
export function Skeleton({ className }) {
  return <div className={cn('nx-skeleton', className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className, lines = 3 }) {
  return (
    <div className={cn('nx-card p-4 sm:p-5', className)}>
      <Skeleton className="h-4 w-1/3" />
      <SkeletonText lines={lines} className="mt-3" />
    </div>
  );
}

export function SkeletonStat({ className }) {
  return (
    <div className={cn('nx-card p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-7 w-28" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

export function SkeletonTable({ rows = 6, columns = 5 }) {
  return (
    <div className="nx-card overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="divide-y divide-line/70">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            {Array.from({ length: Math.max(columns - 2, 0) }).map((__, colIndex) => (
              <Skeleton key={colIndex} className="hidden h-5 w-16 shrink-0 rounded-full sm:block" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonBoard({ columns = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: columns }).map((_, columnIndex) => (
        <div key={columnIndex} className="nx-panel p-3">
          <Skeleton className="h-3 w-24" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 3 }).map((__, cardIndex) => (
              <div key={cardIndex} className="nx-card space-y-2 p-3">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
