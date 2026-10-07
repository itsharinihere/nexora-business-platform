import { useState } from 'react';
import { BadgeCheck, CalendarDays, Clock, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';

import { PageContainer } from '../components/layout/Topbar';
import { Card, Divider } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Input, Textarea } from '../components/ui/Input';
import { DetailList, DetailRow } from '../components/ui/Layout';
import { errorMessage } from '../services/api';
import { authService } from '../services/endpoints';
import { formatDate, formatRelative } from '../utils/formatters';
import { useDocumentTitle } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const PERMISSION_LABELS = {
  manage_team: 'Manage team',
  delete_records: 'Delete records',
  manage_settings: 'Manage settings',
};

export default function Profile() {
  useDocumentTitle('Profile');
  const toast = useToast();
  const { user, updateProfile } = useAuth();

  const [profile, setProfile] = useState(() => ({
    name: user?.name ?? '',
    title: user?.title ?? '',
    department: user?.department ?? '',
    phone: user?.phone ?? '',
    location: user?.location ?? '',
    bio: user?.bio ?? '',
  }));
  const [profileErrors, setProfileErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [password, setPassword] = useState({ current_password: '', new_password: '', confirm: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);

  const updateProfileField = (key) => (event) => {
    setProfile((current) => ({ ...current, [key]: event.target.value }));
    setProfileErrors((current) => ({ ...current, [key]: undefined }));
  };

  const updatePasswordField = (key) => (event) => {
    setPassword((current) => ({ ...current, [key]: event.target.value }));
    setPasswordErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileErrors({});
    try {
      await updateProfile(profile);
      toast.success('Profile updated', { title: 'Saved' });
    } catch (err) {
      toast.error(errorMessage(err));
      if (err?.details && typeof err.details === 'object') setProfileErrors(err.details);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordErrors({});

    if (password.new_password !== password.confirm) {
      setPasswordErrors((current) => ({ ...current, confirm: 'New passwords do not match.' }));
      return;
    }

    setSavingPassword(true);
    try {
      await authService.changePassword({
        current_password: password.current_password,
        new_password: password.new_password,
      });
      toast.success('Password changed', { title: 'Use the new one next time' });
      setPassword({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(errorMessage(err));
      if (err?.details && typeof err.details === 'object') setPasswordErrors(err.details);
    } finally {
      setSavingPassword(false);
    }
  };

  const permissions = user?.permissions ?? { manage_team: false, delete_records: false, manage_settings: false };
  const permissionEntries = Object.entries(PERMISSION_LABELS).filter(([key]) => permissions[key]);

  return (
    <PageContainer>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Profile</h1>
        <p className="mt-1 text-sm text-ink-muted">Your details, access and account security</p>
      </div>

      <Card className="mt-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user?.name ?? '?'} size="xl" />
          <div className="min-w-0">
            <p className="text-lg font-semibold text-ink">{user?.name}</p>
            <p className="text-sm text-ink-muted">
              {[user?.title, user?.department].filter(Boolean).join(' · ') || 'No title set'}
            </p>
            <p className="mt-0.5 text-2xs uppercase tracking-wider text-ink-subtle">{user?.role_name}</p>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink">Your details</h2>
          <form onSubmit={handleProfileSubmit} noValidate className="mt-3 space-y-4">
            <Input label="Full name" required value={profile.name} onChange={updateProfileField('name')} error={profileErrors.name} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Title" value={profile.title} onChange={updateProfileField('title')} error={profileErrors.title} />
              <Input label="Department" value={profile.department} onChange={updateProfileField('department')} error={profileErrors.department} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Phone" value={profile.phone} onChange={updateProfileField('phone')} error={profileErrors.phone} />
              <Input label="Location" value={profile.location} onChange={updateProfileField('location')} error={profileErrors.location} />
            </div>
            <Textarea label="Bio" rows={3} value={profile.bio} onChange={updateProfileField('bio')} error={profileErrors.bio} hint="Shown to teammates on the roster and in activity." />
            <Divider />
            <div className="flex justify-end gap-2">
              <Button type="submit" loading={savingProfile}>
                Save profile
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-ink">Account</h2>
            <div className="mt-2">
              <DetailList>
                <DetailRow label="Email" value={user?.email} icon={Mail} mono />
                <DetailRow label="Role" value={user?.role_name} icon={ShieldCheck} />
                <DetailRow label="Joined" value={user?.created_at ? formatDate(user.created_at) : '—'} icon={CalendarDays} />
                <DetailRow label="Last login" value={user?.last_login_at ? formatRelative(user.last_login_at) : 'First time'} icon={Clock} />
              </DetailList>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-success-600 dark:text-success-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Permissions</h2>
            </div>
            {permissionEntries.length ? (
              <ul className="mt-3 space-y-2">
                {permissionEntries.map(([key, label]) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-ink-muted">
                    <CheckDot />
                    {label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-subtle">Standard read-and-work access.</p>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Change password</h2>
        </div>
        <form onSubmit={handlePasswordSubmit} noValidate className="mt-3 max-w-xl space-y-4">
          <Input
            type="password"
            label="Current password"
            required
            leftIcon={Lock}
            value={password.current_password}
            onChange={updatePasswordField('current_password')}
            error={passwordErrors.current_password}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="password"
              label="New password"
              required
              value={password.new_password}
              onChange={updatePasswordField('new_password')}
              error={passwordErrors.new_password}
              hint="Minimum 8 characters."
            />
            <Input
              type="password"
              label="Confirm new password"
              required
              value={password.confirm}
              onChange={updatePasswordField('confirm')}
              error={passwordErrors.confirm}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" loading={savingPassword}>
              Update password
            </Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}

function CheckDot() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400">
      <BadgeCheck className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}