import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BellRing,
  Clock,
  LifeBuoy,
  ListChecks,
  PackageOpen,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';

import { PageContainer } from '../components/layout/Topbar';
import { Badge, Card } from '../components/ui/Badge';
import { SegmentedControl } from '../components/ui/FilterBar';
import { Avatar } from '../components/ui/Avatar';
import { ProgressBar } from '../components/ui/Progress';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/StateBlock';
import {
  BreakdownChart,
  ComparisonChart,
  CustomerGrowthChart,
  LeadTrendChart,
  SupportTrendChart,
  TaskCompletionChart,
} from '../components/charts/Charts';
import { ChartCard } from '../components/charts/ChartPrimitives';
import { DeltaBadge, InsightList, InsightSummary } from '../components/insights/InsightCard';
import { analyticsService } from '../services/endpoints';
import { useApi, useDocumentTitle } from '../hooks';
import { ANALYTICS_RANGES, CHART_PALETTE } from '../utils/constants';
import { formatCompactCurrency, formatHours, formatNumber, formatPercent } from '../utils/formatters';

const titleCase = (value) =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

function KpiTile({ label, value, delta, invert = false, icon: Icon }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-xs text-ink-muted">{label}</p>
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" /> : null}
      </div>
      <p className="nums mt-1.5 truncate text-lg font-semibold text-ink sm:text-xl">{value}</p>
      <div className="mt-1">
        <DeltaBadge delta={delta} invert={invert} />
      </div>
    </Card>
  );
}

