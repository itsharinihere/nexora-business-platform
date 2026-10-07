import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Eye, EyeOff, ExternalLink, Trash2 } from 'lucide-react';

import { PageContainer } from '../components/layout/Topbar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { FilterBar } from '../components/ui/FilterBar';
import { SelectMenu } from '../components/ui/Dropdown';
import { ErrorState } from '../components/ui/StateBlock';
import { Skeleton } from '../components/ui/Skeleton';
import { notificationService } from '../services/endpoints';
import { notificationMeta } from '../utils/constants';
import { formatRelative } from '../utils/formatters';
import { useApi, useDocumentTitle } from '../hooks';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../services/api';

const TYPE_OPTIONS = ['task_reminder', 'new_lead', 'support_ticket', 'assignment', 'system'].map((value) => ({
  value,
  label: notificationMeta(value).label,
}));

export default function Notifications() {
  useDocumentTitle('Notifications');
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useNotifications();

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);

  const { data, meta, loading, error, refetch } = useApi(
    () => notificationService.list({ unread_only: unreadOnly ? 'true' : undefined, type, page, per_page: 20 }),
    [unreadOnly, type, page],
  );

  const rows = data ?? [];
  const unreadCount = meta?.unread_count ?? 0;

  const toggleRead = async (notification) => {
    try {
      await (notification.is_read
        ? notificationService.markUnread(notification.id)
        : notificationService.markRead(notification.id));
      refresh();
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async (notification) => {
    try {
      await notificationService.remove(notification.id);
      refresh();
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllRead();
      toast.success('All notifications marked as read');
      refresh();
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Notifications</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {unreadCount > 0 ? `${unreadCount} unread · ` : 'All caught up · '}centred on mentions, tasks and support
          </p>
        </div>
        {unreadCount > 0 ? (
          <Button variant="secondary" size="sm" leftIcon={CheckCheck} onClick={markAllRead}>
            Mark all read
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        <FilterBar search={''} onSearchChange={() => {}} searchPlaceholder="—">
          <SelectMenu value={type} onChange={setType} options={TYPE_OPTIONS} allLabel="All types" />
          <Button
            size="sm"
            variant={unreadOnly ? 'primary' : 'secondary'}
            leftIcon={unreadOnly ? Eye : EyeOff}
            onClick={() => {
              setUnreadOnly((v) => !v);
              setPage(1);
            }}
          >
            {unreadOnly ? 'Unread only' : 'Show all'}
          </Button>
        </FilterBar>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-line p-3.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !rows.length ? (
          <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
            <Bell className="mx-auto h-6 w-6 text-ink-subtle" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-ink">
              {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {unreadOnly ? 'Nice — everything has been read.' : 'In-app alerts will show up here.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((notification) => {
              const meta = notificationMeta(notification.type);
              return (
                <li
                  key={notification.id}
                  className={`rounded-xl border p-3.5 transition sm:p-4 ${
                    notification.is_read ? 'border-line bg-surface' : 'border-brand-500/30 bg-brand-50/50 dark:bg-brand-500/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Badge tone={meta.tone} className="mt-0.5 shrink-0">
                      {meta.label}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{notification.title}</p>
                      {notification.message ? (
                        <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{notification.message}</p>
                      ) : null}
                      <p className="mt-1.5 text-2xs text-ink-subtle">{formatRelative(notification.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {notification.link ? (
                        <Button size="xs" variant="ghost" leftIcon={ExternalLink} onClick={() => navigate(notification.link)}>
                          Open
                        </Button>
                      ) : null}
                      <Button
                        size="xs"
                        variant="ghost"
                        leftIcon={notification.is_read ? EyeOff : Eye}
                        onClick={() => toggleRead(notification)}
                      >
                        {notification.is_read ? 'Unread' : 'Read'}
                      </Button>
                      <Button size="xs" variant="ghost" className="text-danger-600 dark:text-danger-400" leftIcon={Trash2} onClick={() => remove(notification)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Pagination meta={meta?.pagination} onPageChange={setPage} onPageSizeChange={() => {}} />
      </div>
    </PageContainer>
  );
}