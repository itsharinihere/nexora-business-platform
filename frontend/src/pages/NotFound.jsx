import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, Home } from 'lucide-react';

import { Logo } from '../components/layout/Logo';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks';

const SUGGESTIONS = [
  { to: '/app/dashboard', label: 'Dashboard', description: 'KPIs, charts and what needs attention' },
  { to: '/app/leads', label: 'Leads', description: 'Pipeline and conversion' },
  { to: '/app/tasks', label: 'Tasks', description: 'Board and list view' },
  { to: '/app/support', label: 'Support', description: 'Tickets and SLA tracking' },
];

export default function NotFound() {
  useDocumentTitle('Page not found');
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
          <Logo to={isAuthenticated ? '/app/dashboard' : '/'} />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <Compass className="h-5 w-5" aria-hidden="true" />
          </span>

          <p className="mt-5 text-5xl font-semibold tracking-tight text-ink">404</p>
          <h1 className="mt-2 text-lg font-semibold text-ink">This page does not exist</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            The link may be outdated, or the record it pointed to was deleted.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button leftIcon={ArrowLeft} onClick={() => navigate(-1)} variant="secondary">
              Go back
            </Button>
            <Link to={isAuthenticated ? '/app/dashboard' : '/'}>
              <Button leftIcon={Home}>{isAuthenticated ? 'Dashboard' : 'Home'}</Button>
            </Link>
          </div>

          {isAuthenticated ? (
            <div className="mt-8 rounded-lg border border-line bg-surface p-3 text-left">
              <p className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
                Popular pages
              </p>
              <ul className="mt-2 space-y-1">
                {SUGGESTIONS.map((suggestion) => (
                  <li key={suggestion.to}>
                    <Link
                      to={suggestion.to}
                      className="block rounded px-2 py-1.5 transition hover:bg-sunken"
                    >
                      <span className="text-sm text-ink">{suggestion.label}</span>
                      <span className="block text-xs text-ink-subtle">{suggestion.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}