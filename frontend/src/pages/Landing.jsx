import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  LifeBuoy,
  ListChecks,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

import { Logo } from '../components/layout/Logo';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks';

const FEATURES = [
  {
    icon: Target,
    title: 'Lead pipeline',
    body: 'Track every lead from first contact to won, with source, priority, expected value and a one-click convert into a customer account.',
  },
  {
    icon: ListChecks,
    title: 'Task management',
    body: 'A Kanban board and a list view over the same data. Assign, reprioritise and reschedule without leaving the page.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    body: 'Funnel conversion, source performance, task throughput and support metrics, computed from your own records rather than hard-coded numbers.',
  },
  {
    icon: Sparkles,
    title: 'Smart Insights',
    body: 'Deterministic rules compare stored metrics against fixed thresholds and explain what changed, with a recommended next action.',
  },
  {
    icon: LifeBuoy,
    title: 'Support desk',
    body: 'SLA tracking with breach detection, priority-aware response targets and a full change history per ticket.',
  },
  {
    icon: Users,
    title: 'Team workload',
    body: 'See who is carrying the backlog, who has capacity, and rebalance assignments before work piles up on one person.',
  },
];

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'harini@nexora.dev', note: 'Full access, can manage the team' },
  { role: 'Manager', email: 'arun@nexora.dev', note: 'Manages records and reporting' },
  { role: 'Employee', email: 'karthik@nexora.dev', note: 'Works assigned leads, tasks, tickets' },
];

export default function Landing() {
  useDocumentTitle('CRM for growing teams');
  const [copied, setCopied] = useState(false);

  const password = 'Nexora@2026';

  const demoRows = useMemo(() => DEMO_ACCOUNTS.map((account) => ({ ...account, password })), []);

  const copyDemo = async () => {
    try {
      await navigator.clipboard.writeText(`harini@nexora.dev / ${password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the credentials are visible on screen.
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo to="/" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="nx-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-2xs font-medium text-ink-muted">
                <CheckCircle2 className="h-3.5 w-3.5 text-success-500" aria-hidden="true" />
                Flask API · React · SQLite · No mock data
              </span>

              <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                The CRM that shows its working.
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
                NEXORA brings leads, customers, tasks and support into one place, then explains what the
                numbers mean. Every metric is computed from stored records by the API — nothing on this
                page is faked.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/login">
                  <Button size="lg" rightIcon={ArrowRight}>
                    Explore the demo
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="lg" variant="secondary">
                    Create an account
                  </Button>
                </Link>
              </div>

              <p className="mt-3 text-xs text-ink-subtle">
                Pre-loaded with 96 leads, 23 customers, 88 tasks, 74 tickets and 10 team members.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-y border-line bg-surface/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              Everything the pipeline needs
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-muted">
              Six modules sharing one dataset, so a lead converted to a customer keeps its history.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="nx-card nx-card-hover p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                    <feature.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-ink">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Demo accounts */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="nx-card overflow-hidden">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-base font-semibold text-ink">Demo accounts</h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  Every account uses the password <code className="rounded bg-sunken px-1 py-0.5 font-mono text-xs">Nexora@2026</code>.
                </p>
              </div>

              <div className="divide-y divide-line">
                {demoRows.map((account) => (
                  <div
                    key={account.email}
                    className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{account.role}</p>
                      <p className="truncate font-mono text-xs text-ink-muted">{account.email}</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">{account.note}</p>
                    </div>
                    <Link to="/login" state={{ email: account.email }} className="shrink-0">
                      <Button variant="secondary" size="sm">
                        Sign in as {account.role.toLowerCase()}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-line bg-sunken/50 px-5 py-3">
                <p className="text-xs text-ink-subtle">
                  Credentials are seeded by the API. Change them before deploying anywhere real.
                </p>
                <Button variant="ghost" size="xs" onClick={copyDemo}>
                  {copied ? 'Copied' : 'Copy admin login'}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <Logo to="/" showWordmark={false} />
          <p className="text-xs text-ink-subtle">
            Built as a full-stack portfolio project. React, Tailwind, Flask and SQLAlchemy.
          </p>
        </div>
      </footer>
    </div>
  );
}