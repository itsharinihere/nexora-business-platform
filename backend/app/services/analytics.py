"""Analytics aggregation.

Records are fetched for the requested window and bucketed in Python rather
than with `strftime`/`date_trunc`. That keeps one code path working on both
SQLite and PostgreSQL, and at demo-data volumes the cost is negligible.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select

from ..constants import (
    CUSTOMER_STATUSES,
    LEAD_PRIORITIES,
    LEAD_SOURCES,
    LEAD_STATUSES,
    TASK_PRIORITIES,
    TASK_STATUSES,
    TICKET_CATEGORIES,
    TICKET_STATUSES,
)
from ..extensions import db
from ..models import Activity, Customer, Lead, SupportTicket, Task, User, utcnow

# Range presets consumed by the Analytics page filter.
RANGE_PRESETS = {
    "7d": {"days": 7, "granularity": "day", "label": "Last 7 days"},
    "30d": {"days": 30, "granularity": "day", "label": "Last 30 days"},
    "90d": {"days": 90, "granularity": "week", "label": "Last 90 days"},
    "1y": {"days": 365, "granularity": "month", "label": "Last 12 months"},
}
DEFAULT_RANGE = "30d"
OPEN_LEAD_STATUSES = ("new", "contacted", "qualified", "proposal")
WON_STATUSES = ("won",)


# ---------------------------------------------------------------------------
# Range + bucket helpers
# ---------------------------------------------------------------------------


def resolve_range(value: str | None = None) -> dict:
    """Turn `7d|30d|90d|1y` into concrete dates, buckets and a comparison window."""
    key = (value or DEFAULT_RANGE).strip().lower()
    preset = RANGE_PRESETS.get(key, RANGE_PRESETS[DEFAULT_RANGE])

    days = preset["days"]
    granularity = preset["granularity"]

    today = utcnow().date()
    end = today + timedelta(days=1)  # exclusive upper bound
    start = end - timedelta(days=days)

    return {
        "key": key if key in RANGE_PRESETS else DEFAULT_RANGE,
        "label": preset["label"],
        "days": days,
        "granularity": granularity,
        "start": start,
        "end": end,
        "previous_start": start - timedelta(days=days),
        "buckets": build_buckets(start, end, granularity),
    }


def build_buckets(start: date, end: date, granularity: str) -> list[dict]:
    """Split [start, end) into labelled, evenly sized buckets."""
    buckets: list[dict] = []

    if granularity == "day":
        cursor = start
        while cursor < end:
            nxt = cursor + timedelta(days=1)
            buckets.append({"start": cursor, "end": nxt, "label": cursor.strftime("%d %b")})
            cursor = nxt
        return buckets

    if granularity == "week":
        cursor = start
        while cursor < end:
            nxt = min(cursor + timedelta(days=7), end)
            buckets.append(
                {"start": cursor, "end": nxt, "label": f"{cursor.strftime('%d %b')}"}
            )
            cursor = nxt
        return buckets

    # month
    cursor = date(start.year, start.month, 1)
    while cursor < end:
        nxt = date(
            cursor.year + (1 if cursor.month == 12 else 0),
            1 if cursor.month == 12 else cursor.month + 1,
            1,
        )
        buckets.append(
            {"start": cursor, "end": min(nxt, end), "label": cursor.strftime("%b %Y")}
        )
        cursor = nxt
    return buckets


def _bucket_index(buckets: list[dict], value) -> int | None:
    if value is None:
        return None
    day = value.date() if isinstance(value, datetime) else value
    for index, bucket in enumerate(buckets):
        if bucket["start"] <= day < bucket["end"]:
            return index
    return None


def _series(buckets: list[dict], records, date_field) -> list[int]:
    counts = [0] * len(buckets)
    for record in records:
        index = _bucket_index(buckets, getattr(record, date_field, None))
        if index is not None:
            counts[index] += 1
    return counts


def _decimal_sum(records, field) -> float:
    return round(sum(float(getattr(r, field) or 0) for r in records), 2)


def _pct(numerator: float, denominator: float) -> float:
    if not denominator:
        return 0.0
    return round((numerator / denominator) * 100, 2)


def _delta(current: float, previous: float) -> float:
    """Percentage change, guarding the divide-by-zero previous-period case."""
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 2)


def _mean(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------


def _leads_in(start: date, end: date) -> list[Lead]:
    return list(
        db.session.execute(
            select(Lead).where(Lead.created_at >= datetime.combine(start, datetime.min.time()),
                               Lead.created_at < datetime.combine(end, datetime.min.time()))
        ).scalars()
    )


def _customers_in(start: date, end: date) -> list[Customer]:
    return list(
        db.session.execute(
            select(Customer).where(
                Customer.created_at >= datetime.combine(start, datetime.min.time()),
                Customer.created_at < datetime.combine(end, datetime.min.time()),
            )
        ).scalars()
    )


def _tasks_created_in(start: date, end: date) -> list[Task]:
    return list(
        db.session.execute(
            select(Task).where(
                Task.created_at >= datetime.combine(start, datetime.min.time()),
                Task.created_at < datetime.combine(end, datetime.min.time()),
            )
        ).scalars()
    )


def _tasks_completed_in(start: date, end: date) -> list[Task]:
    return list(
        db.session.execute(
            select(Task).where(
                Task.completed_at.is_not(None),
                Task.completed_at >= datetime.combine(start, datetime.min.time()),
                Task.completed_at < datetime.combine(end, datetime.min.time()),
            )
        ).scalars()
    )


def _tickets_in(start: date, end: date) -> list[SupportTicket]:
    return list(
        db.session.execute(
            select(SupportTicket).where(
                SupportTicket.created_at >= datetime.combine(start, datetime.min.time()),
                SupportTicket.created_at < datetime.combine(end, datetime.min.time()),
            )
        ).scalars()
    )


def _tickets_resolved_in(start: date, end: date) -> list[SupportTicket]:
    return list(
        db.session.execute(
            select(SupportTicket).where(
                SupportTicket.resolved_at.is_not(None),
                SupportTicket.resolved_at >= datetime.combine(start, datetime.min.time()),
                SupportTicket.resolved_at < datetime.combine(end, datetime.min.time()),
            )
        ).scalars()
    )


# ---------------------------------------------------------------------------
# Public analytics builders
# ---------------------------------------------------------------------------


def lead_funnel(start: date, end: date) -> dict:
    """Counts of leads created in the window, grouped by status."""
    leads = _leads_in(start, end)
    counts = {status: 0 for status in LEAD_STATUSES}
    for lead in leads:
        counts[lead.status] += 1

    won = counts["won"]
    lost = counts["lost"]
    qualified_or_better = sum(
        counts[s] for s in ("qualified", "proposal", "won")
    )
    closed = won + lost

    return {
        "counts": counts,
        "total": len(leads),
        "won": won,
        "lost": lost,
        "open": sum(counts[s] for s in OPEN_LEAD_STATUSES),
        "conversion_rate": _pct(won, len(leads)),
        "win_rate": _pct(won, closed),
        "qualification_rate": _pct(qualified_or_better, len(leads)),
        "pipeline_value": _decimal_sum(
            [l for l in leads if l.is_open], "expected_value"
        ),
        "won_value": _decimal_sum([l for l in leads if l.status == "won"], "expected_value"),
    }


def lead_trend(window: dict) -> dict:
    buckets = window["buckets"]
    leads = _leads_in(window["start"], window["end"])
    won_leads = [l for l in leads if l.status == "won"]

    won_by_bucket = [0.0] * len(buckets)
    for lead in won_leads:
        index = _bucket_index(buckets, lead.closed_at or lead.updated_at)
        if index is not None:
            won_by_bucket[index] += float(lead.expected_value or 0)

    return {
        "labels": [b["label"] for b in buckets],
        "new_leads": _series(buckets, leads, "created_at"),
        "won_value": [round(v, 2) for v in won_by_bucket],
        "pipeline_value": [
            round(
                _decimal_sum(
                    [l for l in leads if l.is_open and _bucket_index(buckets, l.created_at) == i],
                    "expected_value",
                ),
                2,
            )
            for i in range(len(buckets))
        ],
    }


def source_performance(start: date, end: date) -> list[dict]:
    leads = _leads_in(start, end)
    rows = []
    for source in LEAD_SOURCES:
        subset = [l for l in leads if l.source == source]
        if not subset:
            continue
        won = [l for l in subset if l.status == "won"]
        rows.append(
            {
                "source": source,
                "total": len(subset),
                "won": len(won),
                "conversion_rate": _pct(len(won), len(subset)),
                "value": _decimal_sum(won, "expected_value"),
            }
        )
    rows.sort(key=lambda r: r["total"], reverse=True)
    return rows


def priority_split(start: date, end: date) -> dict:
    leads = _leads_in(start, end)
    counts = {p: 0 for p in LEAD_PRIORITIES}
    for lead in leads:
        counts[lead.priority] += 1
    return counts


def customer_growth(window: dict) -> dict:
    buckets = window["buckets"]
    customers = _customers_in(window["start"], window["end"])

    running = (
        db.session.execute(
            select(func.count(Customer.id)).where(
                Customer.created_at
                < datetime.combine(window["start"], datetime.min.time())
            )
        ).scalar_one()
        or 0
    )

    totals = []
    for index in range(len(buckets)):
        added = sum(
            1
            for c in customers
            if _bucket_index(buckets, c.created_at) == index
        )
        running += added
        totals.append(running)

    status_counts = {
        status: db.session.execute(
            select(func.count(Customer.id)).where(Customer.status == status)
        ).scalar_one()
        or 0
        for status in CUSTOMER_STATUSES
    }

    return {
        "labels": [b["label"] for b in buckets],
        "new_customers": _series(buckets, customers, "created_at"),
        "total_customers": totals,
        "status_counts": status_counts,
        "new_value": round(
            _decimal_sum(customers, "account_value"), 2
        ),
        "active_value": float(
            db.session.execute(
                select(func.coalesce(func.sum(Customer.account_value), 0)).where(
                    Customer.status.in_(("active", "onboarding"))
                )
            ).scalar_one()
        ),
    }


def task_completion(window: dict) -> dict:
    buckets = window["buckets"]
    created = _tasks_created_in(window["start"], window["end"])
    completed = _tasks_completed_in(window["start"], window["end"])

    completed_counts = [0] * len(buckets)
    durations = []
    for task in completed:
        index = _bucket_index(buckets, task.completed_at)
        if index is not None:
            completed_counts[index] += 1
        if task.created_at and task.completed_at:
            durations.append((task.completed_at - task.created_at).total_seconds() / 3600)

    status_counts = {
        status: db.session.execute(
            select(func.count(Task.id)).where(Task.status == status)
        ).scalar_one()
        or 0
        for status in TASK_STATUSES
    }

    return {
        "labels": [b["label"] for b in buckets],
        "created": _series(buckets, created, "created_at"),
        "completed": completed_counts,
        "completion_rate": _pct(len(completed), len(created)),
        "status_counts": status_counts,
        "avg_cycle_time_hours": _mean(durations),
    }


def task_backlog() -> dict:
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
    high_priority_open = (
        db.session.execute(
            select(func.count(Task.id)).where(
                Task.status != "completed", Task.priority.in_(("high", "critical"))
            )
        ).scalar_one()
        or 0
    )
    due_today = (
        db.session.execute(
            select(func.count(Task.id)).where(
                Task.status != "completed", Task.due_date == today
            )
        ).scalar_one()
        or 0
    )
    unassigned = (
        db.session.execute(
            select(func.count(Task.id)).where(
                Task.status != "completed", Task.assignee_id.is_(None)
            )
        ).scalar_one()
        or 0
    )
    return {
        "overdue": overdue,
        "high_priority_open": high_priority_open,
        "due_today": due_today,
        "unassigned": unassigned,
    }


def support_metrics(window: dict) -> dict:
    buckets = window["buckets"]
    created = _tickets_in(window["start"], window["end"])
    resolved = _tickets_resolved_in(window["start"], window["end"])

    resolved_counts = [0] * len(buckets)
    response_times = []
    resolution_times = []
    for ticket in resolved:
        index = _bucket_index(buckets, ticket.resolved_at)
        if index is not None:
            resolved_counts[index] += 1
        if ticket.resolution_hours is not None:
            resolution_times.append(ticket.resolution_hours)
        if ticket.response_hours is not None:
            response_times.append(ticket.response_hours)

    status_counts = {
        status: db.session.execute(
            select(func.count(SupportTicket.id)).where(SupportTicket.status == status)
        ).scalar_one()
        or 0
        for status in TICKET_STATUSES
    }

    category_counts = {
        category: db.session.execute(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.category == category
            )
        ).scalar_one()
        or 0
        for category in TICKET_CATEGORIES
    }

    open_now = (
        db.session.execute(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.status.notin_(("resolved", "closed"))
            )
        ).scalar_one()
        or 0
    )

    return {
        "labels": [b["label"] for b in buckets],
        "created": _series(buckets, created, "created_at"),
        "resolved": resolved_counts,
        "resolution_rate": _pct(len(resolved), len(created)),
        "avg_response_hours": _mean(response_times),
        "avg_resolution_hours": _mean(resolution_times),
        "status_counts": status_counts,
        "category_counts": category_counts,
        "open_now": open_now,
        "unassigned_open": (
            db.session.execute(
                select(func.count(SupportTicket.id)).where(
                    SupportTicket.status.notin_(("resolved", "closed")),
                    SupportTicket.assignee_id.is_(None),
                )
            ).scalar_one()
            or 0
        ),
    }


def team_workload() -> list[dict]:
    """Per-member open workload, used by Analytics and the Team page."""
    members = list(
        db.session.execute(
            select(User).where(User.status == "active").order_by(User.name)
        ).scalars()
    )

    rows = []
    for member in members:
        open_tasks = (
            db.session.execute(
                select(func.count(Task.id)).where(
                    Task.assignee_id == member.id, Task.status != "completed"
                )
            ).scalar_one()
            or 0
        )
        overdue = (
            db.session.execute(
                select(func.count(Task.id)).where(
                    Task.assignee_id == member.id,
                    Task.status != "completed",
                    Task.due_date.is_not(None),
                    Task.due_date < utcnow().date(),
                )
            ).scalar_one()
            or 0
        )
        open_tickets = (
            db.session.execute(
                select(func.count(SupportTicket.id)).where(
                    SupportTicket.assignee_id == member.id,
                    SupportTicket.status.notin_(("resolved", "closed")),
                )
            ).scalar_one()
            or 0
        )
        leads = (
            db.session.execute(
                select(func.count(Lead.id)).where(
                    Lead.owner_id == member.id,
                    Lead.status.notin_(("won", "lost")),
                )
            ).scalar_one()
            or 0
        )
        completed = (
            db.session.execute(
                select(func.count(Task.id)).where(
                    Task.assignee_id == member.id, Task.status == "completed"
                )
            ).scalar_one()
            or 0
        )
        rows.append(
            {
                "user": member.to_dict(),
                "open_tasks": open_tasks,
                "overdue_tasks": overdue,
                "open_tickets": open_tickets,
                "open_leads": leads,
                "completed_tasks": completed,
                # One task counts as a point; tickets are lighter so they are
                # weighted at 0.5 to avoid overstating support-heavy members.
                "workload_score": round(open_tasks + open_tickets * 0.5, 1),
            }
        )

    rows.sort(key=lambda r: r["workload_score"], reverse=True)
    return rows


def activity_trend(window: dict) -> dict:
    buckets = window["buckets"]
    rows = list(
        db.session.execute(
            select(Activity).where(
                Activity.created_at >= datetime.combine(window["start"], datetime.min.time()),
                Activity.created_at < datetime.combine(window["end"], datetime.min.time()),
            )
        ).scalars()
    )
    return {"labels": [b["label"] for b in buckets], "count": _series(buckets, rows, "created_at")}


def summary(window: dict) -> dict:
    """Headline KPIs with period-over-period deltas for the current window."""
    current = (window["start"], window["end"])
    previous = (window["previous_start"], window["start"])

    def _period(pair):
        start, end = pair
        return {
            "leads": len(_leads_in(start, end)),
            "won": len([l for l in _leads_in(start, end) if l.status == "won"]),
            "won_value": _decimal_sum(
                [l for l in _leads_in(start, end) if l.status == "won"], "expected_value"
            ),
            "customers": len(_customers_in(start, end)),
            "tasks_created": len(_tasks_created_in(start, end)),
            "tasks_completed": len(_tasks_completed_in(start, end)),
            "tickets": len(_tickets_in(start, end)),
            "tickets_resolved": len(_tickets_resolved_in(start, end)),
            "response_hours": _mean(
                [
                    l.response_hours
                    for l in _tickets_in(start, end)
                    if l.response_hours is not None
                ]
            ),
        }

    now, before = _period(current), _period(previous)

    return {
        "leads": {"value": now["leads"], "delta": _delta(now["leads"], before["leads"])},
        "won_value": {
            "value": now["won_value"],
            "delta": _delta(now["won_value"], before["won_value"]),
        },
        "conversion_rate": {
            "value": _pct(now["won"], now["leads"]),
            "delta": round(_pct(now["won"], now["leads"]) - _pct(before["won"], before["leads"]), 2),
        },
        "new_customers": {
            "value": now["customers"],
            "delta": _delta(now["customers"], before["customers"]),
        },
        "task_completion_rate": {
            "value": _pct(now["tasks_completed"], now["tasks_created"]),
            "delta": round(
                _pct(now["tasks_completed"], now["tasks_created"])
                - _pct(before["tasks_completed"], before["tasks_created"]),
                2,
            ),
        },
        "ticket_resolution_rate": {
            "value": _pct(now["tickets_resolved"], now["tickets"]),
            "delta": round(
                _pct(now["tickets_resolved"], now["tickets"])
                - _pct(before["tickets_resolved"], before["tickets"]),
                2,
            ),
        },
        "avg_response_hours": {
            "value": now["response_hours"],
            # Lower response time is an improvement, so the sign is inverted.
            "delta": round(before["response_hours"] - now["response_hours"], 2),
        },
    }


def build_overview(range_key: str | None = None) -> dict:
    """The single payload the Analytics page renders."""
    window = resolve_range(range_key)
    funnel = lead_funnel(window["start"], window["end"])

    return {
        "range": {
            "key": window["key"],
            "label": window["label"],
            "granularity": window["granularity"],
            "start": window["start"].isoformat(),
            "end": (window["end"] - timedelta(days=1)).isoformat(),
            "previous_start": window["previous_start"].isoformat(),
        },
        "summary": summary(window),
        "lead_funnel": funnel,
        "lead_trend": lead_trend(window),
        "priority_split": priority_split(window["start"], window["end"]),
        "source_performance": source_performance(window["start"], window["end"]),
        "customer_growth": customer_growth(window),
        "task_completion": task_completion(window),
        "task_backlog": task_backlog(),
        "support_metrics": support_metrics(window),
        "team_workload": team_workload(),
        "activity_trend": activity_trend(window),
    }


def global_counts() -> dict:
    """Current-state counters used by the dashboard KPI cards."""
    return {
        "total_leads": db.session.execute(select(func.count(Lead.id))).scalar_one() or 0,
        "open_leads": db.session.execute(
            select(func.count(Lead.id)).where(Lead.status.notin_(("won", "lost")))
        ).scalar_one() or 0,
        "won_leads": db.session.execute(
            select(func.count(Lead.id)).where(Lead.status == "won")
        ).scalar_one() or 0,
        "total_customers": db.session.execute(select(func.count(Customer.id))).scalar_one() or 0,
        "active_customers": db.session.execute(
            select(func.count(Customer.id)).where(Customer.status.in_(("active", "onboarding")))
        ).scalar_one() or 0,
        "at_risk_customers": db.session.execute(
            select(func.count(Customer.id)).where(Customer.status == "at_risk")
        ).scalar_one() or 0,
        "pending_tasks": db.session.execute(
            select(func.count(Task.id)).where(Task.status != "completed")
        ).scalar_one() or 0,
        "completed_tasks": db.session.execute(
            select(func.count(Task.id)).where(Task.status == "completed")
        ).scalar_one() or 0,
        "open_tickets": db.session.execute(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.status.notin_(("resolved", "closed"))
            )
        ).scalar_one() or 0,
        "resolved_tickets": db.session.execute(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.status == "resolved"
            )
        ).scalar_one() or 0,
        "unread_notifications": 0,
        "team_size": db.session.execute(
            select(func.count(User.id)).where(User.status == "active")
        ).scalar_one() or 0,
        "pipeline_value": float(
            db.session.execute(
                select(func.coalesce(func.sum(Lead.expected_value), 0)).where(
                    Lead.status.notin_(("won", "lost"))
                )
            ).scalar_one()
        ),
        "won_value": float(
            db.session.execute(
                select(func.coalesce(func.sum(Lead.expected_value), 0)).where(
                    Lead.status == "won"
                )
            ).scalar_one()
        ),
        "active_revenue": float(
            db.session.execute(
                select(func.coalesce(func.sum(Customer.account_value), 0)).where(
                    Customer.status.in_(("active", "onboarding"))
                )
            ).scalar_one()
        ),
        "won_lead_value": float(
            db.session.execute(
                select(func.coalesce(func.sum(Customer.account_value), 0))
            ).scalar_one()
        ),
    }


def compact_number(value) -> float:
    """Round a possibly-Decimal aggregate to a JSON-safe float."""
    if isinstance(value, Decimal):
        return float(value)
    return float(value or 0)