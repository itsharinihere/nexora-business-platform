import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';

import { Logo } from '../components/layout/Logo';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { cn } from '../utils/cn';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { InlineError } from '../components/ui/StateBlock';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks';
import { errorMessage } from '../services/api';

/** Split-screen frame shared by Login and Register. */
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Form side */}
      <div className="flex flex-1 flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Logo to="/" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-sm">
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
            {subtitle ? <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p> : null}
            <div className="mt-6">{children}</div>
            {footer ? <div className="mt-6 text-sm text-ink-muted">{footer}</div> : null}
          </div>
        </div>
      </div>

      {/* Brand side */}
      <div className="relative hidden overflow-hidden bg-brand-600 lg:block lg:w-[46%]">
        <div className="nx-grid-bg absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-center px-12 text-white">
          <p className="text-2xl font-semibold leading-snug">
            Leads, customers, tasks and support — one dataset, no duplication.
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
            NEXORA is a full-stack CRM built to be inspected: JWT auth, role-based permissions,
            server-side validation, rule-based insights and a seeded SQLite database you can reset
            at any time.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Password field with a reveal toggle.
 *
 * Written standalone rather than through `<Input>` because the toggle is an
 * interactive control in the adornment slot, not a decorative icon.
 */
export function PasswordInput({
  id = 'password',
  label = 'Password',
  error,
  hint,
  ...props
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            'h-9 w-full rounded-lg border bg-surface pl-9 pr-10 text-sm text-ink transition-colors',
            'placeholder:text-ink-subtle hover:border-line-strong',
            'focus:outline-none focus:ring-2',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/25'
              : 'border-line focus:border-brand-500 focus:ring-brand-500/25',
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-subtle transition hover:text-ink"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-danger-600 dark:text-danger-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export default function Login() {
  useDocumentTitle('Sign in');

  const { signIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // The landing page prefills a demo email when you pick a role.
  useEffect(() => {
    const preset = location.state?.email;
    if (preset) setForm((current) => ({ ...current, email: preset }));
  }, [location.state]);

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const user = await signIn({ email: form.email.trim(), password: form.password });
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(location.state?.from?.pathname || '/app/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      if (err?.details && typeof err.details === 'object') setFieldErrors(err.details);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (email) => setForm({ email, password: 'Nexora@2026' });

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use one of the demo accounts or your own credentials."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? <InlineError error={{ message: error }} /> : null}

        <Input
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          leftIcon={Mail}
          placeholder="you@nexora.dev"
          value={form.email}
          onChange={update('email')}
          error={fieldErrors.email}
        />

        <PasswordInput
          id="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={update('password')}
          error={fieldErrors.password}
        />

        <Button type="submit" size="lg" loading={submitting} rightIcon={ArrowRight} className="w-full">
          Sign in
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-line bg-sunken/60 p-3">
        <p className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">Demo accounts</p>
        <div className="mt-2 space-y-1">
          {[
            { label: 'Admin', email: 'harini@nexora.dev' },
            { label: 'Manager', email: 'arun@nexora.dev' },
            { label: 'Employee', email: 'karthik@nexora.dev' },
          ].map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemo(account.email)}
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left transition hover:bg-surface"
            >
              <span className="text-xs text-ink-muted">{account.label}</span>
              <span className="truncate font-mono text-2xs text-ink-subtle">{account.email}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-2xs text-ink-subtle">Password for all three: Nexora@2026</p>
      </div>
    </AuthLayout>
  );
}