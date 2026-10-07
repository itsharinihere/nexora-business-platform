import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';

import { cn } from '../../utils/cn';
import { notificationMeta } from '../../utils/constants';
import { formatRelative } from '../../utils/formatters';
import { errorMessage } from '../../services/api';
import { notificationService } from '../../services/endpoints';
import { useClickOutside, useEscapeKey } from '../../hooks';
import { useNotifications } from '../../context/NotificationContext';
import { IconButton } from '../ui/Button';

/**
 * Notification bell with a dropdown preview.
 *
 * Opening the panel fetches the latest items once and caches them for the
 * session; marking read updates both the list and the shared unread badge.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const rootRef = useRef(null);

  const { unreadCount, setUnreadCount } = useNotifications();

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);
  useEscapeKey(close, open);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await notificationService.list({ per_page: 6 });
      const list = Array.isArray(result) ? result : (result.data ?? []);
      setItems(list);
      const count = result?.meta?.unread_count ?? result?.data?.unread_count;
      if (typeof count === 'number') setUnreadCount(count);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [setUnreadCount]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const markRead = async (notification) => {
    if (notification.is_read) return;
    setItems((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await notificationService.markRead(notification.id);
    } catch {
      // Optimistic: re-sync on the next open rather than showing a scary toast.
      load();
    }
  };

  const markAllRead = async () => {
    if (!unreadCount) return;
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
    try {
      await notificationService.markAllRead();
    } catch {
      load();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[0.625rem] font-bold leading-none text-white ring-2 ring-surface">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </IconButton>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-1.5 w-[calc(100vw-1.5rem)] max-w-sm animate-slide-up overflow-hidden rounded-xl border border-line bg-surface shadow-lg sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:opacity-80 dark:text-brand-300"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="nx-scroll max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-ink-subtle">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading…
              </div>
            ) : error ? (
              <p className="px-3 py-6 text-center text-xs text-danger-600 dark:text-danger-400">{error}</p>
            ) : !items.length ? (
              <p className="px-3 py-8 text-center text-xs text-ink-subtle">
                You are all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-line/70">
                {items.map((notification) => {
                  const meta = notificationMeta(notification.type);

                  return (
                    <li key={notification.id}>
                      <div className={cn('flex gap-2.5 px-3 py-2.5', !notification.is_read && 'bg-brand-50/50 dark:bg-brand-500/5')}>
                        <button
                          type="button"
                          onClick={() => markRead(notification)}
                          aria-label={notification.is_read ? 'Already read' : 'Mark as read'}
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0 rounded-full border transition',
                            notification.is_read
                              ? 'border-brand-500 bg-brand-500'
                              : 'border-line-strong hover:border-brand-500',
                          )}
                        >
                          {notification.is_read ? <Check className="mx-auto h-3 w-3 text-white" aria-hidden="true" /> : null}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                'min-w-0 flex-1 text-xs leading-snug',
                                notification.is_read ? 'text-ink-muted' : 'font-semibold text-ink',
                              )}
                            >
                              {notification.title}
                            </p>
                            <span className="shrink-0 text-2xs text-ink-subtle">
                              {formatRelative(notification.created_at)}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{notification.message}</p>
                          <p className="mt-1 text-2xs uppercase tracking-wide text-ink-subtle">{meta.label}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-line px-3 py-2">
            <Link
              to="/app/notifications"
              onClick={close}
              className="block text-center text-xs font-semibold text-brand-700 hover:opacity-80 dark:text-brand-300"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}