"""Rule-based Smart Insights engine.

This is deliberately deterministic, not a language model. Each rule compares a
real metric against a real threshold and emits a structured insight the UI can
render. Nothing here calls an external service, so every insight on screen can
be traced back to a query and a threshold in this file — which is exactly what
makes it defensible in an interview.
"""

from datetime import timedelta

from sqlalchemy import func, select

from config.settings import get_config
from ..extensions import db
from ..models import Customer, Lead, SupportTicket, Task, utcnow
from . import analytics

SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2, "success": 3}


def _insight(
    key: str,
    *,
    severity: str,
    module: str,
    title: str,
    message: str,
    metric_value=None,
    metric_label: str = "",
    action: str = "",
    action_label: str = "",
    link: str = "",
) -> dict:
    return {
        "id": key,
        "type": key,
        "severity": severity,
        "module": module,
        "title": title,
        "message": message,
        "metric_value": metric_value,
        "metric_label": metric_label,
        "action": action,
        "action_label": action_label,
        "link": link,
    }


def _sla_hours() -> dict:
    return get_config().SUPPORT_SLA_HOURS


def generate_insights(range_key: str | None = "30d") -> list[dict]:
    """Evaluate every rule and return the insights sorted by severity."""
    window = analytics.resolve_range(range_key)
    start, end, prev_start = window["start"], window["end"], window["previous_start"]

    rules = [
        _lead_volume,
        _lead_conversion,
        _pipeline_health,
        _stale_leads,
        _unassigned_leads,
        _high_priority_tasks,
        _overdue_tasks,
        _tasks_due_today,
        _unassigned_tasks,
        _task_completion_rate,
        _support_sla,
        _support_response_time,
        _support_resolution,
        _unassigned_tickets,
        _workload_balance,
        _idle_team,
        _at_risk_customers,
        _top_source,
    ]

    insights: list[dict] = []
    for rule in rules:
        try:
            produced = rule(start, end, prev_start)
        except Exception:  # noqa: BLE001 - an insight must never break the page
            produced = []
        if produced:
            insights.extend(produced)

    insights.sort(key=lambda i: (SEVERITY_ORDER.get(i["severity"], 9), i["id"]))
    return insights


# ---------------------------------------------------------------------------
# Lead rules
# ---------------------------------------------------------------------------


def _lead_volume(start, end, prev_start) -> list[dict]:
    current = analytics._leads_in(start, end)
    previous = analytics._leads_in(prev_start, start)
    delta = analytics._delta(len(current), len(previous))

    if len(current) < 5:
        return []

    if delta >= 10:
        return [
            _insight(
                "lead_volume_up",
                severity="success",
                module="leads",
                title=f"Lead volume up {delta}%",
                message=(
                    f"{len(current)} leads were created in this period versus "
                    f"{len(previous)} previously. Keep the current sourcing mix."
                ),
                metric_value=len(current),
                metric_label="new leads",
                action="Review the lead sources driving this growth.",
                action_label="View leads",
                link="/app/leads",
            )
        ]
    if delta <= -15:
        return [
            _insight(
                "lead_volume_down",
                severity="warning",
                module="leads",
                title=f"Lead volume down {abs(delta)}%",
                message=(
                    f"Only {len(current)} leads were created versus {len(previous)} in the "
                    "previous period. The pipeline may dry up without new sourcing."
                ),
                metric_value=len(current),
                metric_label="new leads",
                action="Re-engage paused campaigns and referral partners.",
                action_label="Open leads",
                link="/app/leads",
            )
        ]
    return []


def _lead_conversion(start, end, prev_start) -> list[dict]:
    current = analytics.lead_funnel(start, end)
    before = analytics.lead_funnel(prev_start, start)

    if current["total"] < 5 or before["total"] < 5:
        return []

    change = round(current["conversion_rate"] - before["conversion_rate"], 2)
    if abs(change) < 3:
        return []

    improved = change > 0
    return [
        _insight(
            "lead_conversion_up" if improved else "lead_conversion_down",
            severity="success" if improved else "warning",
            module="leads",
            title=(
                f"Lead conversion {change:+.1f}%"
                if improved
                else f"Lead conversion {change:+.1f}%"
            ),
            message=(
                f"{current['conversion_rate']}% of leads created this period were won, "
                f"against {before['conversion_rate']}% previously. "
                + (
                    "Qualification is paying off."
                    if improved
                    else "Leads are progressing but stalling before close."
                )
            ),
            metric_value=current["conversion_rate"],
            metric_label="% conversion",
            action=(
                "Document what changed in qualification this period."
                if improved
                else "Review leads stuck in qualified and proposal stages."
            ),
            action_label="Open funnel",
            link="/app/leads",
        )
    ]


