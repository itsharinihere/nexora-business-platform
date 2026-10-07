import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cn } from '../../utils/cn';
import { useEscapeKey, useFocusTrap, useScrollLock } from '../../hooks';
import { Button } from './Button';

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

/**
 * Accessible dialog rendered in a portal.
 *
 * Handles the four things a dialog must get right: focus moves in and is
 * trapped, Escape closes, background scroll is locked, and the backdrop is
 * clickable without stealing clicks from the panel.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  className,
  bodyClassName,
  closeOnBackdrop = true,
}) {
  const panelRef = useRef(null);

  useScrollLock(open);
  useFocusTrap(panelRef, open);
  useEscapeKey(onClose, open && closeOnBackdrop);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-lg',
          'animate-slide-up sm:rounded-xl',
          SIZES[size],
          className,
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0">
              {title ? <h2 className="text-base font-semibold text-ink">{title}</h2> : null}
              {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="-m-1.5 shrink-0 rounded-lg p-1.5 text-ink-subtle transition hover:bg-sunken hover:text-ink"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        )}

        <div className={cn('nx-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5', bodyClassName)}>
          {children}
        </div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-sunken/60 px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** Destructive-action confirmation. Deliberately explicit about the consequence. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}) {
  useEscapeKey(onClose, open);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-muted">{message}</p>
    </Modal>
  );
}
