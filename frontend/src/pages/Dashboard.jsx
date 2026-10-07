import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  LifeBuoy,
  ListChecks,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  UserX,
} from 'lucide-react';

import { PageContainer } from '../components/layout/Topbar';
import { AttentionRow, MiniStat, MiniStatGrid, StatCard } from '../components/dashboard/StatCard';
import { LeadTrendChart, BreakdownChart, TaskCompletionChart } from '../components/charts/Charts';
import { ChartCard, ChartStat } from '../components/charts/ChartPrimitives';
import { InsightList } from '../components/insights/InsightCard';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, Badge } from '../components/ui/Badge';
import { EmptyState, ErrorState } from '../components/ui/StateBlock';
import { Skeleton, SkeletonStat } from '../components/ui/Skeleton';
import { PriorityPill } from '../components/records/RecordBits';
import {
  formatCompactCurrency,
  formatCurrency,
  formatDueDate,
  formatNumber,
  formatPercent,
  formatRelative,
  formatWeekday,
} from '../utils/formatters';
import { taskStatusMeta } from '../utils/constants';
import { dashboardService } from '../services/endpoints';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks';

export default function Dashboard() {
  useDocumentTitle('Dashboard');

  const { user } = useAuth();
  const { data, loading, error, refetch } = useApi(
    () => dashboardService.get(),
    [],
  );

  const greeting = useMemo(() => {
    const name = user?.name?.split(' ')[0] ?? 'there';
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return `${part}, ${name}`;
  }, [user]);

  if (error) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={refetch} />
      </PageContainer>
    );
  }

  const stats = data?.stats ?? {};
  const charts = data?.charts ?? {};
  const attention = data?.attention ?? {};
  const funnel = charts.lead_funnel ?? {};
  const support = charts.support_metrics ?? {};

  const attentionItems = [
    {
      key: 'overdue_tasks',
      label: 'Overdue tasks',
      value: attention.overdue_tasks,
      icon: CalendarClock,
      tone: 'danger',
      description: 'Past their due date',
      to: '/app/tasks?overdue=true',
    },
    {
      key: 'due_today',
      label: 'Due today',
      value: attention.due_today,
      icon: ListChecks,
      tone: 'warning',
      description: 'Scheduled to close today',
      to: '/app/tasks?due=today',
    },
    {
      key: 'open_tickets',
      label: 'Open tickets',
      value: attention.open_tickets,
      icon: LifeBuoy,
      tone: 'info',
      description: 'Awaiting resolution',
      to: '/app/support',
    },
    {
      key: 'unassigned_tickets',
      label: 'Unassigned tickets',
      value: attention.unassigned_tickets,
      icon: UserX,
      tone: 'warning',
      description: 'Nobody owns these yet',
      to: '/app/support?assignee=unassigned',
    },
    {
      key: 'stale_leads',
      label: 'Stale leads',
      value: attention.stale_leads,
      icon: Target,
      tone: 'warning',
      description: 'No contact in 14 days',
      to: '/app/leads?stale=true',
    },
    {
      key: 'at_risk_customers',
      label: 'At-risk customers',
      value: attention.at_risk_customers,
      icon: Building2,
      tone: 'danger',
      description: 'Health below 60',
      to: '/app/customers?status=at_risk',
    },
    {
      key: 'unassigned_tasks',
      label: 'Unassigned tasks',
      value: attention.unassigned_tasks,
      icon: UserX,
      tone: 'neutral',
      description: 'Visible to everyone',
      to: '/app/tasks?assignee=unassigned',
    },
    {
      key: 'high_priority_tasks',
      label: 'High priority',
      value: attention.high_priority_tasks,
      icon: AlertTriangle,
      tone: 'danger',
      description: 'High or critical',
      to: '/app/tasks?priority=high',
    },
  ].filter((item) => Number(item.value) > 0);

  return (
    <PageContainer>
      {/* Greeting */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-subtle">{formatWeekday(new Date())}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {loading ? 'Loading your dashboard…' : greeting}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {data?.greeting?.my_open_tasks
              ? `${formatNumber(data.greeting.my_open_tasks)} open tasks assigned to you.`
              : 'You have no open tasks assigned.'}
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          leftIcon={RefreshCw}
          onClick={refetch}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      {/* KPI row */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, index) => <SkeletonStat key={index} />)
        ) : (
          <>
            <StatCard
              label="Open leads"
              value={formatNumber(stats.open_leads ?? 0)}
              icon={Target}
              tone="brand"
              hint={`${formatNumber(stats.total_leads ?? 0)} total`}
              to="/app/leads"
            />
            <StatCard
              label="Pipeline value"
              value={formatCompactCurrency(stats.pipeline_value ?? 0)}
              icon={TrendingUp}
              tone="success"
              hint={`${formatCurrency(stats.won_value ?? 0)} won`}
              to="/app/leads"
            />
            <StatCard
              label="Pending tasks"
              value={formatNumber(stats.pending_tasks ?? 0)}
              icon={ListChecks}
              tone="warning"
              hint={`${formatNumber(stats.completed_tasks ?? 0)} completed`}
              to="/app/tasks"
            />
            <StatCard
              label="Open tickets"
              value={formatNumber(stats.open_tickets ?? 0)}
              icon={LifeBuoy}
              tone="danger"
              hint={`${formatNumber(stats.resolved_tickets ?? 0)} resolved`}
              to="/app/support"
            />
          </>
        )}
      </div>

      {/* Secondary stats */}
      <Card className="mt-3 p-4">
        <MiniStatGrid>
          <MiniStat
            label="Customers"
            value={formatNumber(stats.total_customers ?? 0)}
            tone="brand"
            icon={Building2}
          />
          <MiniStat
            label="Active customers"
            value={formatNumber(stats.active_customers ?? 0)}
            tone="success"
            icon={CheckCircle2}
          />
          <MiniStat
            label="Conversion rate"
            value={formatPercent(funnel.conversion_rate ?? 0)}
            tone="info"
            icon={TrendingUp}
          />
          <MiniStat
            label="Team size"
            value={formatNumber(stats.team_size ?? 0)}
            tone="neutral"
            icon={ActivityIcon}
          />
        </MiniStatGrid>
      </Card>

      {/* Charts */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Lead volume"
          subtitle="New leads and won value over the last 30 days"
          loading={loading && !data}
          className="xl:col-span-2"
          action={
            <Link
              to="/app/analytics"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:opacity-80 dark:text-brand-300"
            >
              Analytics
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          {charts.lead_trend ? (
            <>
              <div className="flex flex-wrap gap-6 px-2 pb-2 pt-1">
                <ChartStat label="New leads" value={formatNumber(charts.lead_trend.new_leads?.reduce((a, b) => a + b, 0) ?? 0)} />
                <ChartStat label="Won value" value={formatCompactCurrency(charts.lead_trend.won_value?.reduce((a, b) => a + b, 0) ?? 0)} />
              </div>
              <LeadTrendChart data={charts.lead_trend} height={230} />
            </>
          ) : null}
        </ChartCard>

        <ChartCard title="Pipeline funnel" subtitle="Lead status breakdown" loading={loading && !data}>
          {funnel.counts ? (
            <>
              <div className="mb-2 flex justify-center gap-6 px-2">
                <ChartStat label="Conversion" value={formatPercent(funnel.conversion_rate ?? 0)} />
                <ChartStat label="Open" value={formatNumber(funnel.open ?? 0)} />
              </div>
              <BreakdownChart data={funnel} height={190} />
            </>
          ) : null}
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard title="Task throughput" subtitle="Created vs completed" loading={loading && !data} className="xl:col-span-2">
          {charts.task_completion ? (
            <>
              <div className="flex flex-wrap gap-6 px-2 pb-2 pt-1">
                <ChartStat
                  label="Completion rate"
                  value={formatPercent(charts.task_completion.completion_rate ?? 0)}
                />
                <ChartStat
                  label="Avg cycle time"
                  value={`${Math.round(charts.task_completion.avg_cycle_time_hours ?? 0)}h`}
                />
              </div>
              <TaskCompletionChart data={charts.task_completion} height={210} />
            </>
          ) : null}
        </ChartCard>

        <ChartCard title="Support" subtitle="Last 30 days" loading={loading && !data}>
          <div className="space-y-3 px-2">
            <MiniStatGrid columns={2} className="sm:grid-cols-2">
              <MiniStat
                label="Resolution rate"
                value={formatPercent(support.resolution_rate ?? 0)}
                tone="success"
              />
              <MiniStat
                label="Avg first response"
                value={`${(support.avg_response_hours ?? 0).toFixed(1)}h`}
                tone="info"
              />
              <MiniStat label="Open now" value={formatNumber(support.open_now ?? 0)} tone="warning" />
              <MiniStat
                label="Unassigned"
                value={formatNumber(support.unassigned_open ?? 0)}
                tone="danger"
              />
            </MiniStatGrid>
            <Link
              to="/app/support"
              className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink transition hover:bg-sunken"
            >
              Open support desk
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </ChartCard>
      </div>

      {/* Insights */}
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-500" aria-hidden="true" />
            <h2 className="text-base font-semibold tracking-tight text-ink">Smart Insights</h2>
          </div>
          <p className="text-xs text-ink-subtle">
            Rule-based, computed from your records — not an AI service
          </p>
        </div>
        <InsightList insights={data?.insights ?? []} loading={loading && !data} max={3} />
        {data?.insights?.length > 3 ? (
          <Link
            to="/app/analytics"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:opacity-80 dark:text-brand-300"
          >
            See all {data.insights.length} insights
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        ) : null}
      </section>

      {/* Attention + upcoming + activity */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Needs attention" description="Counts behind each insight" />
          <div className="border-t border-line px-4 py-1 sm:px-5">
            {loading && !data ? (
              <div className="space-y-3 py-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : attentionItems.length ? (
              <ul className="divide-y divide-line/70">
                {attentionItems.map((item) => (
                  <li key={item.key}>
                    <Link
                      to={item.to}
                      className="-mx-2 flex items-center justify-between gap-3 rounded px-2 transition hover:bg-sunken/70"
                    >
                      <AttentionRow
                        label={item.label}
                        description={item.description}
                        value={item.value}
                        icon={item.icon}
                        tone={item.tone}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Nothing urgent"
                description="No overdue work, unassigned records or stale leads right now."
                className="my-3"
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Upcoming tasks"
            description="Soonest due dates first"
            action={
              <Link to="/app/tasks" className="text-xs font-medium text-brand-700 hover:opacity-80 dark:text-brand-300">
                View all
              </Link>
            }
          />
          <div className="border-t border-line">
            {loading && !data ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : data?.upcoming_tasks?.length ? (
              <ul className="divide-y divide-line/70">
                {data.upcoming_tasks.map((task) => {
                  const meta = taskStatusMeta(task.status);

                  return (
                    <li key={task.id}>
                      <Link
                        to={`/app/tasks?task=${task.id}`}
                        className="flex items-start gap-2.5 px-4 py-2.5 transition hover:bg-sunken/70"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink">{task.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge tone={meta.tone} size="sm">
                              {meta.label}
                            </Badge>
                            <PriorityPill priority={task.priority} />
                            <span
                              className={
                                task.is_overdue ? 'text-2xs font-medium text-danger-600 dark:text-danger-400' : 'text-2xs text-ink-subtle'
                              }
                            >
                              {formatDueDate(task.due_date)}
                            </span>
                          </div>
                        </div>
                        {task.assignee ? (
                          <Avatar name={task.assignee.name} size="xs" />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="No upcoming tasks"
                description="Nothing is scheduled with a due date."
                className="m-4"
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            description="Across the whole workspace"
            action={
              <Link to="/app/activity" className="text-xs font-medium text-brand-700 hover:opacity-80 dark:text-brand-300">
                View all
              </Link>
            }
          />
          <div className="border-t border-line">
            {loading && !data ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : data?.recent_activity?.length ? (
              <ul className="divide-y divide-line/70">
                {data.recent_activity.slice(0, 7).map((activity) => (
                  <li key={activity.id} className="flex gap-2.5 px-4 py-2.5">
                    <Avatar name={activity.actor_name} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs leading-snug text-ink-muted">
                        {activity.description}
                      </p>
                      <p className="mt-0.5 text-2xs text-ink-subtle">
                        {formatRelative(activity.created_at)}
                        {activity.entity_label ? ` · ${activity.entity_label}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No activity yet" description="Actions will appear here." className="m-4" />
            )}
          </div>
        </Card>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-2xs text-ink-subtle">
        <BarChart3 className="h-3 w-3" aria-hidden="true" />
        All figures are computed live from the API. Last 30 days.
      </p>
    </PageContainer>
  );
}