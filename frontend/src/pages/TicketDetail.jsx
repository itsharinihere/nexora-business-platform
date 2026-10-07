import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlarmClock,
  ArrowLeft,
  CalendarDays,
  Clock,
  LifeBuoy,
  Mail,
  PenLine,
  Send,
  Trash2,
  User,
} from 'lucide-react';

import { PageContainer } from '../components/layout/Topbar';
import { Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { DetailList, DetailRow, Timeline } from '../components/ui/Layout';
import { ErrorState } from '../components/ui/StateBlock';
import { Skeleton } from '../components/ui/Skeleton';
import { AgeChip, PriorityPill, Reference, StatusBadge, UserCell } from '../components/records/RecordBits';
import { errorMessage } from '../services/api';
import { teamService, ticketService } from '../services/endpoints';
import { TICKET_CATEGORIES, TICKET_STATUSES, categoryLabel, priorityMeta, ticketStatusMeta } from '../utils/constants';
import { formatDateTime, formatHours, formatRelative } from '../utils/formatters';
import { useApi, useDocumentTitle } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function TicketDetail() {
  useDocumentTitle('Ticket detail');
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

  const { data, loading, error, refetch } = useApi(() => ticketService.get(id), {
    deps: [id],
    onSuccess: (result) => {
      if (!form) {
        const ticket = result.ticket;
        setForm({
          subject: ticket.subject,
          description: ticket.description ?? '',
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          assignee_id: ticket.assignee_id ? String(ticket.assignee_id) : '',
        });
      }
    },
  });

  const teamQuery = useApi(() => teamService.list({}), []);
  const assigneeOptions = (teamQuery.data?.members ?? []).map((member) => ({ value: String(member.id), label: member.name }));

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

  if (error || !data?.ticket) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={refetch} className="mt-6" />
      </PageContainer>
    );
  }

  const ticket = data.ticket;

  const handleRespond = async () => {
    setBusy(true);
    try {
      await ticketService.respond(id);
      toast.success('Response recorded', { title: ticket.reference });
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
      await ticketService.remove(id);
      toast.success('Ticket deleted', { title: ticket.reference });
      navigate('/app/support', { replace: true });
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
      await ticketService.update(id, { ...form, assignee_id: form.assignee_id || null });
      toast.success('Ticket updated', { title: ticket.reference });
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
        onClick={() => navigate('/app/support')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to support
      </button>

      {data.sla_breached ? (
        <Card className="mt-3 border-danger-500/30 bg-danger-50/70 p-4 dark:bg-danger-500/10">
          <div className="flex items-start gap-3">
            <AlarmClock className="mt-0.5 h-4 w-4 shrink-0 text-danger-600 dark:text-danger-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-danger-700 dark:text-danger-400">SLA breached</p>
              <p className="mt-0.5 text-xs text-danger-700/80 dark:text-danger-400/80">
                This ticket has been open for {formatHours(ticket.age_hours)} — well past the {formatHours(data.sla_target_hours)} target for its priority.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="mt-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400">
              <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{ticket.subject}</h1>
                <StatusBadge type="ticket" value={ticket.status} />
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                <Reference value={ticket.reference} /> · {categoryLabel(ticket.category)} ·{' '}
                {ticket.requester_name}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <PriorityPill priority={ticket.priority} />
            {ticket.is_open ? (
              <Button size="sm" variant="secondary" leftIcon={Send} onClick={handleRespond} loading={busy}>
                Log response
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              leftIcon={PenLine}
              onClick={() => {
                setForm({
                  subject: ticket.subject,
                  description: ticket.description ?? '',
                  category: ticket.category,
                  priority: ticket.priority,
                  status: ticket.status,
                  assignee_id: ticket.assignee_id ? String(ticket.assignee_id) : '',
                });
                setEditOpen(true);
              }}
            >
              Edit
            </Button>
            {isManager ? (
              <Button size="sm" variant="danger" leftIcon={Trash2} onClick={() => setConfirming(ticket)}>
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {ticket.description ? (
        <Card className="mt-4 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{ticket.description}</p>
        </Card>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink">SLA & timing</h2>
          <div className="mt-2">
            <DetailList>
              <DetailRow
                label="Age"
                value={<AgeChip hours={ticket.age_hours} breached={data.sla_breached} />}
                icon={Clock}
              />
              <DetailRow label="SLA target" value={`${formatHours(data.sla_target_hours)} for ${priorityMeta(ticket.priority).label}`} icon={AlarmClock} />
              <DetailRow label="First response" value={ticket.first_response_at ? formatRelative(ticket.first_response_at) : 'None yet'} icon={Send} />
              <DetailRow label="Resolved" value={ticket.resolved_at ? formatRelative(ticket.resolved_at) : '—'} icon={CalendarDays} />
              <DetailRow label="Created" value={formatDateTime(ticket.created_at)} icon={CalendarDays} />
              <DetailRow label="Updated" value={ticket.updated_at ? formatRelative(ticket.updated_at) : '—'} icon={CalendarDays} />
            </DetailList>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">People</h2>
          <div className="mt-2">
            <DetailList>
              <DetailRow label="Requester" value={<UserCell user={{ name: ticket.requester_name, email: ticket.requester_email }} />} icon={User} />
              <DetailRow label="Assignee" value={<UserCell user={ticket.assignee} />} icon={User} />
            </DetailList>
          </div>
          {ticket.requester_email ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={Mail}
              className="mt-3"
              onClick={() => {
                window.location.href = `mailto:${ticket.requester_email}`;
              }}
            >
              Email requester
            </Button>
          ) : null}
        </Card>
      </div>

      <Card className="mt-4 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-ink">Timeline</h2>
        <div className="mt-3">
          <Timeline
            items={(data.activity ?? []).map((entry) => ({
              id: entry.id,
              title: entry.description,
              timestamp: formatRelative(entry.created_at),
            }))}
            emptyLabel="No activity recorded for this ticket yet."
          />
        </div>
      </Card>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit ${ticket.reference}`}
        description="Assignee, priority and category affect the SLA clock."
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
            <Input label="Subject" required value={form?.subject} onChange={update('subject')} error={fieldErrors.subject} />
            <Textarea label="Description" rows={4} value={form?.description} onChange={update('description')} error={fieldErrors.description} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Status"
                value={form?.status}
                onChange={update('status')}
                options={TICKET_STATUSES.map((item) => ({ value: item, label: ticketStatusMeta(item).label }))}
              />
              <Select
                label="Priority"
                value={form?.priority}
                onChange={update('priority')}
                options={['low', 'medium', 'high', 'critical'].map((item) => ({ value: item, label: priorityMeta(item).label }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Category"
                value={form?.category}
                onChange={update('category')}
                options={TICKET_CATEGORIES.map((item) => ({ value: item, label: categoryLabel(item) }))}
              />
              <Select
                label="Assignee"
                value={form?.assignee_id}
                onChange={update('assignee_id')}
                placeholder="Unassigned"
                options={assigneeOptions}
                error={fieldErrors.assignee_id}
              />
            </div>
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
        message={confirming ? `"${confirming.subject}" and its history will be permanently removed.` : ''}
        confirmLabel="Delete ticket"
      />
    </PageContainer>
  );
}