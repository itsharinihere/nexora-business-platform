"""Customer account endpoints."""

from flask import Blueprint, g, request
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from ..constants import CUSTOMER_STATUSES
from ..extensions import db
from ..models import Activity, Customer, Lead, User, utcnow
from ..services.activity import log_activity
from ..utils.auth import auth_required, roles_required
from ..utils.errors import NotFoundError, ValidationError
from ..utils.pagination import apply_pagination, get_pagination, get_sort
from ..utils.reference import next_customer_reference
from ..utils.responses import created, paginated, success
from ..utils.validation import (
    require_json,
    validate_customer_status,
    validate_email_field,
    validate_industry,
    validate_money,
    validate_phone,
    validate_string,
    validate_user_id,
)

bp = Blueprint("customers", __name__, url_prefix="/api/customers")

SORTABLE = ("created_at", "name", "company", "status", "account_value", "health_score", "last_interaction_at")


def _get_customer_or_404(customer_id: int) -> Customer:
    customer = db.session.get(Customer, customer_id)
    if customer is None:
        raise NotFoundError("That customer could not be found.")
    return customer


def _validate_owner(owner_id):
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


@bp.get("")
@auth_required()
def list_customers():
    query = db.session.query(Customer).options(joinedload(Customer.owner))

    search = (request.args.get("search") or "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Customer.name.ilike(pattern),
                Customer.company.ilike(pattern),
                Customer.email.ilike(pattern),
                Customer.reference.ilike(pattern),
            )
        )

    status = request.args.get("status")
    if status and status != "all":
        validate_customer_status(status, required=True)
        query = query.filter(Customer.status == status)

    industry = request.args.get("industry")
    if industry and industry != "all":
        validate_industry(industry, required=True)
        query = query.filter(Customer.industry == industry)

    owner = request.args.get("owner")
    if owner and owner != "all":
        if owner == "unassigned":
            query = query.filter(Customer.owner_id.is_(None))
        else:
            query = query.filter(Customer.owner_id == owner)

    field, order = get_sort("created_at", SORTABLE)
    sort_column = getattr(Customer, field)
    query = query.order_by(sort_column.asc() if order == "asc" else sort_column.desc())

    pagination = get_pagination()
    items, meta = apply_pagination(query, pagination)

    counts = {
        s: db.session.query(Customer).filter(Customer.status == s).count()
        for s in CUSTOMER_STATUSES
    }
    counts["all"] = db.session.query(Customer).count()

    return paginated(
        [c.to_dict() for c in items], meta, extra={"counts": counts, "filters": {"status": status or "all"}}
    )


@bp.post("")
@auth_required()
def create_customer():
    payload = require_json(request.get_json(silent=True))

    customer = Customer(
        reference=next_customer_reference(),
        name=validate_string(payload.get("name"), "Name", max_length=120, min_length=2),
        company=validate_string(payload.get("company"), "Company", max_length=140, min_length=2),
        email=validate_email_field(payload.get("email"), required=False),
        phone=validate_phone(payload.get("phone")),
        industry=validate_industry(payload.get("industry")) or "Technology",
        status=validate_customer_status(payload.get("status")) or "active",
        account_value=validate_money(payload.get("account_value"), "account_value"),
        owner_id=_validate_owner(validate_user_id(payload.get("owner_id"), "owner_id", required=False)),
        notes=validate_string(payload.get("notes"), "Notes", required=False, max_length=4000),
        health_score=int(payload.get("health_score") or 85),
        created_at=utcnow(),
        last_interaction_at=utcnow(),
    )
    db.session.add(customer)
    db.session.flush()

    log_activity(
        "customer.created",
        description=f"{g.current_user.name} created customer {customer.reference} for {customer.company}",
        entity_type="customer",
        entity_id=customer.id,
        entity_label=f"{customer.company} ({customer.name})",
    )
    db.session.commit()

    return created({"customer": customer.to_dict(detailed=True)})


