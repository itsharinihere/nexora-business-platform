import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  Clock,
  HeartPulse,
  Mail,
  PenLine,
  Phone,
  Target,
  Trash2,
  User,
  Users,
} from 'lucide-react';

import { PageContainer } from '../components/layout/Topbar';
import { Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { DetailList, DetailRow, Timeline } from '../components/ui/Layout';
import { ScoreRing } from '../components/ui/Progress';
import { ErrorState } from '../components/ui/StateBlock';
import { Skeleton } from '../components/ui/Skeleton';
import { MoneyCell, StatusBadge, UserCell } from '../components/records/RecordBits';
import { errorMessage } from '../services/api';
import { customerService, teamService } from '../services/endpoints';
import { CUSTOMER_INDUSTRIES, CUSTOMER_STATUSES, customerStatusMeta, healthTone } from '../utils/constants';
import { formatDateTime, formatRelative } from '../utils/formatters';
import { useApi, useDocumentTitle } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function CustomerDetail() {
  useDocumentTitle('Customer detail');
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isManager } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirming, setConfirming] = useState(null);

  const { data, loading, error, refetch } = useApi(() => customerService.get(id), {
    deps: [id],
    onSuccess: (result) => {
      if (!form) {
        const customer = result.customer;
        setForm({
          name: customer.name,
          company: customer.company ?? '',
          email: customer.email ?? '',
          phone: customer.phone ?? '',
          industry: customer.industry,
          status: customer.status,
          account_value: customer.account_value ?? '',
          owner_id: customer.owner_id ? String(customer.owner_id) : '',
          notes: customer.notes ?? '',
        });
      }
    },
  });

  const teamQuery = useApi(() => teamService.list({}), []);
  const ownerOptions = (teamQuery.data?.members ?? []).map((member) => ({ value: String(member.id), label: member.name }));

  if (loading && !data) {
    return (
      <PageContainer>
        <Card className="p-4 sm:p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-3 h-4 w-1/2" />
          <Skeleton className="mt-3 h-40 w-full" />
        </Card>
      </PageContainer>
    );
  }

  if (error || !data?.customer) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={refetch} className="mt-6" />
      </PageContainer>
    );
  }

  const customer = data.customer;
  const activity = data.activity ?? [];
  const linkedLeads = data.linked_leads ?? [];

  const handleDelete = async () => {
    if (!confirming) return;
    setSaving(true);
    try {
      await customerService.remove(id);
      toast.success('Customer deleted', { title: customer.reference });
      navigate('/app/customers', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
      setConfirming(null);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      await customerService.update(id, {
        ...form,
        account_value: form.account_value || null,
        owner_id: form.owner_id || null,
      });
      toast.success('Customer updated', { title: customer.reference });
      setEditOpen(false);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
      if (err?.details && typeof err.details === 'object') setFieldErrors(err.details);
    } finally {
      setSaving(false);
    }
  };

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  return (
    <PageContainer>
      <button
        type="button"
        onClick={() => navigate('/app/customers')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to customers
      </button>

      <Card className="mt-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={customer.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{customer.company || customer.name}</h1>
                <StatusBadge type="customer" value={customer.status} />
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {customer.reference} · {customer.name}
                {customer.is_at_risk ? ' · needs attention' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ScoreRing score={customer.health_score} tone={healthTone(customer.health_score)} label="Health score" />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                leftIcon={PenLine}
                onClick={() => {
                  setForm({
                    name: customer.name,
                    company: customer.company ?? '',
                    email: customer.email ?? '',
                    phone: customer.phone ?? '',
                    industry: customer.industry,
                    status: customer.status,
                    account_value: customer.account_value ?? '',
                    owner_id: customer.owner_id ? String(customer.owner_id) : '',
                    notes: customer.notes ?? '',
                  });
                  setEditOpen(true);
                }}
              >
                Edit
              </Button>
              {isManager ? (
                <Button size="sm" variant="danger" leftIcon={Trash2} onClick={() => setConfirming(customer)}>
                  Delete
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink">Contact</h2>
          <div className="mt-2">
            <DetailList>
              <DetailRow label="Email" value={customer.email} icon={Mail} mono />
              <DetailRow label="Phone" value={customer.phone} icon={Phone} mono />
              <DetailRow label="Industry" value={customer.industry} icon={Briefcase} />
              <DetailRow label="Owner" value={<UserCell user={customer.owner} />} icon={User} />
            </DetailList>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">Account</h2>
          <div className="mt-2">
            <DetailList>
              <DetailRow label="Value" value={<MoneyCell value={customer.account_value} />} className="nums" />
              <DetailRow label="Health" value={`${customer.health_score} / 100`} icon={HeartPulse} className="nums" />
              <DetailRow label="Last interaction" value={customer.last_interaction_at ? formatRelative(customer.last_interaction_at) : '—'} icon={Clock} />
              <DetailRow label="Created" value={formatDateTime(customer.created_at)} icon={CalendarDays} />
            </DetailList>
          </div>
        </Card>
      </div>

      {customer.notes ? (
        <Card className="mt-4 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{customer.notes}</p>
        </Card>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Linked leads</h2>
          </div>
          {linkedLeads.length ? (
            <ul className="mt-3 divide-y divide-line/70">
              {linkedLeads.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/leads/${lead.id}`)}
                    className="flex w-full items-center justify-between gap-3 rounded px-1 py-2.5 text-left transition hover:bg-sunken/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{lead.name}</span>
                      <span className="block truncate text-2xs text-ink-subtle">{lead.reference} · {lead.company}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <MoneyCell value={lead.expected_value} />
                      <StatusBadge type="lead" value={lead.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-subtle">No open leads linked to this account.</p>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Account history</h2>
          </div>
          <div className="mt-3">
            <Timeline
              items={activity.map((entry) => ({
                id: entry.id,
                title: entry.description,
                timestamp: formatRelative(entry.created_at),
              }))}
              emptyLabel="No activity recorded for this account yet."
            />
          </div>
        </Card>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit ${customer.reference}`}
        description="Account details are shared across leads, tasks and support."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4">
            <Input label="Contact name" required value={form?.name} onChange={update('name')} error={fieldErrors.name} />
            <Input label="Company" value={form?.company} onChange={update('company')} error={fieldErrors.company} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Email" type="email" value={form?.email} onChange={update('email')} error={fieldErrors.email} />
              <Input label="Phone" value={form?.phone} onChange={update('phone')} error={fieldErrors.phone} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Industry"
                value={form?.industry}
                onChange={update('industry')}
                placeholder="Select industry"
                options={CUSTOMER_INDUSTRIES.map((item) => ({ value: item, label: item }))}
              />
              <Select
                label="Status"
                value={form?.status}
                onChange={update('status')}
                options={CUSTOMER_STATUSES.map((item) => ({ value: item, label: customerStatusMeta(item).label }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Account value"
                type="number"
                min="0"
                value={form?.account_value}
                onChange={update('account_value')}
                error={fieldErrors.account_value}
              />
              <Select
                label="Owner"
                value={form?.owner_id}
                onChange={update('owner_id')}
                placeholder="Unassigned"
                options={ownerOptions}
                error={fieldErrors.owner_id}
              />
            </div>
            <Textarea label="Notes" rows={4} value={form?.notes} onChange={update('notes')} error={fieldErrors.notes} />
          </div>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        onConfirm={handleDelete}
        loading={saving}
        title={`Delete ${confirming?.reference}?`}
        message={confirming ? `"${confirming.company}" and all linked records will be removed.` : ''}
        confirmLabel="Delete customer"
      />
    </PageContainer>
  );
}