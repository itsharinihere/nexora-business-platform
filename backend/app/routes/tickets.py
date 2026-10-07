"""Support ticket endpoints."""

from flask import Blueprint, g, request
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from config.settings import get_config
from ..constants import TICKET_CATEGORIES, TICKET_STATUSES
from ..extensions import db
from ..models import Activity, SupportTicket, User, utcnow
from ..services.activity import log_activity
from ..services.notifications import notify
from ..utils.auth import auth_required, roles_required
from ..utils.errors import NotFoundError, ValidationError
from ..utils.pagination import apply_pagination, get_bool_arg, get_pagination, get_sort
from ..utils.reference import next_ticket_reference
from ..utils.responses import created, paginated, success
from ..utils.validation import (
    require_json,
    validate_email_field,
    validate_string,
    validate_task_priority,
    validate_ticket_category,
    validate_ticket_status,
    validate_user_id,
)

bp = Blueprint("tickets", __name__, url_prefix="/api/tickets")

SORTABLE = ("created_at", "subject", "status", "priority", "resolved_at")


def _get_ticket_or_404(ticket_id: int) -> SupportTicket:
    ticket = db.session.get(SupportTicket, ticket_id)
    if ticket is None:
        raise NotFoundError("That support ticket could not be found.")
    return ticket


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


def _sla_breached(ticket: SupportTicket) -> bool:
    sla = get_config().SUPPORT_SLA_HOURS
    return ticket.is_open and ticket.age_hours > sla.get(ticket.priority, sla["medium"])


@bp.get("")
@auth_required()
def list_tickets():
    query = db.session.query(SupportTicket).options(
        joinedload(SupportTicket.assignee), joinedload(SupportTicket.requester)
    )

    search = (request.args.get("search") or "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                SupportTicket.subject.ilike(pattern),
                SupportTicket.reference.ilike(pattern),
                SupportTicket.description.ilike(pattern),
                SupportTicket.requester_name.ilike(pattern),
            )
        )

    status = request.args.get("status")
    if status and status != "all":
        validate_ticket_status(status, required=True)
        query = query.filter(SupportTicket.status == status)

    category = request.args.get("category")
    if category and category != "all":
        validate_ticket_category(category, required=True)
        query = query.filter(SupportTicket.category == category)

    priority = request.args.get("priority")
    if priority and priority != "all":
        validate_task_priority(priority, required=True)
        query = query.filter(SupportTicket.priority == priority)

    assignee = request.args.get("assignee")
    if assignee and assignee != "all":
        if assignee == "unassigned":
            query = query.filter(SupportTicket.assignee_id.is_(None))
        elif assignee == "me":
            query = query.filter(SupportTicket.assignee_id == g.current_user.id)
        else:
            query = query.filter(SupportTicket.assignee_id == assignee)

    if get_bool_arg("breach"):
        # SLA targets are static per priority, so the breach set is computed in
        # Python rather than encoded as SQL.
        ids = [t.id for t in db.session.query(SupportTicket).all() if _sla_breached(t)]
        query = query.filter(SupportTicket.id.in_(ids or [-1]))

    field, order = get_sort("created_at", SORTABLE)
    sort_column = getattr(SupportTicket, field)
    query = query.order_by(sort_column.asc() if order == "asc" else sort_column.desc())

    pagination = get_pagination()
    items, meta = apply_pagination(query, pagination)

    counts = {
        s: db.session.query(SupportTicket).filter(SupportTicket.status == s).count()
        for s in TICKET_STATUSES
    }
    counts["all"] = db.session.query(SupportTicket).count()

    payload = [t.to_dict() for t in items]
    for item, ticket in zip(payload, items):
        item["sla_breached"] = _sla_breached(ticket)

    return paginated(
        payload, meta, extra={"counts": counts, "filters": {"status": status or "all"}}
    )


@bp.post("")
@auth_required()
def create_ticket():
    payload = require_json(request.get_json(silent=True))

    ticket = SupportTicket(
        reference=next_ticket_reference(),
        subject=validate_string(payload.get("subject"), "Subject", max_length=180, min_length=3),
        description=validate_string(
            payload.get("description"), "Description", max_length=4000, min_length=5
        ),
        category=validate_ticket_category(payload.get("category")) or "technical",
        priority=validate_task_priority(payload.get("priority")) or "medium",
        status=validate_ticket_status(payload.get("status")) or "open",
        requester_id=g.current_user.id,
        requester_name=validate_string(
            payload.get("requester_name"), "Requester name", required=False, max_length=120
        ),
        requester_email=validate_email_field(payload.get("requester_email"), required=False),
        assignee_id=_validate_assignee(
            validate_user_id(payload.get("assignee_id"), "assignee_id", required=False)
        ),
        created_at=utcnow(),
    )
    ticket.requester_name = ticket.requester_name or g.current_user.name
    ticket.requester_email = ticket.requester_email or g.current_user.email

    db.session.add(ticket)
    db.session.flush()

    log_activity(
        "ticket.created",
        description=f"{g.current_user.name} opened ticket {ticket.reference} \"{ticket.subject}\"",
        entity_type="ticket",
        entity_id=ticket.id,
        entity_label=ticket.reference,
        metadata={"priority": ticket.priority, "category": ticket.category},
    )
    if ticket.assignee_id:
        notify(
            ticket.assignee_id,
            "support_ticket",
            f"Ticket {ticket.reference} assigned to you",
            f"{ticket.subject} ({ticket.priority} priority).",
            f"/app/support/{ticket.id}",
        )
    db.session.commit()

    return created({"ticket": ticket.to_dict(detailed=True), "sla_breached": _sla_breached(ticket)})


