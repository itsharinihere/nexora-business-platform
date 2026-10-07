import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { cn } from '../utils/cn';

const ToastContext = createContext(null);

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    className:
      'border-success-500/30 bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400',
  },
  error: {
    icon: XCircle,
    className: 'border-danger-500/30 bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-400',
  },
  warning: {
    icon: AlertTriangle,
    className:
      'border-warning-500/30 bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400',
  },
  info: {
    icon: Info,
    className: 'border-info-500/30 bg-info-50 text-info-700 dark:bg-info-500/10 dark:text-info-400',
  },
};

const DEFAULT_DURATION = 4200;

/**
 * Toast notifications.
 *
 * Rendered into an ARIA live region so screen readers announce results of
 * actions that otherwise only change the page silently.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, { variant = 'info', title, duration = DEFAULT_DURATION, action } = {}) => {
      if (!message && !title) return null;
      const id = nextId.current;
      nextId.current += 1;

      setToasts((current) => [...current.slice(-3), { id, message, title, variant, action }]);

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (message, options) => push(message, { ...options, variant: 'success' }),
      error: (message, options) => push(message, { ...options, variant: 'error', duration: 6000 }),
      warning: (message, options) => push(message, { ...options, variant: 'warning' }),
      info: (message, options) => push(message, { ...options, variant: 'info' }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96"
    >
      {toasts.map((toast) => {
        const config = VARIANTS[toast.variant] ?? VARIANTS.info;
        const Icon = config.icon;

        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex animate-slide-in-right items-start gap-3 rounded-lg border p-3 shadow-lg backdrop-blur-sm',
              config.className,
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
              {toast.message ? (
                <p className={cn('text-sm', toast.title && 'mt-0.5 opacity-90')}>{toast.message}</p>
              ) : null}
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action.onClick?.();
                    onDismiss(toast.id);
                  }}
                  className="mt-1.5 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="-m-1 rounded p-1 opacity-60 transition hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}