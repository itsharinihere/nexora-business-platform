import { useState } from 'react';
import { KeyRound, PenLine, Plus, RotateCcw, ShieldCheck, UserPlus } from 'lucide-react';

import { PageContainer } from '../components/layout/Topbar';
import { Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { DataTable } from '../components/ui/DataTable';
import { FilterBar, StatusTabs } from '../components/ui/FilterBar';
import { SelectMenu } from '../components/ui/Dropdown';
import { ProgressBar } from '../components/ui/Progress';
import { errorMessage } from '../services/api';
import { teamService } from '../services/endpoints';
import { USER_STATUSES, roleMeta, userStatusMeta, workloadTone } from '../utils/constants';
import { formatNumber, formatRelative } from '../utils/formatters';
import { useApi, useDebounce, useDocumentTitle } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const SORTABLE = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'workload', label: 'Busiest first' },
  { value: 'open_tasks', label: 'Most open tasks' },
  { value: 'open_leads', label: 'Most open leads' },
  { value: 'department', label: 'Department' },
  { value: 'created_at', label: 'Newest member' },
];

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'employee',
  title: '',
  department: '',
  phone: '',
  location: '',
};

export default function Team() {
  useDocumentTitle('Team');
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('all');
  const [sort, setSort] = useState('name');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [resetMember, setResetMember] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  const { data, loading, error, refetch } = useApi(
    () => teamService.list({ search: debouncedSearch, status, role, sort }),
    [debouncedSearch, status, role, sort],
  );

  const members = data?.members ?? [];
  const roles = data?.roles ?? [];
  const summary = data?.summary ?? {};
  const roleOptions = roles.map((item) => ({ value: item.name, label: roleMeta(item.name).label }));
  const maxWorkload = Math.max(1, ...members.map((member) => member.workload?.workload_score ?? 0));

  const activeFilters = [search, status !== 'all', role !== 'all'].filter(Boolean).length > 0;

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setRole('all');
    setSort('name');
  };

  const updateForm = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleInvite = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      const result = await teamService.create(form);
      toast.success('Member invited', { title: result.member.name });
      setInviteOpen(false);
      setForm(EMPTY_FORM);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
      if (err?.details && typeof err.details === 'object') setFieldErrors(err.details);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editMember) return;
    setSaving(true);
    setFieldErrors({});
    try {
      await teamService.update(editMember.id, form);
      toast.success('Member updated', { title: form.name });
      setEditMember(null);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
      if (err?.details && typeof err.details === 'object') setFieldErrors(err.details);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!resetMember) return;
    setSaving(true);
    try {
      await teamService.resetPassword(resetMember.id, form.password);
      toast.success('Password reset', { title: resetMember.name });
      setResetMember(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'member',
      header: 'Member',
      primary: true,
      render: (member) => (
        <div className="flex items-center gap-3">
          <Avatar name={member.name} src={member.avatar_url} size="md" status={member.status} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{member.name}</p>
            <p className="truncate text-2xs text-ink-subtle">
              {[member.email, member.title].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (member) => <RoleBadge name={member.role_name} /> },
    { key: 'department', header: 'Department', render: (member) => <span className="text-xs text-ink-muted">{member.department || '—'}</span>, hideOnMobile: true },
    { key: 'status', header: 'Status', render: (member) => <StatusBadge value={member.status} /> },
    {
      key: 'workload',
      header: 'Workload',
      render: (member) => (
        <div className="flex items-center gap-2">
          <div className="w-24">
            <ProgressBar value={(member.workload?.workload_score / maxWorkload) * 100} tone={workloadTone(member.workload?.workload_score)} />
          </div>
          <span className="nums text-2xs text-ink-muted">{member.workload?.workload_score ?? 0}</span>
        </div>
      ),
      hideOnMobile: true,
    },
    { key: 'open_tasks', header: 'Open', render: (member) => <span className="nums text-xs text-ink-muted">{formatNumber(member.workload?.open_tasks ?? 0)}</span>, hideOnMobile: true },
    { key: 'overdue', header: 'Overdue', render: (member) => <OverdueCount count={member.workload?.overdue_tasks ?? 0} />, hideOnMobile: true },
    { key: 'tickets', header: 'Tickets', render: (member) => <span className="nums text-xs text-ink-muted">{formatNumber(member.workload?.open_tickets ?? 0)}</span>, hideOnMobile: true },
    { key: 'leads', header: 'Leads', render: (member) => <span className="nums text-xs text-ink-muted">{formatNumber(member.workload?.open_leads ?? 0)}</span>, hideOnMobile: true },
    { key: 'completed', header: 'Done', render: (member) => <span className="nums text-xs text-ink-muted">{formatNumber(member.workload?.completed_tasks ?? 0)}</span>, hideOnMobile: true },
    { key: 'last_login', header: 'Last active', render: (member) => <span className="text-2xs text-ink-subtle">{member.last_login_at ? formatRelative(member.last_login_at) : 'Never'}</span>, hideOnMobile: true },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (member) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  size="xs"
                  variant="ghost"
                  leftIcon={PenLine}
                  onClick={() => {
                    setEditMember(member);
                    setForm({
                      name: member.name,
                      email: member.email,
                      password: '',
                      role: member.role_name,
                      status: member.status,
                      title: member.title ?? '',
                      department: member.department ?? '',
                      phone: member.phone ?? '',
                      location: member.location ?? '',
                    });
                    setFieldErrors({});
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-warning-600 dark:text-warning-400"
                  leftIcon={KeyRound}
                  onClick={() => setResetMember(member)}
                >
                  Reset
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Team</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {formatNumber(summary.total ?? 0)} members · {formatNumber(summary.active ?? 0)} active
          </p>
        </div>
        {isAdmin ? (
          <Button
            leftIcon={UserPlus}
            onClick={() => {
              setForm(EMPTY_FORM);
              setFieldErrors({});
              setInviteOpen(true);
            }}
          >
            Invite member
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-ink-muted">Total</p>
          <p className="nums mt-1 text-xl font-semibold text-ink">{formatNumber(summary.total ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-muted">Active</p>
          <p className="nums mt-1 text-xl font-semibold text-success-600 dark:text-success-400">{formatNumber(summary.active ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-muted">Invited</p>
          <p className="nums mt-1 text-xl font-semibold text-info-600 dark:text-info-400">{formatNumber(summary.invited ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-muted">Inactive</p>
          <p className="nums mt-1 text-xl font-semibold text-ink-subtle">{formatNumber(summary.inactive ?? 0)}</p>
        </Card>
      </div>

      <Card className="mt-4 p-3 sm:p-4">
        <StatusTabs
          value={status}
          onChange={(value) => setStatus(value)}
          counts={{ all: summary.total, active: summary.active, invited: summary.invited, inactive: summary.inactive }}
          options={USER_STATUSES.map((item) => ({ value: item, label: userStatusMeta(item).label }))}
        />
        <div className="mt-3">
          <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search name, email or department">
            <SelectMenu
              value={role}
              onChange={setRole}
              options={roleOptions}
              allLabel="Any role"
            />
            <SelectMenu value={sort} onChange={setSort} options={SORTABLE} allLabel="Name A–Z" />
            {activeFilters ? (
              <Button size="sm" variant="ghost" leftIcon={RotateCcw} onClick={resetFilters}>
                Reset
              </Button>
            ) : null}
          </FilterBar>
        </div>
      </Card>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={members}
          loading={loading}
          error={error}
          onRetry={refetch}
          emptyTitle="No team members found"
          emptyDescription="Invite someone to start building the roster."
          emptyAction={
            isAdmin ? (
              <Button
                size="sm"
                leftIcon={Plus}
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setFieldErrors({});
                  setInviteOpen(true);
                }}
              >
                Invite member
              </Button>
            ) : null
          }
        />
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a team member"
        description="Accounts start active; you can reset the password later."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleInvite} loading={saving}>
              Send invite
            </Button>
          </>
        }
      >
        <form onSubmit={handleInvite} noValidate>
          <div className="grid gap-4">
            <Input label="Full name" required value={form.name} onChange={updateForm('name')} error={fieldErrors.name} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Email" type="email" required value={form.email} onChange={updateForm('email')} error={fieldErrors.email} />
              <Input label="Temporary password" required type="text" value={form.password} onChange={updateForm('password')} error={fieldErrors.password} hint="Use a strong one-time value." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Role" value={form.role} onChange={updateForm('role')} options={roleOptions} />
              <Input label="Title" value={form.title} onChange={updateForm('title')} error={fieldErrors.title} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Department" value={form.department} onChange={updateForm('department')} error={fieldErrors.department} />
              <Input label="Phone" value={form.phone} onChange={updateForm('phone')} error={fieldErrors.phone} />
            </div>
            <Input label="Location" value={form.location} onChange={updateForm('location')} error={fieldErrors.location} />
          </div>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <Modal
        open={Boolean(editMember)}
        onClose={() => setEditMember(null)}
        title={`Edit ${editMember?.name ?? 'member'}`}
        description="Members can be reassigned and deactivated here."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditMember(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdate} noValidate>
          <div className="grid gap-4">
            <Input label="Full name" required value={form.name} onChange={updateForm('name')} error={fieldErrors.name} />
            <Input label="Email" type="email" disabled value={form.email} hint="Email is the login; change it from the account page." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Role" value={form.role} onChange={updateForm('role')} options={roleOptions} />
              <Select
                label="Status"
                value={form.status || 'active'}
                onChange={updateForm('status')}
                options={USER_STATUSES.map((item) => ({ value: item, label: userStatusMeta(item).label }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Title" value={form.title} onChange={updateForm('title')} error={fieldErrors.title} />
              <Input label="Department" value={form.department} onChange={updateForm('department')} error={fieldErrors.department} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Phone" value={form.phone} onChange={updateForm('phone')} error={fieldErrors.phone} />
              <Input label="Location" value={form.location} onChange={updateForm('location')} error={fieldErrors.location} />
            </div>
          </div>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <Modal
        open={Boolean(resetMember)}
        onClose={() => setResetMember(null)}
        title={`Reset password for ${resetMember?.name ?? 'member'}`}
        description="The member signs back in with the new password."
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetMember(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleReset} loading={saving}>
              Reset password
            </Button>
          </>
        }
      >
        <form onSubmit={(event) => { event.preventDefault(); handleReset(); }} noValidate>
          <Input
            label="New password"
            required
            value={form.password}
            onChange={updateForm('password')}
            error={fieldErrors.password}
          />
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>
    </PageContainer>
  );
}

function RoleBadge({ name }) {
  const meta = roleMeta(name);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ${meta.tone ? meta.tone : 'bg-sunken text-ink-muted ring-line'}`}>
      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function StatusBadge({ value }) {
  const meta = userStatusMeta(value);
  const dotClass = { active: 'bg-success-500', invited: 'bg-info-500', inactive: 'bg-ink-subtle' }[value] ?? 'bg-ink-subtle';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function OverdueCount({ count }) {
  return count > 0 ? (
    <span className="nums inline-flex rounded-full bg-danger-50 px-1.5 py-0.5 text-2xs font-semibold text-danger-600 dark:bg-danger-500/10 dark:text-danger-400">
      {count}
    </span>
  ) : (
    <span className="nums text-xs text-ink-subtle">0</span>
  );
}