@bp.get("/<int:ticket_id>")
@auth_required()
def get_ticket(ticket_id: int):
    ticket = _get_ticket_or_404(ticket_id)
    history = (
        db.session.query(Activity)
        .filter(Activity.entity_type == "ticket", Activity.entity_id == ticket.id)
        .order_by(Activity.created_at.desc())
        .all()
    )
    return success(
        {
            "ticket": ticket.to_dict(detailed=True),
            "sla_breached": _sla_breached(ticket),
            "sla_target_hours": get_config().SUPPORT_SLA_HOURS.get(
                ticket.priority, get_config().SUPPORT_SLA_HOURS["medium"]
            ),
            "activity": [a.to_dict() for a in history],
        }
    )


@bp.patch("/<int:ticket_id>")
@auth_required()
def update_ticket(ticket_id: int):
    ticket = _get_ticket_or_404(ticket_id)
    payload = require_json(request.get_json(silent=True))
    changes: list[str] = []

    if "subject" in payload:
        ticket.subject = validate_string(payload["subject"], "Subject", max_length=180, min_length=3)
        changes.append("subject")
    if "description" in payload:
        ticket.description = validate_string(
            payload["description"], "Description", max_length=4000, min_length=5
        )
        changes.append("description")
    if "category" in payload:
        ticket.category = validate_ticket_category(payload["category"]) or ticket.category
        changes.append("category")
    if "priority" in payload:
        ticket.priority = validate_task_priority(payload["priority"]) or ticket.priority
        changes.append("priority")

    if "assignee_id" in payload:
        new_assignee = _validate_assignee(validate_user_id(payload["assignee_id"], "assignee_id", required=False))
        if new_assignee != ticket.assignee_id:
            previous = ticket.assignee.name if ticket.assignee else "nobody"
            ticket.assignee_id = new_assignee
            changes.append("assignee")
            target = db.session.get(User, new_assignee) if new_assignee else None
            log_activity(
                "ticket.assigned",
                description=(
                    f"{ticket.reference} was assigned to {target.name}"
                    if target
                    else f"{ticket.reference} was unassigned (previously {previous})"
                ),
                entity_type="ticket",
                entity_id=ticket.id,
                entity_label=ticket.reference,
            )
            if target:
                notify(
                    target.id,
                    "assignment",
                    f"Ticket {ticket.reference} assigned to you",
                    f"{ticket.subject}",
                    f"/app/support/{ticket.id}",
                )
            # First meaningful action on an unassigned ticket counts as the
            # first response, which is what the response-time metric tracks.
            if ticket.first_response_at is None:
                ticket.first_response_at = utcnow()

    if "status" in payload:
        new_status = validate_ticket_status(payload["status"], required=True)
        if new_status != ticket.status:
            previous_status = ticket.status
            ticket.status = new_status
            changes.append("status")

            if ticket.first_response_at is None and new_status != "open":
                ticket.first_response_at = utcnow()

            if new_status == "resolved":
                ticket.resolved_at = utcnow()
                log_activity(
                    "ticket.resolved",
                    description=f"{g.current_user.name} resolved ticket {ticket.reference}",
                    entity_type="ticket",
                    entity_id=ticket.id,
                    entity_label=ticket.reference,
                    metadata={"resolution_hours": ticket.resolution_hours},
                )
                if ticket.requester_id and ticket.requester_id != g.current_user.id:
                    notify(
                        ticket.requester_id,
                        "support_ticket",
                        f"{ticket.reference} resolved",
                        f"\"{ticket.subject}\" has been marked resolved.",
                        f"/app/support/{ticket.id}",
                    )
            else:
                ticket.resolved_at = None
                log_activity(
                    "ticket.status_changed",
                    description=f"{ticket.reference} moved from {previous_status} to {new_status}",
                    entity_type="ticket",
                    entity_id=ticket.id,
                    entity_label=ticket.reference,
                    metadata={"from": previous_status, "to": new_status},
                )

    ticket.updated_at = utcnow()
    if changes and "status" not in changes:
        log_activity(
            "ticket.updated",
            description=f"{g.current_user.name} updated {', '.join(sorted(set(changes)))} on {ticket.reference}",
            entity_type="ticket",
            entity_id=ticket.id,
            entity_label=ticket.reference,
            metadata={"fields": sorted(set(changes))},
        )
    db.session.commit()

    return success({"ticket": ticket.to_dict(detailed=True), "sla_breached": _sla_breached(ticket)})


@bp.delete("/<int:ticket_id>")
@auth_required()
@roles_required("admin", "manager")
def delete_ticket(ticket_id: int):
    ticket = _get_ticket_or_404(ticket_id)
    reference, subject = ticket.reference, ticket.subject

    db.session.delete(ticket)
    log_activity(
        "ticket.updated",
        description=f"{g.current_user.name} deleted ticket {reference}",
        entity_type="ticket",
        entity_label=reference,
    )
    db.session.commit()

    return success({"message": f"Ticket {reference} deleted."})


@bp.post("/<int:ticket_id>/respond")
@auth_required()
def respond_to_ticket(ticket_id: int):
    """Acknowledge a ticket, stamping the first-response timestamp."""
    ticket = _get_ticket_or_404(ticket_id)
    if ticket.first_response_at is None:
        ticket.first_response_at = utcnow()
        ticket.updated_at = utcnow()
        log_activity(
            "ticket.updated",
            description=f"{g.current_user.name} responded to {ticket.reference}",
            entity_type="ticket",
            entity_id=ticket.id,
            entity_label=ticket.reference,
            metadata={"response_hours": ticket.response_hours},
        )
        db.session.commit()

    return success({"ticket": ticket.to_dict(detailed=True)})