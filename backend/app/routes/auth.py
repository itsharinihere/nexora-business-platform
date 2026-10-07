"""Authentication endpoints: register, login, logout, session identity."""

from flask import Blueprint, g, request
from flask_jwt_extended import create_access_token, get_jwt_identity

from ..extensions import db
from ..models import Role, User, utcnow
from ..services.activity import log_activity
from ..utils.auth import auth_required
from ..utils.errors import AuthenticationError, ConflictError
from ..utils.responses import created, success
from ..utils.validation import (
    require_json,
    validate_email,
    validate_password,
    validate_string,
)

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# Public self-registration always lands on the least privileged role.
DEFAULT_ROLE = "employee"


def _issue_token(user: User) -> str:
    return create_access_token(identity=str(user.id), additional_claims={"role": user.role_name})


def _ensure_roles_exist() -> dict[str, Role]:
    """Create the role rows on first boot."""
    existing = {role.name: role for role in db.session.query(Role).all()}
    defaults = {
        "admin": ("Administrator", "Full access to every module and setting."),
        "manager": ("Manager", "Manages records, team workload and reporting."),
        "employee": ("Employee", "Works on assigned leads, tasks and tickets."),
    }
    for name, (label, description) in defaults.items():
        if name not in existing:
            role = Role(name=name, label=label, description=description)
            db.session.add(role)
            existing[name] = role
    db.session.commit()
    return existing


@bp.post("/register")
def register():
    payload = require_json(request.get_json(silent=True))
    name = validate_string(payload.get("name"), "Name", max_length=120, min_length=2)
    email = validate_email(payload.get("email"))
    password = validate_password(payload.get("password"))

    if db.session.query(User).filter(User.email == email).first():
        raise ConflictError(
            "An account with that email already exists.",
            details={"email": "This email is already registered."},
        )

    roles = _ensure_roles_exist()
    user = User(
        name=name,
        email=email,
        role_id=roles[DEFAULT_ROLE].id,
        status="active",
        title=payload.get("title") or "Team member",
        department=payload.get("department") or "Operations",
    )
    user.set_password(password)
    db.session.add(user)
    db.session.flush()  # assign user.id before writing the activity row

    log_activity(
        "auth.register",
        description=f"{user.name} created an account",
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        entity_label=user.name,
    )
    db.session.commit()

    return created({"user": user.to_dict(detailed=True), "access_token": _issue_token(user)})


@bp.post("/login")
def login():
    payload = require_json(request.get_json(silent=True))
    email = validate_email(payload.get("email"))
    password = payload.get("password") or ""

    user = db.session.query(User).filter(User.email == email).first()

    # Same message and comparable work for both branches so the response does
    # not reveal whether an email is registered.
    if user is None or not user.check_password(password):
        raise AuthenticationError("Email or password is incorrect.")

    if user.status == "inactive":
        raise AuthenticationError("This account has been deactivated.")

    user.last_login_at = utcnow()
    log_activity(
        "auth.login",
        description=f"{user.name} signed in",
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        entity_label=user.name,
    )
    db.session.commit()

    return success({"user": user.to_dict(detailed=True), "access_token": _issue_token(user)})


@bp.post("/logout")
@auth_required()
def logout():
    user = g.current_user
    log_activity(
        "auth.logout",
        description=f"{user.name} signed out",
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        entity_label=user.name,
    )
    db.session.commit()
    # Tokens are stateless and simply expire; the client discards it.
    return success({"message": "Signed out."})


@bp.get("/me")
@auth_required()
def me():
    return success({"user": g.current_user.to_dict(detailed=True)})


@bp.patch("/me")
@auth_required()
def update_me():
    payload = require_json(request.get_json(silent=True))
    user = g.current_user

    if "name" in payload:
        user.name = validate_string(payload["name"], "Name", max_length=120, min_length=2)
    for field, label, limit in (
        ("title", "Title", 120),
        ("department", "Department", 80),
        ("phone", "Phone", 40),
        ("location", "Location", 120),
        ("bio", "Bio", 500),
    ):
        if field in payload:
            setattr(user, field, validate_string(payload[field], label, required=False, max_length=limit))

    log_activity(
        "team.member_updated",
        description=f"{user.name} updated their profile",
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        entity_label=user.name,
    )
    db.session.commit()

    return success({"user": user.to_dict(detailed=True)})


@bp.post("/change-password")
@auth_required()
def change_password():
    payload = require_json(request.get_json(silent=True))
    current = payload.get("current_password") or ""
    new_password = validate_password(payload.get("new_password"))

    if not g.current_user.check_password(current):
        raise AuthenticationError("Your current password is incorrect.")

    g.current_user.set_password(new_password)
    db.session.commit()

    return success({"message": "Password updated."})