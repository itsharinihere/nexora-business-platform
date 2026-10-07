import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { NotificationBell } from './NotificationBell';
import { GlobalSearch } from './GlobalSearch';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { IconButton } from '../ui/Button';
import { pageTitleFor } from '../../config/navigation';

/**
 * Sticky application header: navigation trigger, page title, global search,
 * theme switch, notifications and the account menu.
 */
export function Topbar({ onOpenSidebar }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [mobileSearch, setMobileSearch] = useState(false);
  const searchHostRef = useRef(null);

  // Leaving a page dismisses the mobile search overlay.
  useEffect(() => setMobileSearch(false), [pathname]);

  return (
    <header className="sticky top-0 z-20 h-14 shrink-0 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="flex h-full items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <IconButton label="Open navigation" onClick={onOpenSidebar} className="lg:hidden">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </IconButton>

        <h1 className="hidden shrink-0 text-sm font-semibold text-ink lg:block">
          {pageTitleFor(pathname)}
        </h1>

        <div className="hidden min-w-0 flex-1 md:block" ref={searchHostRef}>
          <GlobalSearch />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <IconButton
            label="Search"
            onClick={() => setMobileSearch((v) => !v)}
            aria-expanded={mobileSearch}
            className="md:hidden"
          >
            {mobileSearch ? <X className="h-4 w-4" aria-hidden="true" /> : <SearchIcon />}
          </IconButton>

          <NotificationBell />
          <ThemeToggle className="hidden sm:inline-flex" />
          {user ? <UserMenu /> : null}
        </div>
      </div>

      {mobileSearch ? (
        <div className="animate-slide-up border-t border-line px-3 py-2 md:hidden">
          <GlobalSearch />
        </div>
      ) : null}
    </header>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Page container with consistent width and padding. Feature pages use this so
 * every route lines up without repeating spacing classes.
 */
export function PageContainer({ children, className, width = 'default' }) {
  const widths = {
    narrow: 'max-w-3xl',
    default: 'max-w-7xl',
    wide: 'max-w-8xl',
  };

  return (
    <div
      className={cn(
        'mx-auto w-full px-3 py-4 sm:px-5 sm:py-6',
        widths[width] ?? widths.default,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Fallback rendered while a lazily-loaded route chunk is fetching. */
export function RouteLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading page">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <p className="text-xs text-ink-subtle">Loading…</p>
      </div>
    </div>
  );
}