export default function Analytics() {
  useDocumentTitle('Analytics');
  const navigate = useNavigate();

  const [range, setRange] = useState('30d');

  const { data, loading, error, refetch } = useApi(() => analyticsService.overview(range), {
    deps: [range],
  });

  const insightsQuery = useApi(() => analyticsService.insights(range), { deps: [range] });

  if (error) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={refetch} className="mt-6" />
      </PageContainer>
    );
  }

  const summary = data?.summary ?? {};
  const leadTrend = data?.lead_trend ?? { labels: [], new_leads: [], won_value: [] };
  const funnel = data?.lead_funnel ?? { counts: {}, open: 0, pipeline_value: 0, won_value: 0 };
  const growth = data?.customer_growth ?? { labels: [], new_customers: [] };
  const tasks = data?.task_completion ?? { labels: [], created: [], completed: [] };
  const support = data?.support_metrics ?? { labels: [], created: [], resolved: [] };
  const sources = data?.source_performance ?? [];
  const backlog = data?.task_backlog ?? {};
  const workload = data?.team_workload ?? [];

  const maxWorkload = Math.max(1, ...workload.map((row) => row.workload_score));

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Analytics</h1>
          <p className="mt-1 text-sm text-ink-muted">{data?.range?.label ?? 'Loading…'}</p>
        </div>
        <SegmentedControl
          value={range}
          onChange={setRange}
          options={ANALYTICS_RANGES.map((option) => ({ value: option.value, label: option.label }))}
        />
      </div>

      {loading ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="p-4 lg:col-span-3">
            <Skeleton className="h-40 w-full" />
          </Card>
          <Card className="p-4 lg:col-span-2">
            <Skeleton className="h-40 w-full" />
          </Card>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <KpiTile label="New leads" value={formatNumber(summary.leads?.value)} delta={summary.leads?.delta} icon={Target} />
            <KpiTile label="Won value" value={formatCompactCurrency(summary.won_value?.value)} delta={summary.won_value?.delta} icon={TrendingUp} />
            <KpiTile label="Conversion" value={formatPercent(summary.conversion_rate?.value)} delta={summary.conversion_rate?.delta} icon={UserCheck} />
            <KpiTile label="New customers" value={formatNumber(summary.new_customers?.value)} delta={summary.new_customers?.delta} icon={Users} />
            <KpiTile label="Tasks done" value={formatPercent(summary.task_completion_rate?.value)} delta={summary.task_completion_rate?.delta} icon={ListChecks} />
            <KpiTile label="Tickets resolved" value={formatPercent(summary.ticket_resolution_rate?.value)} delta={summary.ticket_resolution_rate?.delta} icon={LifeBuoy} />
            <KpiTile label="Avg response" value={formatHours(summary.avg_response_hours?.value)} delta={summary.avg_response_hours?.delta} invert icon={Clock} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
            <ChartCard
              title="Lead volume & won value"
              subtitle="New leads created and won revenue per period"
              className="lg:col-span-3"
              loading={loading}
              height={300}
            >
              <LeadTrendChart data={leadTrend} height={300} />
            </ChartCard>

            <ChartCard
              title="Pipeline funnel"
              subtitle="Lead status mix"
              className="lg:col-span-2"
              loading={loading}
              height={300}
            >
              <BreakdownChart data={funnel.counts} height={240} colors={CHART_PALETTE} />
              <div className="mt-2 flex items-center justify-between border-t border-line px-1 pt-2 text-xs text-ink-muted">
                <span>{formatNumber(funnel.open)} open</span>
                <span className="nums">{formatCompactCurrency(funnel.pipeline_value)} pipeline</span>
              </div>
            </ChartCard>

            <ChartCard
              title="Customer growth"
              subtitle="New customers this range (cumulative total in tooltip)"
              className="lg:col-span-3"
              loading={loading}
              height={280}
            >
              <CustomerGrowthChart data={growth} height={280} />
            </ChartCard>

            <ChartCard
              title="Lead priority split"
              subtitle="Open leads by priority"
              className="lg:col-span-2"
              loading={loading}
              height={280}
            >
              <BreakdownChart data={{ counts: data?.priority_split ?? {} }} height={220} colors={CHART_PALETTE} />
            </ChartCard>

            <ChartCard
              title="Task completion"
              subtitle="Created vs completed"
              className="lg:col-span-3"
              loading={loading}
              height={280}
              footer={
                <p className="text-xs text-ink-muted">
                  Completion <span className="nums font-medium text-ink">{formatPercent(tasks.completion_rate)}</span>
                  {' · '}avg cycle <span className="nums font-medium text-ink">{formatHours(tasks.avg_cycle_time_hours)}</span>
                </p>
              }
            >
              <TaskCompletionChart data={tasks} height={280} />
            </ChartCard>

            <ChartCard
              title="Support workload"
              subtitle="Opened vs resolved"
              className="lg:col-span-2"
              loading={loading}
              height={280}
              footer={
                <p className="flex items-center gap-2 text-xs text-ink-muted">
                  <span className="flex items-center gap-1">
                    <BellRing className="h-3 w-3" aria-hidden="true" />
                    {formatNumber(support.open_now)} open
                  </span>
                  <span className="text-ink-subtle">·</span>
                  <span>{formatNumber(support.unassigned_open)} unassigned</span>
                </p>
              }
            >
              <SupportTrendChart data={support} height={280} />
            </ChartCard>

            <Card className="lg:col-span-3">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink">Source performance</h2>
                  <p className="mt-0.5 text-xs text-ink-muted">Leads by acquisition source with win conversion</p>
                </div>
              </div>
              <div className="px-2 pb-4 pt-3 sm:px-3">
                {sources.length ? (
                  <ComparisonChart
                    data={sources}
                    valueKey="total"
                    labelKey="source"
                    height={240}
                    formatter={(value) => formatNumber(value)}
                  />
                ) : (
                  <p className="px-4 py-10 text-center text-sm text-ink-subtle">No leads recorded in this range.</p>
                )}
              </div>
              <ul className="divide-y divide-line/70 border-t border-line">
                {sources.slice(0, 6).map((row) => (
                  <li key={row.source} className="flex items-center justify-between gap-3 px-4 py-2 sm:px-5">
                    <div className="flex items-center gap-2 text-xs text-ink">
                      <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
                      {titleCase(row.source)}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xs text-ink-subtle">{formatPercent(row.conversion_rate)} won</span>
                      <span className="nums text-2xs text-ink-muted">{formatNumber(row.total)}</span>
                      <span className="nums hidden w-24 text-right text-2xs text-ink-muted sm:inline">
                        {formatCompactCurrency(row.value)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="lg:col-span-2">
              <div className="px-4 pt-4 sm:px-5 sm:pt-5">
                <h2 className="text-sm font-semibold text-ink">Task backlog</h2>
                <p className="mt-0.5 text-xs text-ink-muted">Current open-task pressure</p>
              </div>
              <ul className="mt-3 divide-y divide-line/70">
                {[
                  { key: 'overdue', label: 'Overdue', icon: Clock, tone: 'danger' },
                  { key: 'high_priority_open', label: 'High priority open', icon: AlertTriangle, tone: 'warning' },
                  { key: 'due_today', label: 'Due today', icon: BellRing, tone: 'info' },
                  { key: 'unassigned', label: 'Unassigned', icon: PackageOpen, tone: 'neutral' },
                ].map((item) => (
                  <li key={item.key} className="flex items-center justify-between px-4 py-2.5 sm:px-5">
                    <span className="flex items-center gap-2 text-xs text-ink-muted">
                      <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {item.label}
                    </span>
                    <Badge tone={item.tone} className="nums">{formatNumber(backlog[item.key])}</Badge>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="mt-4 lg:col-span-5">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink">Team workload</h2>
                  <p className="mt-0.5 text-xs text-ink-muted">Active members ranked by open work</p>
                </div>
                {workload.length ? (
                  <p className="text-xs text-ink-subtle">{formatNumber(workload.length)} active members</p>
                ) : null}
              </div>
              <ul className="mt-2 divide-y divide-line/70">
                {workload.map((row) => (
                  <li key={row.user.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <Avatar name={row.user.name} src={row.user.avatar_url} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{row.user.name}</p>
                      <p className="truncate text-2xs text-ink-subtle">
                        {row.user.title || row.user.department || row.user.role_name}
                      </p>
                    </div>
                    <div className="hidden items-center gap-4 text-2xs text-ink-subtle sm:flex">
                      <span>{formatNumber(row.open_tasks)} tasks</span>
                      <span>{formatNumber(row.open_tickets)} tickets</span>
                      <span>{formatNumber(row.open_leads)} leads</span>
                    </div>
                    <div className="w-32">
                      <ProgressBar
                        value={(row.workload_score / maxWorkload) * 100}
                        tone={row.overdue_tasks > 0 ? 'danger' : 'success'}
                        showLabel
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <h2 className="text-base font-semibold text-ink">Smart insights</h2>
              </div>
              {insightsQuery.data?.summary ? (
                <InsightSummary summary={insightsQuery.data.summary} className="!p-2 !shadow-none !border-0" />
              ) : null}
            </div>
            <div className="mt-3">
              <InsightList
                insights={insightsQuery.data?.insights ?? []}
                loading={insightsQuery.loading}
                onAction={(insight) => insight.link && navigate(insight.link)}
              />
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}