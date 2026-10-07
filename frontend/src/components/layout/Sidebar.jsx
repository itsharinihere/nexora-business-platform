import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';

import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { NAV_FOOTER, visibleNavItems } from '../../config/navigation';
import { Logo } from './Logo';

/**
 * Primary navigation. Rendered as a persistent rail from `lg` up and as a
 * slide-over drawer below it, which keeps 320px screens usable.
 */
export function Sidebar({ open, onClose, className }) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const items = visibleNavItems(user?.role_name);

  const linkClass = ({ isActive }) =>
    cn(
      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-brand-600 text-white shadow-xs'
        : 'text-ink-muted hover:bg-sunken hover:text-ink',
    );

  return (
    <>
      {/* Backdrop, mobile only */}
      {open ? (
        <div
          className="fixed inset-0 z-30 animate-fade-in bg-ink/40 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0 shadow-lg' : '-translate-x-full',
          className,
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="-mr-1 rounded-lg p-1.5 text-ink-subtle transition hover:bg-sunken hover:text-ink lg:hidden"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav className="nx-scroll flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={linkClass}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.to === '/app/notifications' && unreadCount > 0 ? (
                <span
                  className={cn(
                    'nums inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-2xs font-semibold',
                    'bg-brand-600 text-white',
                  )}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 space-y-0.5 border-t border-line p-3">
          {NAV_FOOTER.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={onClose} className={linkClass}>
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </aside>
    </>
  );
}