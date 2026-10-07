import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useDocumentTitle } from '../../hooks';
import { NotificationBell } from './NotificationBell';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { Topbar } from './Topbar';
import { UserMenu } from './UserMenu';

/**
 * Authenticated application frame: persistent sidebar from `lg` up, slide-over
 * drawer below it, and a sticky topbar. Feature pages render into `<Outlet />`.
 */
export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  // Any navigation closes the drawer, which avoids leaving it open behind a
  // newly rendered page on small screens.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useDocumentTitle(null);

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg"
      >
        Skip to content
      </a>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />

        <main id="main-content" className="flex-1">
          <Outlet />
        </main>

        {/* Mobile utility bar: the three actions that must always be reachable. */}
        <div className="sticky bottom-0 z-20 flex items-center justify-around border-t border-line bg-surface/95 px-2 py-1.5 backdrop-blur-md sm:hidden">
          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </div>
  );
}

/** Centered frame for the public pages (landing, login, register). */
export function PublicLayout({ children }) {
  return <div className="min-h-screen bg-canvas">{children}</div>;
}