def _pipeline_health(start, end, prev_start) -> list[dict]:
    open_leads = (
        db.session.execute(
            select(func.count(Lead.id)).where(Lead.status.notin_(("won", "lost")))
        ).scalar_one()
        or 0
    )
    unweighted = (
        db.session.execute(
            select(func.count(Lead.id)).where(
                Lead.status == "new",
                Lead.created_at < utcnow() - timedelta(days=7),
            )
        ).scalar_one()
        or 0
    )
    if unweighted < 3:
        return []

    return [
        _insight(
            "pipeline_untouched",
            severity="warning" if unweighted >= 8 else "info",
            module="leads",
            title=f"{unweighted} leads never contacted",
            message=(
                f"There are {open_leads} open leads in total, and {unweighted} of them have "
                "been sitting in New for over a week without any contact recorded."
            ),
            metric_value=unweighted,
            metric_label="uncontacted leads",
            action="Assign owners and log a first contact to keep the pipeline moving.",
            action_label="Review leads",
            link="/app/leads?status=new",
        )
    ]


def _stale_leads(start, end, prev_start) -> list[dict]:
    cutoff = utcnow() - timedelta(days=14)
    stale = (
        db.session.execute(
            select(func.count(Lead.id)).where(
                Lead.status.notin_(("won", "lost")),
                Lead.last_contacted_at.is_not(None),
                Lead.last_contacted_at < cutoff,
            )
        ).scalar_one()
        or 0
    )
    if stale < 3:
        return []

    return [
        _insight(
            "stale_leads",
            severity="warning",
            module="leads",
            title=f"{stale} leads have gone quiet",
            message=(
                f"{stale} open leads have not been contacted in over 14 days. Interest "
                "usually decays after the first two weeks of silence."
            ),
            metric_value=stale,
            metric_label="stale leads",
            action="Re-engage these leads or mark them lost to keep reporting accurate.",
            action_label="Review stale leads",
            link="/app/leads?stale=true",
        )
    ]


def _unassigned_leads(start, end, prev_start) -> list[dict]:
    unassigned = (
        db.session.execute(
            select(func.count(Lead.id)).where(
                Lead.owner_id.is_(None), Lead.status.notin_(("won", "lost"))
            )
        ).scalar_one()
        or 0
    )
    if unassigned < 2:
        return []

    return [
        _insight(
            "unassigned_leads",
            severity="info",
            module="leads",
            title=f"{unassigned} open leads have no owner",
            message=(
                "Unowned leads do not appear on any team member's workload, so they are "
                "easy to miss entirely."
            ),
            metric_value=unassigned,
            metric_label="unassigned",
            action="Assign an owner so responsibility and workload reporting stay accurate.",
            action_label="Assign leads",
            link="/app/leads?owner=unassigned",
        )
    ]


# ---------------------------------------------------------------------------
# Task rules
# ---------------------------------------------------------------------------


def _high_priority_tasks(start, end, prev_start) -> list[dict]:
    count = (
        db.session.execute(
            select(func.count(Task.id)).where(
                Task.status != "completed", Task.priority.in_(("high", "critical"))
            )
        ).scalar_one()
        or 0
    )
    if count < 3:
        return []

    critical = (
        db.session.execute(
            select(func.count(Task.id)).where(
                Task.status != "completed", Task.priority == "critical"
            )
        ).scalar_one()
        or 0
    )

    detail = (
        f"{critical} of them are marked critical."
        if critical
        else "None are marked critical yet."
    )
    return [
        _insight(
            "high_priority_tasks",
            severity="critical" if critical >= 3 else "warning",
            module="tasks",
            title=f"{count} high-priority tasks pending",
            message=(
                f"{count} open tasks are flagged high or critical priority. {detail} "
                "High-priority work drifts first when it is not scheduled explicitly."
            ),
            metric_value=count,
            metric_label="priority tasks",
            action="Schedule the critical tasks first and reassign anything without an owner.",
            action_label="Open tasks",
            link="/app/tasks?priority=high",
        )
    ]


