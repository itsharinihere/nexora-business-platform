import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, History, RotateCcw } from 'lucide-react';

import { PageContainer } from '../components/layout/Topbar';
import { Badge, Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Pagination } from '../components/ui/Pagination';
import { FilterBar, SegmentedControl } from '../components/ui/FilterBar';
import { SelectMenu } from '../components/ui/Dropdown';
import { ErrorState } from '../components/ui/StateBlock';
import { Skeleton } from '../components/ui/Skeleton';
import { activityService, teamService } from '../services/endpoints';
import { formatDate, formatRelative } from '../utils/formatters';
import { useApi, useDocumentTitle } from '../hooks';

const titleCase = (value) =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

function entityPath(entry) {
  if (!entry.entity_id) return null;
  if (entry.entity_type === 'lead') return `/app/leads/${entry.entity_id}`;
  if (entry.entity_type === 'customer') return `/app/customers/${entry.entity_id}`;
  if (entry.entity_type === 'support_ticket' || entry.entity_type === 'ticket') return `/app/support/${entry.entity_id}`;
  return null;
}

export default function Activity() {
  useDocumentTitle('Activity');
  const navigate = useNavigate();

  const [entityType, setEntityType] = useState('all');
  const [actor, setActor] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const teamQuery = useApi(() => teamService.list({ sort: 'name' }), []);
  const actorOptions = (teamQuery.data?.members ?? []).map((member) => ({ value: String(member.id), label: member.name }));

  const { data, meta, loading, error, refetch } = useApi(
    () =>
      activityService.list({
        entity_type: entityType,
        actor,
        sort: 'created_at',
        order: sort === 'newest' ? 'desc' : 'asc',
        page,
        per_page: 25,
      }),
    [entityType, actor, sort, page],
  );

  const rows = data ?? [];
  const entityFacets = meta?.facets?.entity_types ?? [];
  const activeFilters = entityType !== 'all' || actor !== 'all';

  const resetFilters = () => {
    setEntityType('all');
    setActor('all');
    setPage(1);
  };

  const groups = rows.reduce((acc, entry) => {
    const key = formatDate(entry.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Activity</h1>
          <p className="mt-1 text-sm text-ink-muted">Append-only audit trail of everyone&apos;s actions</p>
        </div>
        <SegmentedControl
          value={sort}
          onChange={setSort}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
          ]}
        />
      </div>

      <Card className="mt-4 p-3 sm:p-4">
        <FilterBar search={''} onSearchChange={() => {}} searchPlaceholder="—">
          <SelectMenu
            value={entityType}
            onChange={(value) => {
              setEntityType(value);
              setPage(1);
            }}
            options={entityFacets.map((facet) => ({
              value: facet.value,
              label: `${titleCase(facet.value)} (${facet.count})`,
            }))}
            allLabel="All record types"
          />
          <SelectMenu
            value={actor}
            onChange={(value) => {
              setActor(value);
              setPage(1);
            }}
            options={actorOptions}
            allLabel="Everyone"
          />
          {activeFilters ? (
            <Button size="sm" variant="ghost" leftIcon={RotateCcw} onClick={resetFilters}>
              Reset
            </Button>
          ) : null}
        </FilterBar>
      </Card>

      <div className="mt-4">
        {loading ? (
          <Card className="p-4">
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
          </Card>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !rows.length ? (
          <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
            <History className="mx-auto h-6 w-6 text-ink-subtle" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-ink">No activity found</p>
            <p className="mt-1 text-sm text-ink-muted">
              {activeFilters ? 'Nothing matches the current filters.' : 'Actions across leads, customers, tasks and support appear here.'}
            </p>
          </div>
        ) : (
          Object.keys(groups).map((dateLabel) => (
            <section key={dateLabel} className="mb-5">
              <h2 className="nx-muted flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider">
                {dateLabel}
                <span className="h-px flex-1 bg-line" aria-hidden="true" />
              </h2>
              <Card className="mt-2 divide-y divide-line/70">
                {groups[dateLabel].map((entry) => {
                  const path = entityPath(entry);
                  return (
                    <div key={entry.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <Avatar name={entry.actor_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-ink">{entry.description}</p>
                        {entry.entity_label ? (
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-ink-subtle">
                            <Badge tone="neutral">{titleCase(entry.entity_type ?? 'system')}</Badge>
                            <span className="font-medium text-ink-muted">{entry.entity_label}</span>
                            {path ? (
                              <button
                                type="button"
                                onClick={() => navigate(path)}
                                className="inline-flex items-center gap-0.5 font-semibold text-brand-700 underline underline-offset-2 hover:opacity-80 dark:text-brand-300"
                              >
                                Open
                                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                              </button>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-2xs text-ink-subtle">{formatRelative(entry.created_at)}</span>
                    </div>
                  );
                })}
              </Card>
            </section>
          ))
        )}

        <Pagination meta={meta?.pagination} onPageChange={setPage} onPageSizeChange={() => {}} />
      </div>
    </PageContainer>
  );
}