"""Dashboard aggregate endpoint.

One request returns everything the landing dashboard renders, so the page does
not fire six parallel calls on first paint.
"""

from datetime import timedelta

from flask import Blueprint, g
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from ..extensions import db
from ..models import Activity, Lead, SupportTicket, Task, User, utcnow
from ..services import analytics, insights
from ..services.notifications import unread_count
from ..utils.auth import auth_required
from ..utils.responses import success

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@bp.get("")
@auth_required()
def dashboard():
    window = analytics.resolve_range("30d")
    counts = analytics.global_counts()
    user = g.current_user

    # Recent activity, excluding the noise of the user's own logins.
    recent = (
        db.session.execute(
            select(Activity)
            .options(joinedload(Activity.actor))
            .where(Activity.action != "auth.login")
            .order_by(Activity.created_at.desc())
            .limit(12)
        )
        .scalars()
        .all()
    )

    # Upcoming = open tasks with a due date, soonest first.
    today = utcnow().date()
    upcoming = (
        db.session.execute(
            select(Task)
            .options(joinedload(Task.assignee))
            .where(Task.status != "completed", Task.due_date.is_not(None))
            .order_by(Task.due_date.asc())
            .limit(6)
        )
        .scalars()
        .all()
    )

    my_open_tasks = (
        db.session.execute(
            select(func.count(Task.id)).where(
                Task.status != "completed", Task.assignee_id == user.id
            )
        ).scalar_one()
        or 0
    )

    backlog = analytics.task_backlog()
    support = analytics.support_metrics(
        {"start": window["start"], "end": window["end"], "buckets": []}
    )

    # Counters behind the "needs attention" panel. Each maps to one insight rule.
    attention = {
        "high_priority_tasks": backlog["high_priority_open"],
        "overdue_tasks": backlog["overdue"],
        "due_today": backlog["due_today"],
        "unassigned_tasks": backlog["unassigned"],
        "unassigned_tickets": support["unassigned_open"],
        "open_tickets": support["open_now"],
        "stale_leads": sum(1 for l in db.session.query(Lead).all() if l.is_overdue),
        "at_risk_customers": counts["at_risk_customers"],
    }

    return success(
        {
            "greeting": {
                "name": user.name.split()[0],
                "full_name": user.name,
                "date": today.isoformat(),
                "role": user.role_name,
                "my_open_tasks": my_open_tasks,
            },
            "stats": counts,
            "unread_notifications": unread_count(user.id),
            "charts": {
                "lead_trend": analytics.lead_trend(window),
                "lead_funnel": analytics.lead_funnel(window["start"], window["end"]),
                "task_completion": analytics.task_completion(window),
                "support_metrics": analytics.support_metrics(window),
            },
            "recent_activity": [a.to_dict() for a in recent],
            "upcoming_tasks": [t.to_dict() for t in upcoming],
            "insights": insights.generate_insights("30d"),
            "attention": attention,
        }
    )


@bp.get("/my-tasks")
@auth_required()
def my_tasks():
    """Tasks assigned to the signed-in user, for the dashboard side panel."""
    tasks = (
        db.session.execute(
            select(Task)
            .options(joinedload(Task.assignee))
            .where(Task.status != "completed", Task.assignee_id == g.current_user.id)
            .order_by(Task.due_date.is_(None), Task.due_date.asc())
            .limit(20)
        )
        .scalars()
        .all()
    )
    return success({"tasks": [t.to_dict() for t in tasks]})


@bp.get("/my-tickets")
@auth_required()
def my_tickets():
    tickets = (
        db.session.execute(
            select(SupportTicket)
            .options(joinedload(SupportTicket.requester))
            .where(
                SupportTicket.status.notin_(("resolved", "closed")),
                SupportTicket.assignee_id == g.current_user.id,
            )
            .order_by(SupportTicket.created_at.desc())
            .limit(20)
        )
        .scalars()
        .all()
    )
    return success({"tickets": [t.to_dict() for t in tickets]})


@bp.get("/workload")
@auth_required()
def workload():
    return success({"workload": analytics.team_workload()})


@bp.get("/due-soon")
@auth_required()
def due_soon():
    """Everything crossing a deadline in the next week, for reminder jobs."""
    today = utcnow().date()
    horizon = today + timedelta(days=7)

    tasks = (
        db.session.query(Task)
        .filter(
            Task.status != "completed",
            Task.due_date.is_not(None),
            Task.due_date <= horizon,
        )
        .order_by(Task.due_date.asc())
        .all()
    )
    tickets = (
        db.session.query(SupportTicket)
        .filter(SupportTicket.status.notin_(("resolved", "closed")))
        .order_by(SupportTicket.created_at.asc())
        .limit(10)
        .all()
    )
    return success(
        {
            "tasks": [t.to_dict() for t in tasks],
            "tickets": [t.to_dict() for t in tickets],
            "assignees": [u.to_dict() for u in db.session.query(User).filter(User.status == "active").all()],
        }
    )