def _overdue_tasks(start, end, prev_start) -> list[dict]:
    today = utcnow().date()
    overdue = (
        db.session.execute(
            select(func.count(Task.id)).where(
                Task.status != "completed",
                Task.due_date.is_not(None),
                Task.due_date < today,
            )
        ).scalar_one()
        or 0
    )
    if overdue < 2:
        return []

    oldest = (
        db.session.execute(
            select(Task).where(
                Task.status != "completed",
                Task.due_date.is_not(None),
                Task.due_date < today,
            ).order_by(Task.due_date.asc()).limit(1)
        ).scalar_one_or_none()
    )
    oldest_note = ""
    if oldest and oldest.due_date:
        oldest_note = f" The oldest has been waiting since {oldest.due_date.strftime('%d %b')}."

    return [
        _insight(
            "overdue_tasks",
            severity="critical" if overdue >= 5 else "warning",
            module="tasks",
            title=f"{overdue} tasks are overdue",
            message=(
                f"{overdue} tasks passed their due date and are still open.{oldest_note}"
            ),
            metric_value=overdue,
            metric_label="overdue tasks",
            action="Reschedule, reassign, or close these tasks so the plan reflects reality.",
            action_label="Review overdue",
            link="/app/tasks?overdue=true",
        )
    ]


def _tasks_due_today(start, end, prev_start) -> list[dict]:
    today = utcnow().date()
    due_today = (
        db.session.execute(
            select(func.count(Task.id)).where(
                Task.status != "completed", Task.due_date == today
            )
        ).scalar_one()
        or 0
    )
    if due_today < 1:
        return []

    return [
        _insight(
            "tasks_due_today",
            severity="info",
            module="tasks",
            title=f"{due_today} tasks due today",
            message=(
                f"{due_today} tasks are scheduled to close today. Anything still in Todo at "
                "the end of the day will roll into tomorrow's plan."
            ),
            metric_value=due_today,
            metric_label="due today",
            action="Work through the due-today list before taking on new requests.",
            action_label="View list",
            link="/app/tasks?due=today",
        )
    ]


def _unassigned_tasks(start, end, prev_start) -> list[dict]:
    count = (
        db.session.execute(
            select(func.count(Task.id)).where(
                Task.status != "completed", Task.assignee_id.is_(None)
            )
        ).scalar_one()
        or 0
    )
    if count < 2:
        return []

    return [
        _insight(
            "unassigned_tasks",
            severity="info",
            module="tasks",
            title=f"{count} open tasks are unassigned",
            message=(
                "These tasks are visible to everyone and owned by no one, which usually "
                "means nobody picks them up."
            ),
            metric_value=count,
            metric_label="unassigned",
            action="Assign each open task to a specific team member.",
            action_label="Assign tasks",
            link="/app/tasks?assignee=unassigned",
        )
    ]


def _task_completion_rate(start, end, prev_start) -> list[dict]:
    created = len(analytics._tasks_created_in(start, end))
    completed = len(analytics._tasks_completed_in(start, end))
    if created < 5:
        return []

    rate = analytics._pct(completed, created)
    if rate >= 70:
        return [
            _insight(
                "task_completion_high",
                severity="success",
                module="tasks",
                title=f"Task completion at {rate}%",
                message=(
                    f"{completed} of {created} tasks created this period were completed. "
                    "The team is keeping up with incoming work."
                ),
                metric_value=rate,
                metric_label="% completed",
                action="Consider raising throughput targets for the next period.",
                action_label="View analytics",
                link="/app/analytics",
            )
        ]
    if rate < 40:
        return [
            _insight(
                "task_completion_low",
                severity="warning",
                module="tasks",
                title=f"Task completion at only {rate}%",
                message=(
                    f"Only {completed} of {created} tasks created this period were completed. "
                    "Work is entering faster than it is being closed."
                ),
                metric_value=rate,
                metric_label="% completed",
                action="WIP limit in-progress work and clear the review queue.",
                action_label="View tasks",
                link="/app/tasks",
            )
        ]
    return []


