import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Plus, RotateCcw } from 'lucide-react';

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
import { MoneyCell, PriorityPill, RecordTitle, Reference, StatusBadge, UserCell } from '../components/records/RecordBits';
import { errorMessage } from '../services/api';
import { leadService, teamService } from '../services/endpoints';
import { LEAD_PRIORITIES, LEAD_SOURCES, LEAD_STATUSES, sourceLabel } from '../utils/constants';
import { formatCurrency, formatNumber, formatRelative } from '../utils/formatters';
import { useApi, useDebounce } from '../hooks';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const SORTABLE = [
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'created_at:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'expected_value:desc', label: 'Highest value' },
  { value: 'status:asc', label: 'Status' },
];

const EMPTY_FORM = {
  name: '',
  company: '',
  email: '',
  phone: '',
  source: 'website',
  status: 'new',
  priority: 'medium',
  owner_id: '',
  expected_value: '',
  notes: '',
};

/** Reads `?status=` etc. from the URL so insight deep links land pre-filtered. */
function useInitialFilters(searchParams) {
  return useMemo(
    () => ({
      status: searchParams.get('status') || 'all',
      priority: searchParams.get('priority') || 'all',
      owner: searchParams.get('owner') || 'all',
      source: searchParams.get('source') || 'all',
      stale: searchParams.get('stale') === 'true',
    }),
    [searchParams],
  );
}