@bp.get("/<int:customer_id>")
@auth_required()
def get_customer(customer_id: int):
    customer = _get_customer_or_404(customer_id)

    # Activity history for this account, newest first.
    history = (
        db.session.query(Activity)
        .filter(
            or_(
                db.and_(Activity.entity_type == "customer", Activity.entity_id == customer.id),
                Activity.entity_label == customer.reference,
            )
        )
        .order_by(Activity.created_at.desc())
        .limit(50)
        .all()
    )

    open_leads = (
        db.session.query(Lead).filter(Lead.customer_id == customer.id).order_by(Lead.created_at.desc()).all()
    )

    return success(
        {
            "customer": customer.to_dict(detailed=True),
            "activity": [a.to_dict() for a in history],
            "linked_leads": [l.to_dict() for l in open_leads],
            "stats": {
                "linked_leads": len(open_leads),
                "days_as_customer": (utcnow().date() - customer.created_at.date()).days,
                "health_score": customer.health_score,
                "account_value": float(customer.account_value or 0),
            },
        }
    )


@bp.patch("/<int:customer_id>")
@auth_required()
def update_customer(customer_id: int):
    customer = _get_customer_or_404(customer_id)
    payload = require_json(request.get_json(silent=True))
    changes: list[str] = []

    if "name" in payload:
        customer.name = validate_string(payload["name"], "Name", max_length=120, min_length=2)
        changes.append("name")
    if "company" in payload:
        customer.company = validate_string(payload["company"], "Company", max_length=140, min_length=2)
        changes.append("company")
    if "email" in payload:
        customer.email = validate_email_field(payload["email"], required=False)
        changes.append("email")
    if "phone" in payload:
        customer.phone = validate_phone(payload["phone"])
        changes.append("phone")
    if "industry" in payload:
        customer.industry = validate_industry(payload["industry"]) or customer.industry
        changes.append("industry")
    if "status" in payload:
        new_status = validate_customer_status(payload["status"], required=True)
        if new_status != customer.status:
            previous = customer.status
            customer.status = new_status
            changes.append("status")
            # A status change is a meaningful moment; refresh the touch time.
            customer.last_interaction_at = utcnow()
            log_activity(
                "customer.updated",
                description=f"{customer.reference} moved from {previous} to {new_status}",
                entity_type="customer",
                entity_id=customer.id,
                entity_label=customer.reference,
                metadata={"from": previous, "to": new_status},
            )
    if "account_value" in payload:
        customer.account_value = validate_money(payload["account_value"], "account_value")
        changes.append("account_value")
    if "health_score" in payload:
        try:
            score = int(payload["health_score"])
        except (TypeError, ValueError):
            raise ValidationError("Health score must be a number.", {"health_score": "Enter 0-100."})
        if not 0 <= score <= 100:
            raise ValidationError(
                "Health score must be between 0 and 100.", {"health_score": "Enter 0-100."}
            )
        customer.health_score = score
        changes.append("health_score")
    if "notes" in payload:
        customer.notes = validate_string(payload["notes"], "Notes", required=False, max_length=4000)
        changes.append("notes")
    if "owner_id" in payload:
        customer.owner_id = _validate_owner(validate_user_id(payload["owner_id"], "owner_id", required=False))
        changes.append("owner")

    customer.updated_at = utcnow()
    if changes:
        log_activity(
            "customer.updated",
            description=f"{g.current_user.name} updated {', '.join(sorted(set(changes)))} on {customer.reference}",
            entity_type="customer",
            entity_id=customer.id,
            entity_label=customer.reference,
            metadata={"fields": sorted(set(changes))},
        )
    db.session.commit()

    return success({"customer": customer.to_dict(detailed=True)})


@bp.delete("/<int:customer_id>")
@auth_required()
@roles_required("admin", "manager")
def delete_customer(customer_id: int):
    customer = _get_customer_or_404(customer_id)
    reference, company = customer.reference, customer.company

    # Keep won leads but detach them so the funnel history survives.
    db.session.query(Lead).filter(Lead.customer_id == customer.id).update({"customer_id": None})

    db.session.delete(customer)
    log_activity(
        "customer.deleted",
        description=f"{g.current_user.name} deleted customer {reference} ({company})",
        entity_type="customer",
        entity_label=reference,
    )
    db.session.commit()

    return success({"message": f"Customer {reference} deleted."})