# ---------------------------------------------------------------------------
# Support rules
# ---------------------------------------------------------------------------


def _support_sla(start, end, prev_start) -> list[dict]:
    sla = _sla_hours()
    open_tickets = list(
        db.session.execute(
            select(SupportTicket).where(
                SupportTicket.status.notin_(("resolved", "closed"))
            )
        ).scalars()
    )

    breaching = [t for t in open_tickets if t.age_hours > sla.get(t.priority, sla["medium"])]
    if not breaching:
        return []

    critical = [t for t in breaching if t.priority in ("critical", "high")]
    worst = max(breaching, key=lambda t: t.age_hours)

    severity = "critical" if len(critical) >= 2 else "warning"
    return [
        _insight(
            "support_sla_breach",
            severity=severity,
            module="support",
            title=f"{len(breaching)} tickets past their SLA",
            message=(
                f"{len(breaching)} open requests have exceeded the response target for their "
                f"priority. The longest is {worst.reference} at {round(worst.age_hours)}h old."
            ),
            metric_value=len(breaching),
            metric_label="SLA breaches",
            action="Reassign or escalate these tickets before they become escalations.",
            action_label="Review tickets",
            link="/app/support?breach=true",
        )
    ]


def _support_response_time(start, end, prev_start) -> list[dict]:
    current = analytics.support_metrics(
        {"start": start, "end": end, "buckets": analytics.build_buckets(start, end, "day")}
    )
    before = analytics.support_metrics(
        {"start": prev_start, "end": start, "buckets": analytics.build_buckets(prev_start, start, "day")}
    )

    now_hours = current["avg_response_hours"]
    before_hours = before["avg_response_hours"]
    if now_hours == 0 or before_hours == 0:
        return []

    change = round(((before_hours - now_hours) / before_hours) * 100, 1)
    if abs(change) < 8:
        return []

    improved = change > 0
    outcome = (
        "Faster first responses reduce escalations."
        if improved
        else "Requests are waiting longer for a first reply than they used to."
    )
    return [
        _insight(
            "support_response_improved" if improved else "support_response_slow",
            severity="success" if improved else "warning",
            module="support",
            title=(
                f"First response improved {change}%"
                if improved
                else f"Support response time up {abs(change)}%"
            ),
            message=(
                f"Average first response is now {now_hours}h versus {before_hours}h previously. "
                + outcome
            ),
            metric_value=now_hours,
            metric_label="avg response (h)",
            action=(
                "Note what changed so the improvement can be repeated."
                if improved
                else "Check whether new tickets are queued behind unassigned work."
            ),
            action_label="Open support",
            link="/app/support",
        )
    ]


def _support_resolution(start, end, prev_start) -> list[dict]:
    current = analytics._tickets_in(start, end)
    if len(current) < 5:
        return []

    resolved = len([t for t in current if t.status in ("resolved", "closed")])
    rate = analytics._pct(resolved, len(current))
    if rate < 60:
        return [
            _insight(
                "support_resolution_low",
                severity="warning",
                module="support",
                title=f"Ticket resolution at {rate}%",
                message=(
                    f"Only {resolved} of {len(current)} requests raised this period have been "
                    "resolved or closed. Waiting tickets often hold work that is already done."
                ),
                metric_value=rate,
                metric_label="% resolved",
                action="Clear the waiting queue and confirm resolutions with requesters.",
                action_label="View tickets",
                link="/app/support",
            )
        ]
    return []


