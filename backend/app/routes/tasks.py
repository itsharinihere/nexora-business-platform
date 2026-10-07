"""Task endpoints, including the Kanban board payload."""

from datetime import timedelta

from flask import Blueprint, g, request
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from ..constants import TASK_PRIORITIES, TASK_STATUSES
from ..extensions import db
from ..models import Task, User, utcnow
from ..services.activity import log_activity
from ..services.notifications import notify
from ..utils.auth import auth_required
from ..utils.errors import NotFoundError, ValidationError
from ..utils.pagination import apply_pagination, get_bool_arg, get_pagination, get_sort
from ..utils.reference import next_task_reference
from ..utils.responses import created, paginated, success
from ..utils.validation import (
    require_json,
    validate_date,
    validate_string,
    validate_task_priority,
    validate_task_status,
    validate_user_id,
)

bp = Blueprint("tasks", __name__, url_prefix="/api/tasks")

SORTABLE = ("created_at", "title", "status", "priority", "due_date", "completed_at")


def _get_task_or_404(task_id: int) -> Task:
    task = db.session.get(Task, task_id)
    if task is None:
        raise NotFoundError("That task could not be found.")
    return task


def _validate_assignee(assignee_id):
    if assignee_id is None:
        return None
    assignee = db.session.get(User, assignee_id)
    if assignee is None:
        raise ValidationError(
            "Select a valid team member.", {"assignee_id": "Unknown team member."}
        )
    if assignee.status != "active":
        raise ValidationError(
            "That team member is not active.",
            {"assignee_id": "Cannot assign inactive members."},
        )
    return assignee.id


def _counts() -> dict:
    counts = {s: db.session.query(Task).filter(Task.status == s).count() for s in TASK_STATUSES}
    counts["all"] = db.session.query(Task).count()
    return counts


@bp.get("")
@auth_required()
def list_tasks():
    query = db.session.query(Task).options(joinedload(Task.assignee))

    search = (request.args.get("search") or "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(Task.title.ilike(pattern), Task.reference.ilike(pattern), Task.description.ilike(pattern))
        )

    status = request.args.get("status")
    if status and status != "all":
        validate_task_status(status, required=True)
        query = query.filter(Task.status == status)

    priority = request.args.get("priority")
    if priority and priority != "all":
        validate_task_priority(priority, required=True)
        query = query.filter(Task.priority == priority)

    assignee = request.args.get("assignee")
    if assignee and assignee != "all":
        if assignee == "unassigned":
            query = query.filter(Task.assignee_id.is_(None))
        elif assignee == "me":
            query = query.filter(Task.assignee_id == g.current_user.id)
        else:
            query = query.filter(Task.assignee_id == assignee)

    due = request.args.get("due")
    today = utcnow().date()
    if due == "today":
        query = query.filter(Task.due_date == today, Task.status != "completed")
    elif due == "week":
        query = query.filter(
            Task.due_date.is_not(None),
            Task.due_date >= today,
            Task.due_date <= today + timedelta(days=7),
            Task.status != "completed",
        )

    if get_bool_arg("overdue"):
        query = query.filter(
            Task.status != "completed", Task.due_date.is_not(None), Task.due_date < today
        )

    field, order = get_sort("created_at", SORTABLE)
    sort_column = getattr(Task, field)
    query = query.order_by(sort_column.asc() if order == "asc" else sort_column.desc())

    pagination = get_pagination()
    items, meta = apply_pagination(query, pagination)
    return paginated(
        [t.to_dict() for t in items], meta, extra={"counts": _counts(), "filters": {"status": status or "all"}}
    )


@bp.get("/board")
@auth_required()
def task_board():
    """All open tasks grouped into Kanban columns."""
    assignee = request.args.get("assignee")
    query = db.session.query(Task).options(joinedload(Task.assignee)).filter(
        Task.status != "completed"
    )
    if assignee == "me":
        query = query.filter(Task.assignee_id == g.current_user.id)
    elif assignee and assignee != "all":
        query = query.filter(Task.assignee_id == assignee)

    tasks = query.order_by(Task.priority.asc(), Task.due_date.is_(None), Task.due_date.asc()).all()

    columns = []
    for status in TASK_STATUSES:
        if status == "completed":
            continue
        items = [t for t in tasks if t.status == status]
        columns.append(
            {
                "status": status,
                "count": len(items),
                "tasks": [t.to_dict() for t in items],
            }
        )

    return success(
        {"columns": columns, "counts": _counts(), "total_open": len(tasks)}
    )


