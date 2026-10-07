import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '../../utils/cn';

const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/50',
  secondary:
    'border border-line bg-surface text-ink hover:bg-sunken active:bg-sunken disabled:opacity-50',
  ghost: 'text-ink-muted hover:bg-sunken hover:text-ink disabled:opacity-50',
  subtle: 'bg-sunken text-ink hover:bg-line/60 disabled:opacity-50',
  danger: 'bg-danger-600 text-white shadow-xs hover:bg-danger-700 active:bg-danger-700 disabled:opacity-50',
  outline:
    'border border-brand-600/40 text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10 disabled:opacity-50',
};

const SIZES = {
  xs: 'h-7 gap-1 px-2 text-2xs',
  sm: 'h-8 gap-1.5 px-2.5 text-xs',
  md: 'h-9 gap-2 px-3.5 text-sm',
  lg: 'h-11 gap-2 px-5 text-sm',
  icon: 'h-9 w-9 justify-center',
  'icon-sm': 'h-8 w-8 justify-center',
};

export const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    className,
    children,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    type = 'button',
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <Component
      ref={ref}
      type={Component === 'button' ? type : undefined}
      disabled={Component === 'button' ? isDisabled : undefined}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center whitespace-nowrap rounded-lg font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        LeftIcon && <LeftIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {children}
      {RightIcon && !loading ? (
        <RightIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : null}
    </Component>
  );
});

export const IconButton = forwardRef(function IconButton(
  { label, variant = 'ghost', size = 'icon', className, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn('shrink-0', className)}
      aria-label={label}
      title={label}
      {...props}
    />
  );
});