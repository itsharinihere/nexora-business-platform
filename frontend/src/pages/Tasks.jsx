import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { List, Plus, RotateCcw, Trash2 } from 'lucide-react';

import { PageContainer } from '../components/layout/Topbar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { FilterBar, SegmentedControl, StatusTabs } from '../components/ui/FilterBar';
import { SelectMenu } from '../components/ui/Dropdown';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { FormGrid, FormRow } from '../components/ui/Layout';
import { DueDateChip, PriorityPill, RecordTitle, Reference, StatusBadge, UserCell } from '../components/records/RecordBits';
import { Avatar } from '../components/ui/Avatar';
import { ProgressBar } from '../components/ui/Progress';
import { ErrorState } from '../components/ui/StateBlock';
import { errorMessage } from '../services/api';
import { taskService, teamService } from '../services/endpoints';
import { TASK_PRIORITIES, TASK_STATUSES, taskStatusMeta } from '../utils/constants';
import { formatNumber, formatRelative } from '../utils/formatters';
import { useApi, useDebounce } from '../hooks';
import { useToast } from '../context/ToastContext';

const EMPTY_FORM = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  assignee_id: '',
  due_date: '',
};

const titleCase = (value) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Tasks() {
  const [searchParams] = useSearchParams();

  const [view, setView] = useState('board');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('due') ? 'all' : 'all');
  const [priority, setPriority] = useState(searchParams.get('priority') || 'all');
  const [assignee, setAssignee] = useState(searchParams.get('assignee') || 'all');
  const [due, setDue] = useState(searchParams.get('due') || 'all');
  const [overdue, setOverdue] = useState(searchParams.get('overdue') === 'true');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const toast = useToast();
  const debouncedSearch = useDebounce(search, 350);

  const { data: team } = useApi(() => teamService.list({}), []);
  const assigneeOptions = (team?.members ?? []).map((member) => ({ value: String(member.id), label: member.name }));

  const listQuery = useApi(
    () =>
      taskService.list({
        search: debouncedSearch,
        status,
        priority,
        assignee,
        due: due === 'all' ? undefined : due,
        overdue: overdue ? 'true' : undefined,
        page,
        per_page: 20,
      }),
    [debouncedSearch, status, priority, assignee, due, overdue, page],
    { enabled: view === 'list' },
  );

  const boardQuery = useApi(
    () => taskService.board({ assignee: assignee === 'all' ? undefined : assignee }),
    [assignee],
    { enabled: view === 'board' },
  );

  const counts = view === 'list' ? (listQuery.meta?.counts ?? {}) : (boardQuery.data?.counts ?? {});

  const updateStatus = async (task, nextStatus) => {
    try {
      await taskService.update(task.id, { status: nextStatus });
      toast.success(`Moved to ${taskStatusMeta(nextStatus).label}`);
      boardQuery.refetch();
      listQuery.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const removeTask = async (task) => {
    try {
      await taskService.remove(task.id);
      toast.success('Task deleted', { title: task.reference });
      setDeleting(null);
      boardQuery.refetch();
      listQuery.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const openCreate = (status = 'todo') => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, status });
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEdit = (task) => {
    setEditing(task);
    setForm({
      title: task.title ?? '',
      description: task.description ?? '',
      status: task.status ?? 'todo',
      priority: task.priority ?? 'medium',
      assignee_id: task.assignee_id ? String(task.assignee_id) : '',
      due_date: task.due_date ?? '',
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
      assignee_id: form.assignee_id || null,
      due_date: form.due_date || null,
    };

    try {
      if (editing) {
        await taskService.update(editing.id, payload);
        toast.success('Task updated', { title: payload.title });
      } else {
        await taskService.create(payload);
        toast.success('Task created', { title: payload.title });
      }
      setFormOpen(false);
      boardQuery.refetch();
      listQuery.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
      if (err?.details && typeof err.details === 'object') setFieldErrors(err.details);
    } finally {
      setSaving(false);
    }
  };

  const activeFilters =
    [
      priority !== 'all',
      assignee !== 'all',
      due !== 'all',
      overdue,
      debouncedSearch,
    ].filter(Boolean).length > 0;

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setPriority('all');
    setAssignee('all');
    setDue('all');
    setOverdue(false);
    setPage(1);
  };

  const columns = [
    {
      key: 'task',
      header: 'Task',
      primary: true,
      render: (task) => (
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sunken text-2xs font-semibold text-ink-muted">
            {task.reference?.split('-').pop()}
          </span>
          <RecordTitle primary={task.title} secondary={task.description} />
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (task) => <StatusBadge type="task" value={task.status} /> },
    { key: 'priority', header: 'Priority', render: (task) => <PriorityPill priority={task.priority} /> },
    {
      key: 'due',
      header: 'Due',
      render: (task) => (
        <DueDateChip
          value={task.due_date}
          isOverdue={task.is_overdue}
          completed={task.status === 'completed'}
        />
      ),
    },
    { key: 'assignee', header: 'Assignee', render: (task) => <UserCell user={task.assignee} /> },
    { key: 'updated', header: 'Updated', render: (task) => <span className="text-2xs text-ink-subtle">{formatRelative(task.updated_at)}</span>, hideOnMobile: true },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (task) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="xs" variant="ghost" onClick={() => openEdit(task)}>
            Edit
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setDeleting(task)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const boardColumns = boardQuery.data?.columns ?? [];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Tasks</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {formatNumber(counts.all ?? 0)} tasks · {formatNumber(counts.todo ?? 0)} to do
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: 'board', label: 'Board' },
              { value: 'list', label: 'List' },
            ]}
          />
          <Button leftIcon={Plus} onClick={() => openCreate()}>
            New task
          </Button>
        </div>
      </div>

      <Card className="mt-4 p-3 sm:p-4">
        {view === 'list' ? (
          <StatusTabs
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            counts={counts}
            options={TASK_STATUSES.map((item) => ({ value: item, label: taskStatusMeta(item).label }))}
          />
        ) : null}

        <div className={view === 'list' ? 'mt-3' : ''}>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search title, description or reference"
          >
            <SelectMenu
              value={priority}
              onChange={setPriority}
              options={TASK_PRIORITIES.map((item) => ({ value: item, label: titleCase(item) }))}
              allLabel="Any priority"
            />
            <SelectMenu
              value={assignee}
              onChange={setAssignee}
              options={[{ value: 'me', label: 'Assigned to me' }, ...assigneeOptions]}
              allLabel="Anyone"
            />
            {view === 'list' ? (
              <>
                <SelectMenu
                  value={due}
                  onChange={setDue}
                  options={[
                    { value: 'today', label: 'Due today' },
                    { value: 'week', label: 'Due this week' },
                  ]}
                  allLabel="Any due date"
                />
                <Button
                  size="sm"
                  variant={overdue ? 'primary' : 'secondary'}
                  onClick={() => setOverdue((v) => !v)}
                >
                  Overdue only
                </Button>
              </>
            ) : null}
            {activeFilters ? (
              <Button size="sm" variant="ghost" leftIcon={RotateCcw} onClick={resetFilters}>
                Reset
              </Button>
            ) : null}
          </FilterBar>
        </div>
      </Card>

      {view === 'board' ? (
        <BoardView
          columns={boardColumns}
          counts={counts}
          loading={boardQuery.loading}
          error={boardQuery.error}
          onRetry={boardQuery.refetch}
          onEdit={openEdit}
          onDelete={setDeleting}
          onMove={updateStatus}
          onCreate={openCreate}
        />
      ) : (
        <>
          <div className="mt-4">
            <DataTable
              columns={columns}
              rows={listQuery.data ?? []}
              loading={listQuery.loading}
              error={listQuery.error}
              onRetry={listQuery.refetch}
              emptyTitle="No tasks found"
              emptyDescription={
                activeFilters ? 'No task matches the current filters.' : 'Create a task to get started.'
              }
              emptyAction={
                activeFilters ? (
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" leftIcon={Plus} onClick={() => openCreate()}>
                    New task
                  </Button>
                )
              }
            />
          </div>
          <Pagination meta={listQuery.meta?.pagination} onPageChange={setPage} onPageSizeChange={() => {}} />
        </>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.reference}` : 'New task'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Save changes' : 'Create task'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} noValidate>
          <FormGrid>
            <FormRow>
              <Input label="Title" required value={form.title} onChange={update('title')} error={fieldErrors.title} />
            </FormRow>
            <FormRow>
              <Textarea
                label="Description"
                rows={3}
                value={form.description}
                onChange={update('description')}
                error={fieldErrors.description}
              />
            </FormRow>
            <Select
              label="Status"
              value={form.status}
              onChange={update('status')}
              options={TASK_STATUSES.map((item) => ({ value: item, label: taskStatusMeta(item).label }))}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={update('priority')}
              options={TASK_PRIORITIES.map((item) => ({ value: item, label: titleCase(item) }))}
            />
            <Input label="Due date" type="date" value={form.due_date ?? ''} onChange={update('due_date')} error={fieldErrors.due_date} />
            <Select
              label="Assignee"
              value={form.assignee_id}
              onChange={update('assignee_id')}
              placeholder="Unassigned"
              options={assigneeOptions}
              error={fieldErrors.assignee_id}
            />
          </FormGrid>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => removeTask(deleting)}
        title={`Delete ${deleting?.reference}?`}
        message={deleting ? `"${deleting.title}" will be permanently removed.` : ''}
        confirmLabel="Delete task"
      />
    </PageContainer>
  );
}

/**
 * Kanban board.
 *
 * Cards move between columns by calling `onMove` with the target status; the
 * API records the change and the board refetches so ordering stays correct.
 */
function BoardView({ columns, counts = {}, loading, error, onRetry, onEdit, onDelete, onMove, onCreate }) {
  const openTotal = useMemo(() => columns.reduce((sum, column) => sum + column.count, 0), [columns]);

  // Completed tasks live outside the board columns, so the ratio comes from the
  // status counts the API returns with the board payload.
  const total = counts.all ?? 0;
  const donePercent = total ? Math.round(((counts.completed ?? 0) / total) * 100) : 0;

  if (error) {
    return (
      <Card className="mt-4 p-4">
        <ErrorState error={error} onRetry={onRetry} />
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="nx-panel p-3">
            <div className="nx-skeleton h-3 w-24" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }).map((__, i) => (
                <div key={i} className="nx-card space-y-2 p-3">
                  <div className="nx-skeleton h-3 w-3/4" />
                  <div className="nx-skeleton h-2.5 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          {formatNumber(openTotal)} open · {formatNumber(counts.completed ?? 0)} completed
        </p>
        <div className="hidden w-40 sm:block">
          <ProgressBar value={donePercent} tone="success" showLabel />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {columns.map((column) => (
          <section key={column.status} className="nx-panel flex flex-col p-3">
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">{taskStatusMeta(column.status).label}</h2>
              <span className="nums rounded-full bg-sunken px-2 py-0.5 text-2xs font-medium text-ink-muted">
                {column.count}
              </span>
            </header>

            <div className="space-y-2">
              {column.tasks.length ? (
                column.tasks.map((task) => (
                  <article key={task.id} className="nx-card nx-card-hover p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(task)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="line-clamp-2 text-sm font-medium text-ink">{task.title}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(task)}
                        aria-label={`Delete ${task.reference}`}
                        className="shrink-0 rounded p-1 text-ink-subtle transition hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <PriorityPill priority={task.priority} />
                      <DueDateChip
                        value={task.due_date}
                        isOverdue={task.is_overdue}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Reference value={task.reference} />
                      {task.assignee ? (
                        <Avatar name={task.assignee.name} size="xs" />
                      ) : (
                        <span className="text-2xs italic text-ink-subtle">Unassigned</span>
                      )}
                    </div>

                    {/* Move controls: explicit buttons rather than drag-and-drop,
                        which keeps the board usable on touch and with a keyboard. */}
                    <div className="mt-2.5 flex gap-1">
                      {TASK_STATUSES.filter((option) => option !== 'completed' && option !== column.status)
                        .slice(0, 2)
                        .map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => onMove(task, option)}
                            className="flex-1 rounded-md border border-line px-1.5 py-1 text-2xs font-medium text-ink-muted transition hover:bg-sunken hover:text-ink"
                          >
                            {taskStatusMeta(option).label}
                          </button>
                        ))}
                      {column.status !== 'completed' ? (
                        <button
                          type="button"
                          onClick={() => onMove(task, 'completed')}
                          className="flex-1 rounded-md border border-line px-1.5 py-1 text-2xs font-medium text-ink-muted transition hover:bg-success-50 hover:text-success-700 dark:hover:bg-success-500/10"
                        >
                          Done
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => onCreate(column.status)}
                  className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-line px-3 py-6 text-2xs text-ink-subtle transition hover:border-line-strong hover:text-ink-muted"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add a task
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      {columns.length < 2 ? (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-subtle">
          <List className="h-3.5 w-3.5" aria-hidden="true" />
          Switch to the list view for status filtering.
        </div>
      ) : null}
    </div>
  );
}