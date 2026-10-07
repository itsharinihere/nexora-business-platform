"""Lead management endpoints."""

from datetime import datetime, timedelta

from flask import Blueprint, g, request
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from ..constants import LEAD_STATUSES
from ..extensions import db
from ..models import Customer, Lead, User, utcnow
from ..services.activity import log_activity
from ..services.notifications import notify, notify_roles
from ..utils.auth import auth_required, roles_required
from ..utils.errors import NotFoundError, ValidationError
from ..utils.pagination import apply_pagination, get_bool_arg, get_pagination, get_sort
from ..utils.reference import next_customer_reference, next_lead_reference
from ..utils.responses import created, paginated, success
from ..utils.validation import (
    require_json,
    validate_email_field,
    validate_lead_priority,
    validate_lead_source,
    validate_lead_status,
    validate_money,
    validate_phone,
    validate_string,
    validate_user_id,
)

bp = Blueprint("leads", __name__, url_prefix="/api/leads")

SORTABLE = ("created_at", "name", "company", "status", "priority", "expected_value", "last_contacted_at")


def _get_lead_or_404(lead_id: int) -> Lead:
    lead = db.session.get(Lead, lead_id)
    if lead is None:
        raise NotFoundError("That lead could not be found.")
    return lead


def _validate_owner(owner_id):
    """Return a real active user id, or None when unassigned."""
    if owner_id is None:
        return None
    owner = db.session.get(User, owner_id)
    if owner is None:
        raise ValidationError("Select a valid team member.", {"owner_id": "Unknown team member."})
    if owner.status != "active":
        raise ValidationError(
            "That team member is not active.", {"owner_id": "Cannot assign inactive members."}
        )
    return owner.id


def _base_query():
    return db.session.query(Lead).options(joinedload(Lead.owner))


@bp.get("")
@auth_required()
def list_leads():
    query = _base_query()

    search = (request.args.get("search") or "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Lead.name.ilike(pattern),
                Lead.company.ilike(pattern),
                Lead.email.ilike(pattern),
                Lead.reference.ilike(pattern),
            )
        )

    status = request.args.get("status")
    if status and status != "all":
        validate_lead_status(status, required=True)
        query = query.filter(Lead.status == status)

    priority = request.args.get("priority")
    if priority and priority != "all":
        validate_lead_priority(priority, required=True)
        query = query.filter(Lead.priority == priority)

    source = request.args.get("source")
    if source and source != "all":
        validate_lead_source(source, required=True)
        query = query.filter(Lead.source == source)

    owner = request.args.get("owner")
    if owner and owner != "all":
        if owner == "unassigned":
            query = query.filter(Lead.owner_id.is_(None))
        else:
            query = query.filter(Lead.owner_id == owner)

    if get_bool_arg("stale"):
        cutoff = utcnow() - timedelta(days=14)
        query = query.filter(
            Lead.status.notin_(("won", "lost")),
            Lead.last_contacted_at.is_not(None),
            Lead.last_contacted_at < cutoff,
        )

    field, order = get_sort("created_at", SORTABLE)
    sort_column = getattr(Lead, field)
    query = query.order_by(sort_column.asc() if order == "asc" else sort_column.desc())

    pagination = get_pagination()
    items, meta = apply_pagination(query, pagination)

    counts = {
        status: db.session.query(Lead).filter(Lead.status == status).count()
        for status in LEAD_STATUSES
    }
    counts["all"] = db.session.query(Lead).count()

    return paginated(
        [lead.to_dict() for lead in items],
        meta,
        extra={"counts": counts, "filters": {"status": status or "all"}},
    )


@bp.post("")
@auth_required()
def create_lead():
    payload = require_json(request.get_json(silent=True))

    lead = Lead(
        reference=next_lead_reference(),
        name=validate_string(payload.get("name"), "Name", max_length=120, min_length=2),
        company=validate_string(payload.get("company"), "Company", required=False, max_length=140),
        email=validate_email_field(payload.get("email"), required=False),
        phone=validate_phone(payload.get("phone")),
        source=validate_lead_source(payload.get("source")) or "website",
        status=validate_lead_status(payload.get("status")) or "new",
        priority=validate_lead_priority(payload.get("priority")) or "medium",
        owner_id=_validate_owner(validate_user_id(payload.get("owner_id"), "owner_id", required=False)),
        expected_value=validate_money(payload.get("expected_value"), "expected_value"),
        notes=validate_string(payload.get("notes"), "Notes", required=False, max_length=4000),
        created_at=utcnow(),
        last_contacted_at=utcnow(),
    )

    db.session.add(lead)
    db.session.flush()

    log_activity(
        "lead.created",
        description=f"{g.current_user.name} created lead {lead.reference} for {lead.company or lead.name}",
        entity_type="lead",
        entity_id=lead.id,
        entity_label=f"{lead.name} ({lead.company})" if lead.company else lead.name,
        metadata={"status": lead.status, "source": lead.source},
    )
    notify_roles(
        ("admin", "manager"),
        "new_lead",
        f"New lead: {lead.name}",
        f"{lead.reference} was created with {lead.priority} priority.",
        f"/app/leads/{lead.id}",
    )
    db.session.commit()

    return created({"lead": lead.to_dict(detailed=True)})


@bp.get("/<int:lead_id>")
@auth_required()
def get_lead(lead_id: int):
    lead = _get_lead_or_404(lead_id)
    return success({"lead": lead.to_dict(detailed=True)})


