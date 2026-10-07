import { useState } from 'react';
import { Bell, Palette, ShieldCheck } from 'lucide-react';

import { PageContainer } from '../components/layout/Topbar';
import { Badge, Card } from '../components/ui/Badge';
import { Switch } from '../components/ui/Input';
import { SegmentedControl } from '../components/ui/FilterBar';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/StateBlock';
import { settingsService } from '../services/endpoints';
import { useApi, useDocumentTitle } from '../hooks';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../services/api';
import { notificationMeta } from '../utils/constants';

const PREFERENCE_FIELDS = [
  { key: 'notify_task_reminders', label: 'Task reminders', description: 'Warn me before a task falls behind.' },
  { key: 'notify_new_leads', label: 'New leads', description: 'Let me know when a lead is created.' },
  { key: 'notify_support', label: 'Support tickets', description: 'Alert me about ticket updates and SLA pressure.' },
  { key: 'notify_assignments', label: 'Assignments', description: 'Tell me when I am assigned work.' },
];

export default function Settings() {
  useDocumentTitle('Settings');
  const toast = useToast();
  const { setTheme } = useTheme();
  const { saveAppearance } = useAuth();

  const [theme, setThemeValue] = useState('system');
  const [preferences, setPreferences] = useState({});

  const { data, loading, error, refetch } = useApi(() => settingsService.get(), {
    deps: [],
    onSuccess: (result) => {
      setThemeValue(result.appearance?.theme ?? 'system');
      setPreferences(result.notifications?.preferences ?? {});
    },
  });

  const applyTheme = (next) => {
    setThemeValue(next);
    setTheme(next);
    saveAppearance(next);
  };

  const togglePreference = async (key, value) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    try {
      const result = await settingsService.update({ [key]: value });
      setPreferences(result.notifications.preferences);
    } catch (err) {
      setPreferences((current) => ({ ...current, [key]: !value }));
      toast.error(errorMessage(err));
    }
  };

  const themeOptions = data?.appearance?.options ?? ['light', 'dark', 'system'];
  const types = data?.notifications?.types ?? [];

  return (
    <PageContainer>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Appearance and notification preferences</p>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} className="mt-6" />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-4 sm:p-5">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-ink">Appearance</h2>
                </div>
                <p className="mt-1 text-xs text-ink-muted">Follows your device unless you override it. Saved to your account.</p>
                <div className="mt-4">
                  <SegmentedControl
                    value={theme}
                    onChange={applyTheme}
                    options={themeOptions.map((option) => ({ value: option, label: option[0].toUpperCase() + option.slice(1) }))}
                  />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-xs text-ink-muted">
                  <div className="rounded-lg bg-sunken p-3">
                    <dt className="font-medium text-ink">Light</dt>
                    <dd className="mt-0.5">Bright canvases for focused daytime work.</dd>
                  </div>
                  <div className="rounded-lg bg-sunken p-3">
                    <dt className="font-medium text-ink">Dark</dt>
                    <dd className="mt-0.5">Low-glare surfaces for evenings and screens.</dd>
                  </div>
                </dl>
              </>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-ink">Notifications</h2>
                </div>
                <div className="mt-4 space-y-4">
                  {PREFERENCE_FIELDS.map((field) => (
                    <Switch
                      key={field.key}
                      label={field.label}
                      description={field.description}
                      checked={Boolean(preferences[field.key])}
                      onChange={(value) => togglePreference(field.key, value)}
                    />
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className="p-4 sm:p-5 lg:col-span-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Channels</h2>
            </div>
            <p className="mt-1 text-xs text-ink-muted">Notification types currently generated by the app.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {types.map((type) => {
                const meta = notificationMeta(type);
                return (
                  <li key={type}>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}