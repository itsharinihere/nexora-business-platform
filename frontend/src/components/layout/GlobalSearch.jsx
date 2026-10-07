import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, LifeBuoy, ListChecks, Loader2, Search, Target } from 'lucide-react';

import { cn } from '../../utils/cn';
import { leadStatusMeta, taskStatusMeta, ticketStatusMeta } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import { errorMessage } from '../../services/api';
import { customerService, leadService, taskService, ticketService } from '../../services/endpoints';
import { useClickOutside, useDebounce, useEscapeKey } from '../../hooks';
import { Badge } from '../ui/Badge';

/**
 * Global search across the four record types.
 *
 * Issues one request per module in parallel and merges the results, so the user
 * can find a record without knowing which page it lives on.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const debounced = useDebounce(query, 300);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);
  useEscapeKey(close, open);

  // "/" focuses search from anywhere, like a keyboard shortcut.
  useEffect(() => {
    const listener = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  useEffect(() => {
    const term = debounced.trim();
    if (term.length < 2) {
      setGroups([]);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.allSettled([
      leadService.list({ search: term, per_page: 3 }),
      customerService.list({ search: term, per_page: 3 }),
      taskService.list({ search: term, per_page: 3 }),
      ticketService.list({ search: term, per_page: 3 }),
    ])
      .then((results) => {
        if (controller.signal.aborted) return;

        const [leads, customers, tasks, tickets] = results;
        const unwrap = (result, fallback) => {
          if (result.status !== 'fulfilled') return fallback;
          return Array.isArray(result.value) ? result.value : (result.value.data ?? fallback);
        };

        const next = [
          {
            key: 'leads',
            label: 'Leads',
            icon: Target,
            items: unwrap(leads, []),
            render: (item) => ({
              title: item.company || item.name,
              subtitle: item.reference,
              to: `/app/leads/${item.id}`,
              badge: leadStatusMeta(item.status),
            }),
          },
          {
            key: 'customers',
            label: 'Customers',
            icon: Building2,
            items: unwrap(customers, []),
            render: (item) => ({
              title: item.company,
              subtitle: `${item.reference} · ${formatCurrency(item.account_value)}`,
              to: `/app/customers/${item.id}`,
            }),
          },
          {
            key: 'tasks',
            label: 'Tasks',
            icon: ListChecks,
            items: unwrap(tasks, []),
            render: (item) => ({
              title: item.title,
              subtitle: item.reference,
              to: `/app/tasks/${item.id}`,
              badge: taskStatusMeta(item.status),
            }),
          },
          {
            key: 'tickets',
            label: 'Support',
            icon: LifeBuoy,
            items: unwrap(tickets, []),
            render: (item) => ({
              title: item.subject,
              subtitle: item.reference,
              to: `/app/support/${item.id}`,
              badge: ticketStatusMeta(item.status),
            }),
          },
        ].filter((group) => group.items.length);

        setGroups(next);
        if (results.every((result) => result.status === 'rejected')) {
          const first = results[0].reason;
          setError(errorMessage(first));
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debounced]);

  const go = (to) => {
    setQuery('');
    setOpen(false);
    navigate(to);
  };

  const hasResults = groups.length > 0;

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search leads, customers, tasks, tickets"
          aria-label="Search all records"
          className="h-9 w-full rounded-lg border border-line bg-sunken pl-9 pr-12 text-sm text-ink transition-colors placeholder:text-ink-subtle hover:border-line-strong focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        />
        {loading ? (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-subtle"
            aria-hidden="true"
          />
        ) : (
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-surface px-1.5 font-mono text-2xs text-ink-subtle sm:block">
            /
          </kbd>
        )}
      </div>

      {open && query.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-[70vh] animate-slide-up overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
          {error && !hasResults ? (
            <p className="px-4 py-6 text-center text-xs text-danger-600 dark:text-danger-400">{error}</p>
          ) : !loading && !hasResults ? (
            <p className="px-4 py-6 text-center text-xs text-ink-subtle">
              No records matched “{query.trim()}”.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.key} className="border-b border-line/70 last:border-b-0">
                <p className="px-3 pt-2.5 text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
                  {group.label}
                </p>
                <ul>
                  {group.items.map((item) => {
                    const view = group.render(item);

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => go(view.to)}
                          onMouseDown={(event) => event.preventDefault()}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-sunken"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-ink">{view.title}</p>
                            <p className="truncate text-2xs text-ink-subtle">{view.subtitle}</p>
                          </div>
                          {view.badge ? <Badge tone={view.badge.tone} size="sm">{view.badge.label}</Badge> : null}
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Compact search trigger for small screens, which hides the full input. */
export function MobileSearchButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search"
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-sunken hover:text-ink sm:hidden',
      )}
    >
      <Search className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}