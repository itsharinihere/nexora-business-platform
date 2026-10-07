import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock,
  Mail,
  PenLine,
  Phone,
  PhoneCall,
  Tag,
  Trash2,
  User,
  UserCheck,
} from 'lucide-react';

import { PageContainer } from '../components/layout/Topbar';
import { Badge, Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { DetailList, DetailRow, FormGrid, FormRow } from '../components/ui/Layout';
import { ErrorState } from '../components/ui/StateBlock';
import { Skeleton } from '../components/ui/Skeleton';
import { PriorityPill, Reference, StatusBadge, UserCell } from '../components/records/RecordBits';
import { errorMessage } from '../services/api';
import { leadService, teamService } from '../services/endpoints';
import { LEAD_PRIORITIES, LEAD_SOURCES, LEAD_STATUSES, leadStatusMeta, priorityMeta, sourceLabel } from '../utils/constants';
import { formatCurrency, formatDateTime, formatRelative } from '../utils/formatters';
import { useApi, useDocumentTitle } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LeadDetail() {
  useDocumentTitle('Lead detail');
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isManager } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, refetch } = useApi(() => leadService.get(id), {
    deps: [id],
    onSuccess: (result) => {
      if (!form) {
        const lead = result.lead;
        setForm({
          name: lead.name,
          company: lead.company ?? '',
          email: lead.email ?? '',
          phone: lead.phone ?? '',
          source: lead.source,
          status: lead.status,
          priority: lead.priority,
          expected_value: lead.expected_value ?? '',
          owner_id: lead.owner_id ? String(lead.owner_id) : '',
          notes: lead.notes ?? '',
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

  if (error || !data?.lead) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={refetch} className="mt-6" />
      </PageContainer>
    );
  }

  const lead = data.lead;

  const handleContact = async () => {
    setBusy(true);
    try {
      await leadService.logContact(id);
      toast.success('Contact logged', { title: lead.reference });
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConvert = async () => {
    setBusy(true);
    try {
      const result = await leadService.convert(id);
      toast.success('Lead converted to a customer', { title: result.customer.reference });
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirming) return;
    setSaving(true);
    try {
      await leadService.remove(id);
      toast.success('Lead deleted', { title: lead.reference });
      navigate('/app/leads', { replace: true });
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
      await leadService.update(id, { ...form, expected_value: form.expected_value || null, owner_id: form.owner_id || null });
      toast.success('Lead updated', { title: lead.reference });
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
        onClick={() => navigate('/app/leads')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to leads
      </button>

      <Card className="mt-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={lead.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{lead.name}</h1>
                <StatusBadge type="lead" value={lead.status} />
                <PriorityPill priority={lead.priority} />
                {lead.is_stale ? <Badge tone="danger">Stale</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                <Reference value={lead.reference} /> · {lead.company || 'No company'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {lead.is_open ? (
              <Button size="sm" variant="secondary" leftIcon={PhoneCall} onClick={handleContact} loading={busy}>
                Log contact
              </Button>
            ) : null}
            {lead.status === 'won' && !lead.customer_id ? (
              <Button size="sm" leftIcon={UserCheck} onClick={handleConvert} loading={busy}>
                Convert to customer
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              leftIcon={PenLine}
              onClick={() => {
                const current = form ?? lead;
                setForm({
                  name: current.name,
                  company: current.company ?? '',
                  email: current.email ?? '',
                  phone: current.phone ?? '',
                  source: current.source,
                  status: current.status,
                  priority: current.priority,
                  expected_value: current.expected_value ?? '',
                  owner_id: current.owner_id ? String(current.owner_id) : '',
                  notes: current.notes ?? '',
                });
                setEditOpen(true);
              }}
            >
              Edit
            </Button>
            {isManager ? (
              <Button size="sm" variant="danger" leftIcon={Trash2} onClick={() => setConfirming(lead)}>
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink">Contact</h2>
          <div className="mt-2">
            <DetailList>
              <DetailRow label="Email" value={lead.email} icon={Mail} mono />
              <DetailRow label="Phone" value={lead.phone} icon={Phone} mono />
              <DetailRow label="Company" value={lead.company} icon={Building2} />
              <DetailRow label="Source" value={sourceLabel(lead.source)} icon={Tag} />
              <DetailRow label="Owner" icon={User} value={<UserCell user={lead.owner} />} />
            </DetailList>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">Stage</h2>
          <div className="mt-2">
            <DetailList>
              <DetailRow label="Value" value={formatCurrency(lead.expected_value)} className="nums" />
              <DetailRow label="Last contacted" value={lead.last_contacted_at ? formatRelative(lead.last_contacted_at) : 'Never'} icon={Clock} />
              <DetailRow label="Created" value={formatDateTime(lead.created_at)} icon={CalendarDays} />
              <DetailRow label="Updated" value={lead.updated_at ? formatRelative(lead.updated_at) : '—'} icon={CalendarDays} />
            </DetailList>
          </div>
        </Card>
      </div>

      {lead.customer_id && lead.customer ? (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <p className="text-sm font-semibold text-ink">Customer account</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              This lead was converted and is linked to a live account.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/app/customers/${lead.customer.id}`)}>
            Open {lead.customer.reference}
          </Button>
        </Card>
      ) : null}

      {lead.notes ? (
        <Card className="mt-4 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{lead.notes}</p>
        </Card>
      ) : null}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit ${lead.reference}`}
        description="Keep the pipeline accurate as the opportunity moves."
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
          <FormGrid>
            <FormRow>
              <Input label="Name" required value={form?.name} onChange={update('name')} error={fieldErrors.name} />
            </FormRow>
            <Input label="Company" value={form?.company} onChange={update('company')} error={fieldErrors.company} />
            <Input label="Email" type="email" value={form?.email} onChange={update('email')} error={fieldErrors.email} />
            <Input label="Phone" value={form?.phone} onChange={update('phone')} error={fieldErrors.phone} />
            <Select
              label="Status"
              value={form?.status}
              onChange={update('status')}
              options={LEAD_STATUSES.map((item) => ({ value: item, label: leadStatusMeta(item).label }))}
            />
            <Input
              label="Expected value"
              type="number"
              min="0"
              value={form?.expected_value}
              onChange={update('expected_value')}
              error={fieldErrors.expected_value}
            />
            <Select
              label="Priority"
              value={form?.priority}
              onChange={update('priority')}
              options={LEAD_PRIORITIES.map((item) => ({ value: item, label: priorityMeta(item).label }))}
            />
            <Select
              label="Source"
              value={form?.source}
              onChange={update('source')}
              options={LEAD_SOURCES.map((item) => ({ value: item, label: sourceLabel(item) }))}
            />
            <Select
              label="Owner"
              value={form?.owner_id}
              onChange={update('owner_id')}
              placeholder="Unassigned"
              options={ownerOptions}
              error={fieldErrors.owner_id}
            />
            <FormRow>
              <Textarea
                label="Notes"
                rows={4}
                value={form?.notes}
                onChange={update('notes')}
                error={fieldErrors.notes}
              />
            </FormRow>
          </FormGrid>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        onConfirm={handleDelete}
        loading={saving}
        title={`Delete ${confirming?.reference}?`}
        message={confirming ? `"${confirming.name}" and its history will be permanently removed.` : ''}
        confirmLabel="Delete lead"
      />
    </PageContainer>
  );
}