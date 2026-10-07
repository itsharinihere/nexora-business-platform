import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, HeartPulse, Plus, RotateCcw } from 'lucide-react';

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
import {
  HealthChip,
  MoneyCell,
  RecordTitle,
  Reference,
  StatusBadge,
  UserCell,
} from '../components/records/RecordBits';
import { MiniStat, MiniStatGrid } from '../components/dashboard/StatCard';
import { errorMessage } from '../services/api';
import { customerService, teamService } from '../services/endpoints';
import { CUSTOMER_INDUSTRIES, CUSTOMER_STATUSES } from '../utils/constants';
import { formatCurrency, formatNumber, formatRelative } from '../utils/formatters';
import { useApi, useDebounce } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const SORTABLE = [
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'created_at:asc', label: 'Oldest first' },
  { value: 'account_value:desc', label: 'Highest value' },
  { value: 'health_score:asc', label: 'Lowest health' },
  { value: 'company:asc', label: 'Company A–Z' },
];

const EMPTY_FORM = {
  name: '',
  company: '',
  email: '',
  phone: '',
  industry: 'Technology',
  status: 'active',
  account_value: '',
  health_score: '85',
  owner_id: '',
  notes: '',
};

const titleCase = (value) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Customers() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [industry, setIndustry] = useState('all');
  const [owner, setOwner] = useState('all');
  const [sort, setSort] = useState('account_value:desc');
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
  const ownerOptions = (team?.members ?? []).map((member) => ({ value: String(member.id), label: member.name }));

  const [sortField, sortOrder] = sort.split(':');

  const { data, meta, loading, error, refetch } = useApi(
    () =>
      customerService.list({
        search: debouncedSearch,
        status,
        industry,
        owner,
        sort: sortField,
        order: sortOrder,
        page,
        per_page: 20,
      }),
    [debouncedSearch, status, industry, owner, sortField, sortOrder, page],
  );

  const rows = data ?? [];
  const counts = meta?.counts ?? {};

  const totals = useMemo(
    () => {
      const rows = data ?? [];
      return {
        value: rows.reduce((sum, customer) => sum + (customer.account_value || 0), 0),
        avgHealth: rows.length
          ? Math.round(rows.reduce((sum, customer) => sum + (customer.health_score || 0), 0) / rows.length)
          : 0,
        atRisk: rows.filter((customer) => customer.is_at_risk).length,
      };
    },
    [data],
  );

  const activeFilters =
    [
      status !== 'all' && `Status: ${status}`,
      industry !== 'all' && `Industry: ${industry}`,
      owner !== 'all' && 'Owner filtered',
      debouncedSearch && `Search: "${debouncedSearch}"`,
    ].filter(Boolean).length > 0;

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setIndustry('all');
    setOwner('all');
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({
      name: customer.name ?? '',
      company: customer.company ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      industry: customer.industry ?? 'Technology',
      status: customer.status ?? 'active',
      account_value: customer.account_value ? String(customer.account_value) : '',
      health_score: String(customer.health_score ?? 85),
      owner_id: customer.owner_id ? String(customer.owner_id) : '',
      notes: customer.notes ?? '',
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

    const payload = {
      ...form,
      owner_id: form.owner_id || null,
      account_value: form.account_value === '' ? null : Number(form.account_value),
      health_score: form.health_score === '' ? 85 : Number(form.health_score),
    };

    try {
      if (editing) {
        await customerService.update(editing.id, payload);
        toast.success('Customer updated', { title: payload.company });
      } else {
        await customerService.create(payload);
        toast.success('Customer created', { title: payload.company });
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
      await customerService.remove(deleting.id);
      toast.success('Customer deleted', { title: deleting.reference });
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
      key: 'customer',
      header: 'Customer',
      primary: true,
      render: (customer) => (
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info-50 text-2xs font-semibold text-info-700 dark:bg-info-500/10 dark:text-info-400">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <RecordTitle primary={customer.company} secondary={customer.name} />
        </div>
      ),
    },
    { key: 'reference', header: 'Reference', render: (row) => <Reference value={row.reference} />, hideOnMobile: true },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge type="customer" value={row.status} /> },
    { key: 'industry', header: 'Industry', render: (row) => <span className="text-xs text-ink-muted">{row.industry}</span>, hideOnMobile: true },
    { key: 'value', header: 'Account value', align: 'right', render: (row) => <MoneyCell value={row.account_value} /> },
    { key: 'health', header: 'Health', render: (row) => <HealthChip score={row.health_score} /> },
    { key: 'owner', header: 'Owner', render: (row) => <UserCell user={row.owner} /> },
    { key: 'touched', header: 'Last interaction', render: (row) => <span className="text-2xs text-ink-subtle">{formatRelative(row.last_interaction_at)}</span>, hideOnMobile: true },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="xs" variant="ghost" onClick={() => navigate(`/app/customers/${row.id}`)}>
            Open
          </Button>
          <Button size="xs" variant="ghost" onClick={() => openEdit(row)}>
            Edit
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
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Customers</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {formatNumber(counts.all ?? 0)} accounts · converted from won leads
          </p>
        </div>
        <Button leftIcon={Plus} onClick={openCreate}>
          New customer
        </Button>
      </div>

      <Card className="mt-4 p-3 sm:p-4">
        <FilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search company, contact, email or reference"
        >
          <SelectMenu
            value={industry}
            onChange={(value) => {
              setIndustry(value);
              setPage(1);
            }}
            options={CUSTOMER_INDUSTRIES.map((item) => ({ value: item, label: item }))}
            allLabel="Any industry"
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
            options={SORTABLE.map((option) => ({ value: option.value, label: option.label }))}
            allLabel="Highest value"
          />
          {activeFilters ? (
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
            options={CUSTOMER_STATUSES.map((item) => ({ value: item, label: titleCase(item) }))}
          />
        </div>
      </Card>

      {rows.length && !loading ? (
        <Card className="mt-4 p-4">
          <MiniStatGrid>
            <MiniStat label="Accounts on page" value={formatNumber(rows.length)} icon={Building2} tone="brand" />
            <MiniStat label="Combined value" value={formatCurrency(totals.value)} icon={HeartPulse} tone="success" />
            <MiniStat label="Average health" value={`${totals.avgHealth}/100`} tone="info" />
            <MiniStat label="At risk" value={formatNumber(totals.atRisk)} tone="danger" />
          </MiniStatGrid>
        </Card>
      ) : null}

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          onRetry={refetch}
          onRowClick={(row) => navigate(`/app/customers/${row.id}`)}
          emptyTitle="No customers found"
          emptyDescription={
            activeFilters
              ? 'No account matches the current filters.'
              : 'Convert a won lead, or add an account manually.'
          }
          emptyAction={
            activeFilters ? (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : (
              <Button size="sm" leftIcon={Plus} onClick={openCreate}>
                New customer
              </Button>
            )
          }
        />
      </div>

      <Pagination meta={meta?.pagination} onPageChange={setPage} onPageSizeChange={() => {}} />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.reference}` : 'New customer'}
        description={editing ? 'Status changes refresh the last-interaction timestamp.' : 'A reference number is assigned automatically.'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Save changes' : 'Create customer'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} noValidate>
          <FormGrid>
            <Input label="Company" required value={form.company} onChange={update('company')} error={fieldErrors.company} />
            <Input label="Contact name" required value={form.name} onChange={update('name')} error={fieldErrors.name} />
            <Input label="Email" type="email" value={form.email} onChange={update('email')} error={fieldErrors.email} />
            <Input label="Phone" value={form.phone} onChange={update('phone')} error={fieldErrors.phone} />
            <Select
              label="Industry"
              value={form.industry}
              onChange={update('industry')}
              options={CUSTOMER_INDUSTRIES.map((item) => ({ value: item, label: item }))}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={update('status')}
              options={CUSTOMER_STATUSES.map((item) => ({ value: item, label: titleCase(item) }))}
            />
            <Input
              label="Account value"
              type="number"
              min="0"
              step="1000"
              placeholder="750000"
              value={form.account_value}
              onChange={update('account_value')}
              error={fieldErrors.account_value}
            />
            <Input
              label="Health score"
              type="number"
              min="0"
              max="100"
              value={form.health_score}
              onChange={update('health_score')}
              error={fieldErrors.health_score}
              hint="0–100. Below 60 counts as at risk."
            />
            <FormRow>
              <Select
                label="Account owner"
                value={form.owner_id}
                onChange={update('owner_id')}
                placeholder="Unassigned"
                options={ownerOptions}
                error={fieldErrors.owner_id}
              />
            </FormRow>
            <FormRow>
              <Textarea label="Notes" rows={3} value={form.notes} onChange={update('notes')} error={fieldErrors.notes} />
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
        message={deleting ? `${deleting.company} will be permanently removed. Linked leads are kept but unlinked.` : ''}
        confirmLabel="Delete customer"
      />
    </PageContainer>
  );
}