export default function Leads() {
  const [searchParams] = useSearchParams();
  const initial = useInitialFilters(searchParams);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initial.status);
  const [priority, setPriority] = useState(initial.priority);
  const [owner, setOwner] = useState(initial.owner);
  const [source, setSource] = useState(initial.source);
  const [stale, setStale] = useState(initial.stale);
  const [sort, setSort] = useState('created_at:desc');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const toast = useToast();
  const { isManager } = useAuth();
  const debouncedSearch = useDebounce(search, 350);

  const { data: team } = useApi(() => teamService.list({}), []);
  const ownerOptions = (team?.members ?? []).map((member) => ({
    value: String(member.id),
    label: member.name,
  }));

  const [sortField, sortOrder] = sort.split(':');

  const { data, meta, loading, error, refetch } = useApi(
    () =>
      leadService.list({
        search: debouncedSearch,
        status,
        priority,
        owner,
        source,
        stale: stale ? 'true' : undefined,
        sort: sortField,
        order: sortOrder,
        page,
        per_page: 20,
      }),
    [debouncedSearch, status, priority, owner, source, stale, sortField, sortOrder, page],
  );

  const rows = data ?? [];
  const counts = meta?.counts ?? {};
  const pipelineValue = rows.reduce((sum, lead) => sum + (lead.expected_value || 0), 0);

  const activeFilters = [
    status !== 'all' && `Status: ${status}`,
    priority !== 'all' && `Priority: ${priority}`,
    owner !== 'all' && `Owner: ${owner === 'unassigned' ? 'Unassigned' : ownerOptions.find((o) => o.value === owner)?.label}`,
    source !== 'all' && `Source: ${source}`,
    stale && 'Stale only',
    debouncedSearch && `Search: "${debouncedSearch}"`,
  ].filter(Boolean);

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setPriority('all');
    setOwner('all');
    setSource('all');
    setStale(false);
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEdit = (lead) => {
    setEditing(lead);
    setForm({
      name: lead.name ?? '',
      company: lead.company ?? '',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      source: lead.source ?? 'website',
      status: lead.status ?? 'new',
      priority: lead.priority ?? 'medium',
      owner_id: lead.owner_id ? String(lead.owner_id) : '',
      expected_value: lead.expected_value ? String(lead.expected_value) : '',
      notes: lead.notes ?? '',
    });
    setFieldErrors({});
    setFormOpen(true);
  };

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});

    // Blank owner means "unassigned"; empty numbers must not reach the API.
    const payload = {
      ...form,
      owner_id: form.owner_id || null,
      expected_value: form.expected_value === '' ? null : Number(form.expected_value),
    };

    try {
      if (editing) {
        await leadService.update(editing.id, payload);
        toast.success('Lead updated', { title: payload.name });
      } else {
        await leadService.create(payload);
        toast.success('Lead created', { title: payload.name });
      }
      setFormOpen(false);
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
      await leadService.remove(deleting.id);
      toast.success('Lead deleted', { title: deleting.reference });
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async (lead) => {
    try {
      const result = await leadService.convert(lead.id);
      toast.success('Converted to customer', {
        title: result.customer?.reference,
      });
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const columns = [
    {
      key: 'lead',
      header: 'Lead',
      primary: true,
      mobileLabel: undefined,
      render: (lead) => (
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-2xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
            {lead.name?.slice(0, 2).toUpperCase()}
          </span>
          <RecordTitle primary={lead.name} secondary={lead.company || lead.email} />
        </div>
      ),
    },
    { key: 'reference', header: 'Reference', render: (lead) => <Reference value={lead.reference} />, hideOnMobile: true },
    { key: 'status', header: 'Status', render: (lead) => <StatusBadge type="lead" value={lead.status} /> },
    { key: 'priority', header: 'Priority', render: (lead) => <PriorityPill priority={lead.priority} /> },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      render: (lead) => <MoneyCell value={lead.expected_value} />,
    },
    { key: 'owner', header: 'Owner', render: (lead) => <UserCell user={lead.owner} /> },
    { key: 'created', header: 'Created', render: (lead) => <span className="text-2xs text-ink-subtle">{formatRelative(lead.created_at)}</span>, hideOnMobile: true },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (lead) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="xs" variant="ghost" onClick={() => openEdit(lead)}>
            Edit
          </Button>
          {lead.status === 'won' && !lead.customer_id ? (
            <Button size="xs" variant="outline" onClick={() => handleConvert(lead)}>
              Convert
            </Button>
          ) : null}
          {isManager ? (
            <Button size="xs" variant="ghost" className="text-danger-600 dark:text-danger-400" onClick={() => setDeleting(lead)}>
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
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Leads</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {formatNumber(counts.all ?? 0)} total · {formatCurrency(pipelineValue)} on this page
          </p>
        </div>
        <Button leftIcon={Plus} onClick={openCreate}>
          New lead
        </Button>
      </div>

      <Card className="mt-4 p-3 sm:p-4">
        <FilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search name, company, email or reference"
        >
          <SelectMenu
            value={priority}
            onChange={(value) => {
              setPriority(value);
              setPage(1);
            }}
            options={LEAD_PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
            allLabel="Any priority"
          />
          <SelectMenu
            value={source}
            onChange={(value) => {
              setSource(value);
              setPage(1);
            }}
            options={LEAD_SOURCES.map((s) => ({ value: s, label: sourceLabel(s) }))}
            allLabel="Any source"
          />
          <SelectMenu
            value={owner}
            onChange={(value) => {
              setOwner(value);
              setPage(1);
            }}
            options={ownerOptions}
            allLabel="Any owner"
          />
          <SelectMenu
            value={sort}
            onChange={setSort}
            options={SORTABLE.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            allLabel="Newest first"
          />
          <Button
            size="sm"
            variant={stale ? 'primary' : 'secondary'}
            leftIcon={Filter}
            onClick={() => {
              setStale((v) => !v);
              setPage(1);
            }}
          >
            Stale only
          </Button>
          {activeFilters.length ? (
            <Button size="sm" variant="ghost" leftIcon={RotateCcw} onClick={resetFilters}>
              Reset
            </Button>
          ) : null}
        </FilterBar>

        <div className="mt-3">
          <StatusTabs
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            counts={counts}
            options={LEAD_STATUSES.map((s) => ({ value: s }))}
          />
        </div>
      </Card>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          onRetry={refetch}
          emptyTitle="No leads found"
          emptyDescription={
            activeFilters.length
              ? 'No lead matches the current filters.'
              : 'Create your first lead to start building the pipeline.'
          }
          emptyAction={
            activeFilters.length ? (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : (
              <Button size="sm" leftIcon={Plus} onClick={openCreate}>
                New lead
              </Button>
            )
          }
        />
      </div>

      <Pagination meta={meta?.pagination} onPageChange={setPage} onPageSizeChange={() => {}} />

      {/* Create / edit */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.reference}` : 'New lead'}
        description={editing ? 'Changes are written to the activity log.' : 'A reference number is assigned automatically.'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Save changes' : 'Create lead'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} noValidate>
          <FormGrid>
            <Input label="Name" required value={form.name} onChange={update('name')} error={fieldErrors.name} />
            <Input label="Company" value={form.company} onChange={update('company')} error={fieldErrors.company} />
            <Input label="Email" type="email" value={form.email} onChange={update('email')} error={fieldErrors.email} />
            <Input label="Phone" value={form.phone} onChange={update('phone')} error={fieldErrors.phone} />
            <Select
              label="Status"
              value={form.status}
              onChange={update('status')}
              options={LEAD_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={update('priority')}
              options={LEAD_PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
            />
            <Select
              label="Source"
              value={form.source}
              onChange={update('source')}
              options={LEAD_SOURCES.map((s) => ({ value: s, label: sourceLabel(s) }))}
            />
            <Input
              label="Expected value"
              type="number"
              min="0"
              step="1000"
              placeholder="500000"
              value={form.expected_value}
              onChange={update('expected_value')}
              error={fieldErrors.expected_value}
            />
            <FormRow>
              <Select
                label="Owner"
                value={form.owner_id}
                onChange={update('owner_id')}
                placeholder="Unassigned"
                options={ownerOptions}
                error={fieldErrors.owner_id}
              />
            </FormRow>
            <FormRow>
              <Textarea
                label="Notes"
                rows={3}
                value={form.notes}
                onChange={update('notes')}
                error={fieldErrors.notes}
              />
            </FormRow>
          </FormGrid>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        title={`Delete ${deleting?.reference}?`}
        message={
          deleting
            ? `${deleting.name}${deleting.company ? ` (${deleting.company})` : ''} will be permanently removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete lead"
      />
    </PageContainer>
  );
}