import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LifeBuoy, Plus, RotateCcw } from 'lucide-react';

import { PageContainer } from '../components/layout/Topbar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { FilterBar, StatusTabs } from '../components/ui/FilterBar';
import { SelectMenu } from '../components/ui/Dropdown';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { FormGrid, FormRow } from '../components/ui/Layout';
import { AgeChip, PriorityPill, RecordTitle, StatusBadge, UserCell } from '../components/records/RecordBits';
import { MiniStat, MiniStatGrid } from '../components/dashboard/StatCard';
import { errorMessage } from '../services/api';
import { teamService, ticketService } from '../services/endpoints';
import { TICKET_CATEGORIES, TICKET_STATUSES, priorityMeta, ticketStatusMeta } from '../utils/constants';
import { formatNumber, formatRelative } from '../utils/formatters';
import { useApi, useDebounce } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const SORTABLE = [
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'created_at:asc', label: 'Oldest first' },
  { value: 'priority:desc', label: 'Highest priority' },
  { value: 'subject:asc', label: 'Subject A–Z' },
];

const EMPTY_FORM = {
  subject: '',
  description: '',
  category: 'technical',
  priority: 'medium',
  assignee_id: '',
  requester_name: '',
  requester_email: '',
};

const titleCase = (value) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Support() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [category, setCategory] = useState('all');
  const [priority, setPriority] = useState('all');
  const [assignee, setAssignee] = useState(searchParams.get('assignee') || 'all');
  const [breach, setBreach] = useState(searchParams.get('breach') === 'true');
  const [sort, setSort] = useState('created_at:desc');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [deleting, setDeleting] = useState(null);

  const toast = useToast();
  const { isManager, user } = useAuth();
  const debouncedSearch = useDebounce(search, 350);

  const { data: team } = useApi(() => teamService.list({}), []);
  const assigneeOptions = (team?.members ?? []).map((member) => ({ value: String(member.id), label: member.name }));

  const [sortField, sortOrder] = sort.split(':');

  const { data, meta, loading, error, refetch } = useApi(
    () =>
      ticketService.list({
        search: debouncedSearch,
        status,
        category,
        priority,
        assignee,
        breach: breach ? 'true' : undefined,
        sort: sortField,
        order: sortOrder,
        page,
        per_page: 20,
      }),
    [debouncedSearch, status, category, priority, assignee, breach, sortField, sortOrder, page],
  );

  const rows = data ?? [];
  const counts = meta?.counts ?? {};
  const breachedCount = rows.filter((ticket) => ticket.sla_breached).length;

  const activeFilters =
    [category !== 'all', priority !== 'all', assignee !== 'all', breach, debouncedSearch].filter(Boolean).length > 0;

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setCategory('all');
    setPriority('all');
    setAssignee('all');
    setBreach(false);
    setPage(1);
  };

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const payload = { ...form, assignee_id: form.assignee_id || null };

    try {
      await ticketService.create(payload);
      toast.success('Ticket created', { title: payload.subject });
      setFormOpen(false);
      setForm({ ...EMPTY_FORM, requester_name: user?.name ?? '', requester_email: user?.email ?? '' });
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
      if (err?.details && typeof err.details === 'object') setFieldErrors(err.details);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await ticketService.remove(deleting.id);
      toast.success('Ticket deleted', { title: deleting.reference });
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'ticket',
      header: 'Ticket',
      primary: true,
      render: (ticket) => (
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400">
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
          </span>
          <RecordTitle primary={ticket.subject} secondary={`${ticket.reference} · ${ticket.requester_name}`} />
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge type="ticket" value={row.status} /> },
    { key: 'priority', header: 'Priority', render: (row) => <PriorityPill priority={row.priority} /> },
    {
      key: 'sla',
      header: 'Age / SLA',
      render: (row) => <AgeChip hours={row.age_hours} breached={row.sla_breached} />,
    },
    { key: 'category', header: 'Category', render: (row) => <span className="text-xs text-ink-muted">{titleCase(row.category)}</span>, hideOnMobile: true },
    { key: 'assignee', header: 'Assignee', render: (row) => <UserCell user={row.assignee} /> },
    { key: 'created', header: 'Opened', render: (row) => <span className="text-2xs text-ink-subtle">{formatRelative(row.created_at)}</span>, hideOnMobile: true },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="xs" variant="ghost" onClick={() => navigate(`/app/support/${row.id}`)}>
            Open
          </Button>
          {isManager ? (
            <Button size="xs" variant="ghost" className="text-danger-600 dark:text-danger-400" onClick={() => setDeleting(row)}>
              Delete
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Support</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {formatNumber(counts.all ?? 0)} tickets · {formatNumber(counts.open ?? 0)} open
          </p>
        </div>
        <Button
          leftIcon={Plus}
          onClick={() => {
            setForm({ ...EMPTY_FORM, requester_name: user?.name ?? '', requester_email: user?.email ?? '' });
            setFormOpen(true);
          }}
        >
          New ticket
        </Button>
      </div>

      {rows.length && !loading ? (
        <Card className="mt-4 p-4">
          <MiniStatGrid>
            <MiniStat label="On this page" value={formatNumber(rows.length)} icon={LifeBuoy} tone="brand" />
            <MiniStat label="SLA breached" value={formatNumber(breachedCount)} tone="danger" />
            <MiniStat
              label="Waiting"
              value={formatNumber(counts.waiting ?? 0)}
              tone="warning"
            />
            <MiniStat
              label="Resolved"
              value={formatNumber(counts.resolved ?? 0)}
              tone="success"
            />
          </MiniStatGrid>
        </Card>
      ) : null}

      <Card className="mt-4 p-3 sm:p-4">
        <StatusTabs
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          counts={counts}
          options={TICKET_STATUSES.map((item) => ({ value: item, label: ticketStatusMeta(item).label }))}
        />

        <div className="mt-3">
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search subject, reference or requester"
          >
            <SelectMenu
              value={category}
              onChange={setCategory}
              options={TICKET_CATEGORIES.map((item) => ({ value: item, label: titleCase(item) }))}
              allLabel="Any category"
            />
            <SelectMenu
              value={priority}
              onChange={setPriority}
              options={['low', 'medium', 'high', 'critical'].map((item) => ({ value: item, label: priorityMeta(item).label }))}
              allLabel="Any priority"
            />
            <SelectMenu
              value={assignee}
              onChange={setAssignee}
              options={[{ value: 'me', label: 'Assigned to me' }, ...assigneeOptions]}
              allLabel="Anyone"
            />
            <SelectMenu
              value={sort}
              onChange={setSort}
              options={SORTABLE.map((option) => ({ value: option.value, label: option.label }))}
              allLabel="Newest first"
            />
            <Button
              size="sm"
              variant={breach ? 'primary' : 'secondary'}
              onClick={() => setBreach((v) => !v)}
            >
              SLA breach only
            </Button>
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
          rows={rows}
          loading={loading}
          error={error}
          onRetry={refetch}
          onRowClick={(row) => navigate(`/app/support/${row.id}`)}
          rowHighlight={(row) => row.sla_breached}
          emptyTitle="No tickets found"
          emptyDescription={
            activeFilters ? 'No ticket matches the current filters.' : 'Log a support request to get started.'
          }
          emptyAction={
            activeFilters ? (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : (
              <Button size="sm" leftIcon={Plus} onClick={() => setFormOpen(true)}>
                New ticket
              </Button>
            )
          }
        />
      </div>

      <Pagination meta={meta?.pagination} onPageChange={setPage} onPageSizeChange={() => {}} />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New support ticket"
        description="SLA targets are applied automatically based on priority."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              Create ticket
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} noValidate>
          <FormGrid>
            <FormRow>
              <Input label="Subject" required value={form.subject} onChange={update('subject')} error={fieldErrors.subject} />
            </FormRow>
            <FormRow>
              <Textarea
                label="Description"
                required
                rows={4}
                value={form.description}
                onChange={update('description')}
                error={fieldErrors.description}
              />
            </FormRow>
            <Select
              label="Category"
              value={form.category}
              onChange={update('category')}
              options={TICKET_CATEGORIES.map((item) => ({ value: item, label: titleCase(item) }))}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={update('priority')}
              options={['low', 'medium', 'high', 'critical'].map((item) => ({ value: item, label: priorityMeta(item).label }))}
            />
            <Select
              label="Assignee"
              value={form.assignee_id}
              onChange={update('assignee_id')}
              placeholder="Unassigned"
              options={assigneeOptions}
              error={fieldErrors.assignee_id}
            />
            <Input
              label="Requester name"
              value={form.requester_name}
              onChange={update('requester_name')}
              error={fieldErrors.requester_name}
            />
            <FormRow>
              <Input
                label="Requester email"
                type="email"
                value={form.requester_email}
                onChange={update('requester_email')}
                error={fieldErrors.requester_email}
                hint="Defaults to your own account details."
              />
            </FormRow>
          </FormGrid>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        title={`Delete ${deleting?.reference}?`}
        message={deleting ? `"${deleting.subject}" and its history will be permanently removed.` : ''}
        confirmLabel="Delete ticket"
      />
    </PageContainer>
  );
}