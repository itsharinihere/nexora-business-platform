"""Team directory endpoints with workload roll-ups."""

from flask import Blueprint, g, request
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from ..constants import ROLE_NAMES
from ..extensions import db
from ..models import Role, User, utcnow
from ..services.activity import log_activity
from ..utils.auth import auth_required, roles_required
from ..utils.errors import ConflictError, NotFoundError, ValidationError
from ..utils.responses import created, success
from ..utils.validation import (
    require_json,
    validate_email,
    validate_password,
    validate_string,
    validate_user_status,
)

bp = Blueprint("team", __name__, url_prefix="/api/team")


def _ensure_roles_exist() -> dict[str, Role]:
    roles = {role.name: role for role in db.session.query(Role).all()}
    defaults = {
        "admin": ("Administrator", "Full access to every module and setting."),
        "manager": ("Manager", "Manages records, team workload and reporting."),
        "employee": ("Employee", "Works on assigned leads, tasks and tickets."),
    }
    created = False
    for name, (label, description) in defaults.items():
        if name not in roles:
            role = Role(name=name, label=label, description=description)
            db.session.add(role)
            roles[name] = role
            created = True
    if created:
        db.session.commit()
    return roles


def _get_member_or_404(user_id: int) -> User:
    member = db.session.get(User, user_id)
    if member is None:
        raise NotFoundError("That team member could not be found.")
    return member


@bp.get("")
@auth_required()
def list_team():
    query = db.session.query(User).options(joinedload(User.role))

    search = (request.args.get("search") or "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(User.name.ilike(pattern), User.email.ilike(pattern), User.department.ilike(pattern))
        )

    status = request.args.get("status")
    if status and status != "all":
        validate_user_status(status, required=True)
        query = query.filter(User.status == status)

    role = request.args.get("role")
    if role and role != "all":
        if role not in ROLE_NAMES:
            raise ValidationError("Unknown role filter.", {"role": "Invalid role."})
        query = query.join(User.role).filter(Role.name == role)

    members = query.order_by(User.name.asc()).all()

    from ..services import analytics

    workload_by_id = {row["user"]["id"]: row for row in analytics.team_workload()}

    payload = []
    for member in members:
        stats = workload_by_id.get(
            member.id,
            {
                "open_tasks": 0,
                "overdue_tasks": 0,
                "open_tickets": 0,
                "open_leads": 0,
                "completed_tasks": 0,
                "workload_score": 0.0,
            },
        )
        payload.append({**member.to_dict(), "workload": stats})

    # The directory defaults to name order; the UI can re-rank by workload,
    # lead ownership or department without another round trip.
    sort = (request.args.get("sort") or "name").strip().lower()
    sorters = {
        "name": lambda m: (m["name"].lower(),),
        "workload": lambda m: (-m["workload"]["workload_score"], m["name"].lower()),
        "open_tasks": lambda m: (-m["workload"]["open_tasks"], m["name"].lower()),
        "open_leads": lambda m: (-m["workload"]["open_leads"], m["name"].lower()),
        "department": lambda m: ((m["department"] or "").lower(), m["name"].lower()),
        "created_at": lambda m: (m["created_at"] or "",),
    }
    if sort not in sorters:
        raise ValidationError(
            f"Cannot sort by `{sort}`. Allowed: {', '.join(sorters)}.", {"sort": "Invalid sort."}
        )
    payload.sort(key=sorters[sort])

    return success(
        {
            "members": payload,
            "sort": sort,
            "roles": [r.to_dict() for r in db.session.query(Role).order_by(Role.id).all()],
            "summary": {
                "total": db.session.query(User).count(),
                "active": db.session.query(User).filter(User.status == "active").count(),
                "invited": db.session.query(User).filter(User.status == "invited").count(),
                "inactive": db.session.query(User).filter(User.status == "inactive").count(),
            },
        }
    )


@bp.post("")
@auth_required()
@roles_required("admin")
def invite_member():
    payload = require_json(request.get_json(silent=True))

    name = validate_string(payload.get("name"), "Name", max_length=120, min_length=2)
    email = validate_email(payload.get("email"))
    password = validate_password(payload.get("password"))
    role_name = payload.get("role") or "employee"
    if role_name not in ROLE_NAMES:
        raise ValidationError("Select a valid role.", {"role": "Invalid role."})

    if db.session.query(User).filter(User.email == email).first():
        raise ConflictError(
            "A member with that email already exists.", details={"email": "Email already in use."}
        )

    roles = _ensure_roles_exist()
    member = User(
        name=name,
        email=email,
        role_id=roles[role_name].id,
        title=validate_string(payload.get("title"), "Title", required=False, max_length=120),
        department=validate_string(payload.get("department"), "Department", required=False, max_length=80),
        phone=validate_string(payload.get("phone"), "Phone", required=False, max_length=40),
        location=validate_string(payload.get("location"), "Location", required=False, max_length=120),
        status="active",
    )
    member.set_password(password)
    db.session.add(member)
    db.session.flush()

    log_activity(
        "team.member_created",
        description=f"{g.current_user.name} added {member.name} to the team as {role_name}",
        entity_type="user",
        entity_id=member.id,
        entity_label=member.name,
    )
    db.session.commit()

    return created({"member": member.to_dict(detailed=True)})


