import { forwardRef, useId } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';

import { cn } from '../../utils/cn';

const CONTROL =
  'w-full rounded-lg border border-line bg-surface text-sm text-ink transition-colors placeholder:text-ink-subtle ' +
  'hover:border-line-strong focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 ' +
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle';

const INVALID = 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/25';

/** Label + control + hint/error, wired together with matching ids. */
export function Field({ label, hint, error, required, htmlFor, children, className, action }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || action) && (
        <div className="flex items-baseline justify-between gap-3">
          {label ? (
            <label htmlFor={htmlFor} className="text-xs font-medium text-ink-muted">
              {label}
              {required ? <span className="ml-0.5 text-danger-500">*</span> : null}
            </label>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
      {error ? (
        <p className="flex items-start gap-1 text-xs text-danger-600 dark:text-danger-400">
          <AlertCircle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { label, hint, error, required, className, containerClassName, id, leftIcon, rightIcon, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const LeftIcon = leftIcon;
  const RightIcon = rightIcon;

  const control = (
    <div className="relative">
      {LeftIcon ? (
        <LeftIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
      ) : null}
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(
          CONTROL,
          'h-9 px-3',
          leftIcon && 'pl-9',
          rightIcon && 'pr-9',
          error && INVALID,
          className,
        )}
        {...props}
      />
      {RightIcon ? (
        <RightIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
      ) : null}
    </div>
  );

  if (!label && !hint && !error) return control;

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      className={containerClassName}
    >
      {control}
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, required, className, containerClassName, id, rows = 4, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id || generatedId;

  const control = (
    <textarea
      ref={ref}
      id={textareaId}
      rows={rows}
      required={required}
      aria-invalid={error ? 'true' : undefined}
      className={cn(CONTROL, 'resize-y px-3 py-2 leading-relaxed', error && INVALID, className)}
      {...props}
    />
  );

  if (!label && !hint && !error) return control;

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={textareaId}
      className={containerClassName}
    >
      {control}
    </Field>
  );
});

export const Select = forwardRef(function Select(
  {
    label,
    hint,
    error,
    required,
    className,
    containerClassName,
    id,
    options = [],
    placeholder,
    children,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const selectId = id || generatedId;

  const control = (
    <div className="relative">
      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        className={cn(CONTROL, 'h-9 cursor-pointer appearance-none pl-3 pr-9', error && INVALID, className)}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          return (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          );
        })}
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
        aria-hidden="true"
      />
    </div>
  );

  if (!label && !hint && !error) return control;

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={selectId}
      className={containerClassName}
    >
      {control}
    </Field>
  );
});

export function Checkbox({ label, description, error, className, id, ...props }) {
  const generatedId = useId();
  const checkboxId = id || generatedId;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-start gap-2.5">
        <input
          id={checkboxId}
          type="checkbox"
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong text-brand-600 transition',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0',
            'dark:bg-sunken dark:border-line-strong dark:text-brand-500',
            error && 'border-danger-500',
          )}
          {...props}
        />
        <div className="min-w-0">
          <label htmlFor={checkboxId} className="cursor-pointer text-sm text-ink select-none">
            {label}
          </label>
          {description ? <p className="mt-0.5 text-xs text-ink-subtle">{description}</p> : null}
        </div>
      </div>
      {error ? <p className="text-xs text-danger-600 dark:text-danger-400">{error}</p> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, id, disabled }) {
  const generatedId = useId();
  const switchId = id || generatedId;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={switchId} className="cursor-pointer text-sm font-medium text-ink select-none">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-ink-subtle">{description}</p> : null}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2',
          checked ? 'bg-brand-600' : 'bg-line-strong',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}