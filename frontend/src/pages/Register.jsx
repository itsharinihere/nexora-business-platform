import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, User } from 'lucide-react';

import { AuthLayout, PasswordInput } from './Login';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { InlineError } from '../components/ui/StateBlock';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks';
import { errorMessage } from '../services/api';

const EMPTY = { name: '', email: '', password: '', confirmPassword: '' };

export default function Register() {
  useDocumentTitle('Create account');

  const { signUp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  /** Client-side checks that save a round trip; the API re-validates regardless. */
  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.password.length < 8) next.password = 'Use at least 8 characters.';
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);

    try {
      const user = await signUp({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      toast.success('Account created', { title: `Welcome, ${user.name.split(' ')[0]}` });
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      if (err?.details && typeof err.details === 'object') setFieldErrors(err.details);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="New accounts start with the employee role."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? <InlineError error={{ message: error }} /> : null}

        <Input
          id="name"
          label="Full name"
          autoComplete="name"
          required
          leftIcon={User}
          placeholder="Your name"
          value={form.name}
          onChange={update('name')}
          error={fieldErrors.name}
        />

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
          label="Password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
          value={form.password}
          onChange={update('password')}
          error={fieldErrors.password}
        />

        <PasswordInput
          id="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
          required
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
          error={fieldErrors.confirmPassword}
        />

        <Button type="submit" size="lg" loading={submitting} rightIcon={ArrowRight} className="w-full">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}