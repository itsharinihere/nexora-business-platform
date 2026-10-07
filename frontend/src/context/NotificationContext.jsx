import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { notificationService } from '../services/endpoints';

const NotificationContext = createContext(null);

const POLL_INTERVAL = 60_000;

/**
 * Shared unread-notification count.
 *
 * Both the topbar bell and the dashboard read this, so the badge stays in sync
 * when a notification is marked read in the dropdown without either component
 * knowing about the other.
 */
export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const data = await notificationService.unreadCount();
      setUnreadCount(data.unread_count ?? 0);
    } catch {
      // A failing poll must never interrupt the user; the badge simply stays as-is.
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [refresh]);

  /** Called after an action that changes the count, so it updates immediately. */
  const applyLocalChange = useCallback((delta) => {
    setUnreadCount((current) => Math.max(0, current + delta));
  }, []);

  const value = useMemo(
    () => ({ unreadCount, refresh, setUnreadCount, applyLocalChange }),
    [unreadCount, refresh, applyLocalChange],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside <NotificationProvider>.');
  return context;
}