def _unassigned_tickets(start, end, prev_start) -> list[dict]:
    count = (
        db.session.execute(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.status.notin_(("resolved", "closed")),
                SupportTicket.assignee_id.is_(None),
            )
        ).scalar_one()
        or 0
    )
    if count < 2:
        return []

    return [
        _insight(
            "unassigned_tickets",
            severity="warning" if count >= 4 else "info",
            module="support",
            title=f"{count} open tickets are unassigned",
            message=(
                "Unassigned support requests have no clear owner, so nobody is accountable "
                "for the requester hearing back."
            ),
            metric_value=count,
            metric_label="unassigned",
            action="Assign each open ticket to a support engineer.",
            action_label="Assign tickets",
            link="/app/support?assignee=unassigned",
        )
    ]


# ---------------------------------------------------------------------------
# Team + customer rules
# ---------------------------------------------------------------------------


def _workload_balance(start, end, prev_start) -> list[dict]:
    workload = analytics.team_workload()
    if len(workload) < 2:
        return []

    scores = [row["workload_score"] for row in workload]
    top = max(scores)
    mean = sum(scores) / len(scores)
    if mean == 0:
        return []

    busiest = workload[0]
    lightest = workload[-1]
    if top < mean * 2:
        return []

    return [
        _insight(
            "workload_imbalance",
            severity="warning",
            module="team",
            title="Workload is concentrated on one person",
            message=(
                f"{busiest['user']['name']} is carrying {busiest['workload_score']} workload "
                f"points against a team average of {round(mean, 1)}, while "
                f"{lightest['user']['name']} has {lightest['workload_score']}."
            ),
            metric_value=round(mean * 2, 1),
            metric_label="rebalance threshold",
            action="Move open tasks from the busiest member to whoever has capacity.",
            action_label="View team",
            link="/app/team",
        )
    ]


def _idle_team(start, end, prev_start) -> list[dict]:
    workload = [row for row in analytics.team_workload() if row["workload_score"] == 0]
    if len(workload) < 2 or len(workload) == len(analytics.team_workload()):
        return []

    names = ", ".join(row["user"]["name"] for row in workload[:3])
    return [
        _insight(
            "team_capacity",
            severity="info",
            module="team",
            title=f"{len(workload)} team members have open capacity",
            message=(
                f"{names} currently have no open tasks or tickets. This is spare capacity "
                "that could absorb the backlog."
            ),
            metric_value=len(workload),
            metric_label="available members",
            action="Reassign backlog items to available team members.",
            action_label="View team",
            link="/app/team",
        )
    ]


def _at_risk_customers(start, end, prev_start) -> list[dict]:
    at_risk = (
        db.session.execute(
            select(func.count(Customer.id)).where(
                (Customer.status == "at_risk") | (Customer.health_score < 60)
            )
        ).scalar_one()
        or 0
    )
    if at_risk < 2:
        return []

    value = float(
        db.session.execute(
            select(func.coalesce(func.sum(Customer.account_value), 0)).where(
                (Customer.status == "at_risk") | (Customer.health_score < 60)
            )
        ).scalar_one()
    )

    return [
        _insight(
            "at_risk_customers",
            severity="warning",
            module="customers",
            title=f"{at_risk} accounts need attention",
            message=(
                f"{at_risk} customers are flagged at risk or have a health score below 60, "
                f"representing {analytics.compact_number(value)} in account value."
            ),
            metric_value=at_risk,
            metric_label="at-risk accounts",
            action="Schedule a check-in with each account owner this week.",
            action_label="View customers",
            link="/app/customers?status=at_risk",
        )
    ]


def _top_source(start, end, prev_start) -> list[dict]:
    rows = analytics.source_performance(start, end)
    qualified = [r for r in rows if r["total"] >= 3]
    if len(qualified) < 2:
        return []

    best = max(qualified, key=lambda r: r["conversion_rate"])
    if best["conversion_rate"] < 30:
        return []

    return [
        _insight(
            "top_source",
            severity="info",
            module="leads",
            title=f"{best['source'].replace('_', ' ').title()} converts best",
            message=(
                f"{best['source'].replace('_', ' ').title()} produced {best['total']} leads with "
                f"a {best['conversion_rate']}% win rate, the strongest of any source with "
                "enough volume to trust."
            ),
            metric_value=best["conversion_rate"],
            metric_label="% conversion",
            action="Shift budget towards the sources that convert, not just the noisy ones.",
            action_label="Compare sources",
            link="/app/analytics",
        )
    ]