@bp.patch("/<int:lead_id>")
@auth_required()
def update_lead(lead_id: int):
    lead = _get_lead_or_404(lead_id)
    payload = require_json(request.get_json(silent=True))
    changes: list[str] = []

    if "name" in payload:
        lead.name = validate_string(payload["name"], "Name", max_length=120, min_length=2)
        changes.append("name")
    if "company" in payload:
        lead.company = validate_string(payload["company"], "Company", required=False, max_length=140)
        changes.append("company")
    if "email" in payload:
        lead.email = validate_email_field(payload["email"], required=False)
        changes.append("email")
    if "phone" in payload:
        lead.phone = validate_phone(payload["phone"])
        changes.append("phone")
    if "source" in payload:
        lead.source = validate_lead_source(payload["source"]) or lead.source
        changes.append("source")
    if "priority" in payload:
        lead.priority = validate_lead_priority(payload["priority"]) or lead.priority
        changes.append("priority")
    if "expected_value" in payload:
        lead.expected_value = validate_money(payload["expected_value"], "expected_value")
        changes.append("expected_value")
    if "notes" in payload:
        lead.notes = validate_string(payload["notes"], "Notes", required=False, max_length=4000)
        changes.append("notes")
    if "owner_id" in payload:
        new_owner = _validate_owner(validate_user_id(payload["owner_id"], "owner_id", required=False))
        if new_owner != lead.owner_id:
            previous = lead.owner.name if lead.owner else "nobody"
            lead.owner_id = new_owner
            target = db.session.get(User, new_owner) if new_owner else None
            log_activity(
                "lead.assigned",
                description=(
                    f"{lead.reference} was assigned to {target.name}"
                    if target
                    else f"{lead.reference} was unassigned (previously {previous})"
                ),
                entity_type="lead",
                entity_id=lead.id,
                entity_label=lead.reference,
            )
            if target:
                notify(
                    target.id,
                    "assignment",
                    f"Lead {lead.reference} assigned to you",
                    f"{g.current_user.name} assigned you {lead.company or lead.name}.",
                    f"/app/leads/{lead.id}",
                )

    if "status" in payload:
        new_status = validate_lead_status(payload["status"], required=True)
        if new_status != lead.status:
            previous_status = lead.status
            lead.status = new_status
            changes.append("status")
            if new_status in ("qualified", "proposal", "won"):
                lead.qualified_at = lead.qualified_at or utcnow()
            if new_status in ("won", "lost"):
                lead.closed_at = utcnow()
            log_activity(
                "lead.status_changed",
                description=f"{lead.reference} moved from {previous_status} to {new_status}",
                entity_type="lead",
                entity_id=lead.id,
                entity_label=lead.reference,
                metadata={"from": previous_status, "to": new_status},
            )

    lead.updated_at = utcnow()

    if changes:
        log_activity(
            "lead.updated",
            description=f"{g.current_user.name} updated {', '.join(sorted(set(changes)))} on {lead.reference}",
            entity_type="lead",
            entity_id=lead.id,
            entity_label=lead.reference,
            metadata={"fields": sorted(set(changes))},
        )
    db.session.commit()

    return success({"lead": lead.to_dict(detailed=True)})


@bp.post("/<int:lead_id>/contact")
@auth_required()
def log_contact(lead_id: int):
    """Record a contact touch, which clears the stale-lead flag."""
    lead = _get_lead_or_404(lead_id)
    lead.last_contacted_at = utcnow()
    if lead.status == "new":
        lead.status = "contacted"
    log_activity(
        "lead.updated",
        description=f"{g.current_user.name} logged contact with {lead.reference}",
        entity_type="lead",
        entity_id=lead.id,
        entity_label=lead.reference,
    )
    db.session.commit()
    return success({"lead": lead.to_dict(detailed=True)})


@bp.post("/<int:lead_id>/convert")
@auth_required()
def convert_lead(lead_id: int):
    """Turn a won lead into a customer account."""
    lead = _get_lead_or_404(lead_id)
    if lead.customer_id:
        raise ValidationError("This lead is already linked to a customer.")
    if lead.status != "won":
        raise ValidationError("Only a lead with status Won can be converted.")

    customer = Customer(
        reference=next_customer_reference(),
        name=lead.name,
        company=lead.company or lead.name,
        email=lead.email,
        phone=lead.phone,
        industry="Technology",
        status="onboarding",
        account_value=lead.expected_value,
        owner_id=lead.owner_id,
        notes=f"Converted from lead {lead.reference}.",
        health_score=90,
        created_at=utcnow(),
        last_interaction_at=utcnow(),
    )
    db.session.add(customer)
    db.session.flush()
    lead.customer_id = customer.id

    log_activity(
        "customer.created",
        description=(
            f"{customer.reference} created by converting {lead.reference} "
            f"({customer.company})"
        ),
        entity_type="customer",
        entity_id=customer.id,
        entity_label=customer.reference,
    )
    db.session.commit()

    return created({"lead": lead.to_dict(detailed=True), "customer": customer.to_dict(detailed=True)})


@bp.delete("/<int:lead_id>")
@auth_required()
@roles_required("admin", "manager")
def delete_lead(lead_id: int):
    lead = _get_lead_or_404(lead_id)
    reference, label = lead.reference, lead.company or lead.name

    if lead.customer_id:
        # Detach rather than cascade-delete a live customer account.
        lead.customer_id = None

    db.session.delete(lead)
    log_activity(
        "lead.deleted",
        description=f"{g.current_user.name} deleted lead {reference} ({label})",
        entity_type="lead",
        entity_id=None,
        entity_label=reference,
    )
    db.session.commit()

    return success({"message": f"Lead {reference} deleted."})