@bp.post("")
@auth_required()
def create_task():
    payload = require_json(request.get_json(silent=True))

    task = Task(
        reference=next_task_reference(),
        title=validate_string(payload.get("title"), "Title", max_length=180, min_length=3),
        description=validate_string(payload.get("description"), "Description", required=False, max_length=4000),
        status=validate_task_status(payload.get("status")) or "todo",
        priority=validate_task_priority(payload.get("priority")) or "medium",
        assignee_id=_validate_assignee(validate_user_id(payload.get("assignee_id"), "assignee_id", required=False)),
        created_by_id=g.current_user.id,
        due_date=validate_date(payload.get("due_date"), "due_date"),
        created_at=utcnow(),
        position=(
            db.session.query(Task)
            .filter(Task.status == (validate_task_status(payload.get("status")) or "todo"))
            .count()
        ),
    )
    if task.status == "completed":
        task.completed_at = utcnow()

    db.session.add(task)
    db.session.flush()

    log_activity(
        "task.created",
        description=f"{g.current_user.name} created task {task.reference} \"{task.title}\"",
        entity_type="task",
        entity_id=task.id,
        entity_label=task.reference,
    )
    if task.assignee_id and task.assignee_id != g.current_user.id:
        notify(
            task.assignee_id,
            "assignment",
            f"New task {task.reference}",
            f"{g.current_user.name} assigned you \"{task.title}\".",
            f"/app/tasks/{task.id}",
        )
    db.session.commit()

    return created({"task": task.to_dict(detailed=True)})


@bp.get("/<int:task_id>")
@auth_required()
def get_task(task_id: int):
    return success({"task": _get_task_or_404(task_id).to_dict(detailed=True)})


@bp.patch("/<int:task_id>")
@auth_required()
def update_task(task_id: int):
    task = _get_task_or_404(task_id)
    payload = require_json(request.get_json(silent=True))
    changes: list[str] = []

    if "title" in payload:
        task.title = validate_string(payload["title"], "Title", max_length=180, min_length=3)
        changes.append("title")
    if "description" in payload:
        task.description = validate_string(
            payload["description"], "Description", required=False, max_length=4000
        )
        changes.append("description")
    if "priority" in payload:
        task.priority = validate_task_priority(payload["priority"]) or task.priority
        changes.append("priority")
    if "due_date" in payload:
        task.due_date = validate_date(payload["due_date"], "due_date")
        changes.append("due_date")
    if "position" in payload:
        try:
            task.position = int(payload["position"])
        except (TypeError, ValueError):
            raise ValidationError("Position must be a whole number.", {"position": "Enter a number."})
        changes.append("position")

    if "assignee_id" in payload:
        new_assignee = _validate_assignee(validate_user_id(payload["assignee_id"], "assignee_id", required=False))
        if new_assignee != task.assignee_id:
            previous = task.assignee.name if task.assignee else "nobody"
            task.assignee_id = new_assignee
            changes.append("assignee")
            target = db.session.get(User, new_assignee) if new_assignee else None
            log_activity(
                "task.assigned",
                description=(
                    f"{task.reference} was assigned to {target.name}"
                    if target
                    else f"{task.reference} was unassigned (previously {previous})"
                ),
                entity_type="task",
                entity_id=task.id,
                entity_label=task.reference,
            )
            if target:
                notify(
                    target.id,
                    "assignment",
                    f"Task {task.reference} assigned to you",
                    f"{g.current_user.name} assigned you \"{task.title}\".",
                    f"/app/tasks/{task.id}",
                )

    if "status" in payload:
        new_status = validate_task_status(payload["status"], required=True)
        if new_status != task.status:
            previous_status = task.status
            task.status = new_status
            changes.append("status")

            if new_status == "completed":
                task.completed_at = utcnow()
                log_activity(
                    "task.completed",
                    description=f"{g.current_user.name} completed task {task.reference}",
                    entity_type="task",
                    entity_id=task.id,
                    entity_label=task.reference,
                    metadata={"title": task.title},
                )
                if task.assignee_id and task.assignee_id != g.current_user.id:
                    notify(
                        task.assignee_id,
                        "task_reminder",
                        f"{task.reference} completed",
                        f"{g.current_user.name} completed \"{task.title}\".",
                        f"/app/tasks/{task.id}",
                    )
            else:
                task.completed_at = None
                log_activity(
                    "task.status_changed",
                    description=f"{task.reference} moved from {previous_status} to {new_status}",
                    entity_type="task",
                    entity_id=task.id,
                    entity_label=task.reference,
                    metadata={"from": previous_status, "to": new_status},
                )

    task.updated_at = utcnow()
    if changes and "status" not in changes:
        log_activity(
            "task.updated",
            description=f"{g.current_user.name} updated {', '.join(sorted(set(changes)))} on {task.reference}",
            entity_type="task",
            entity_id=task.id,
            entity_label=task.reference,
            metadata={"fields": sorted(set(changes))},
        )
    db.session.commit()

    return success({"task": task.to_dict(detailed=True)})


@bp.delete("/<int:task_id>")
@auth_required()
def delete_task(task_id: int):
    task = _get_task_or_404(task_id)
    reference, title = task.reference, task.title

    db.session.delete(task)
    log_activity(
        "task.deleted",
        description=f"{g.current_user.name} deleted task {reference}",
        entity_type="task",
        entity_label=reference,
    )
    db.session.commit()

    return success({"message": f"Task {reference} deleted."})