@bp.get("/<int:user_id>")
@auth_required()
def get_member(user_id: int):
    member = _get_member_or_404(user_id)

    from ..models import Lead, SupportTicket, Task
    from ..services import analytics

    stats = next(
        (row for row in analytics.team_workload() if row["user"]["id"] == member.id),
        {},
    )

    recent_tasks = (
        db.session.query(Task)
        .filter(Task.assignee_id == member.id)
        .order_by(Task.updated_at.desc())
        .limit(10)
        .all()
    )
    open_tickets = (
        db.session.query(SupportTicket)
        .filter(
            SupportTicket.assignee_id == member.id,
            SupportTicket.status.notin_(("resolved", "closed")),
        )
        .order_by(SupportTicket.created_at.desc())
        .limit(10)
        .all()
    )
    owned_leads = (
        db.session.query(Lead)
        .filter(Lead.owner_id == member.id, Lead.status.notin_(("won", "lost")))
        .order_by(Lead.created_at.desc())
        .limit(10)
        .all()
    )

    return success(
        {
            "member": member.to_dict(detailed=True),
            "workload": stats,
            "recent_tasks": [t.to_dict() for t in recent_tasks],
            "open_tickets": [t.to_dict() for t in open_tickets],
            "owned_leads": [l.to_dict() for l in owned_leads],
        }
    )


@bp.patch("/<int:user_id>")
@auth_required()
@roles_required("admin")
def update_member(user_id: int):
    member = _get_member_or_404(user_id)
    payload = require_json(request.get_json(silent=True))
    changes: list[str] = []

    # Guard against an admin locking themselves out of their own account.
    if member.id == g.current_user.id:
        if payload.get("role") and payload["role"] != member.role_name:
            raise ValidationError(
                "You cannot change your own role.", {"role": "Ask another administrator."}
            )
        if payload.get("status") and payload["status"] != "active":
            raise ValidationError(
                "You cannot deactivate your own account.", {"status": "Ask another administrator."}
            )

    if "name" in payload:
        member.name = validate_string(payload["name"], "Name", max_length=120, min_length=2)
        changes.append("name")
    if "title" in payload:
        member.title = validate_string(payload["title"], "Title", required=False, max_length=120)
        changes.append("title")
    if "department" in payload:
        member.department = validate_string(
            payload["department"], "Department", required=False, max_length=80
        )
        changes.append("department")
    if "phone" in payload:
        member.phone = validate_string(payload["phone"], "Phone", required=False, max_length=40)
        changes.append("phone")
    if "location" in payload:
        member.location = validate_string(payload["location"], "Location", required=False, max_length=120)
        changes.append("location")
    if "status" in payload:
        member.status = validate_user_status(payload["status"], required=True)
        changes.append("status")
    if "role" in payload:
        role_name = payload["role"]
        if role_name not in ROLE_NAMES:
            raise ValidationError("Select a valid role.", {"role": "Invalid role."})
        roles = _ensure_roles_exist()
        member.role_id = roles[role_name].id
        changes.append("role")

    member.updated_at = utcnow()
    if changes:
        log_activity(
            "team.member_updated",
            description=f"{g.current_user.name} updated {', '.join(sorted(set(changes)))} for {member.name}",
            entity_type="user",
            entity_id=member.id,
            entity_label=member.name,
            metadata={"fields": sorted(set(changes))},
        )
    db.session.commit()

    return success({"member": member.to_dict(detailed=True)})


@bp.post("/<int:user_id>/reset-password")
@auth_required()
@roles_required("admin")
def reset_member_password(user_id: int):
    member = _get_member_or_404(user_id)
    payload = require_json(request.get_json(silent=True))
    member.set_password(validate_password(payload.get("password")))

    log_activity(
        "team.member_updated",
        description=f"{g.current_user.name} reset the password for {member.name}",
        entity_type="user",
        entity_id=member.id,
        entity_label=member.name,
    )
    db.session.commit()

    return success({"message": f"Password reset for {member.name}."})