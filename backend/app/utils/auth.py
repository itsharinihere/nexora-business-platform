"""Authentication and authorisation decorators.

`@auth_required` attaches the resolved `User` to `g.current_user` so routes
never re-query it, and `@roles_required` layers role checks on top.
"""

from functools import wraps

from flask import g
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from ..extensions import db
from .errors import AuthenticationError, PermissionError_


def auth_required(optional: bool = False):
    """Require a valid access token and load the user onto `g.current_user`.

    With `optional=True` the view still runs for anonymous callers, which the
    landing page uses to decide whether to show "Go to dashboard".
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request(optional=optional)
            except Exception as exc:  # noqa: BLE001 - normalised below
                if optional:
                    g.current_user = None
                    return fn(*args, **kwargs)
                raise AuthenticationError("Your session has expired. Please sign in again.") from exc

            identity = get_jwt_identity()
            g.current_user = None
            if identity is not None:
                from ..models import User  # local import avoids a cycle

                g.current_user = db.session.get(User, int(identity))

            if g.current_user is None:
                if optional:
                    return fn(*args, **kwargs)
                raise AuthenticationError("Your session is no longer valid. Please sign in again.")

            if g.current_user.status != "active":
                raise PermissionError_("This account is not active. Contact an administrator.")

            return fn(*args, **kwargs)

        return wrapper

    return decorator


def roles_required(*roles):
    """Allow the view only for the listed roles (admin/manager/employee)."""

    allowed = {r.lower() for r in roles}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = getattr(g, "current_user", None)
            if user is None:
                raise AuthenticationError()
            if user.role_name not in allowed:
                raise PermissionError_(
                    f"This action requires one of: {', '.join(sorted(allowed))}."
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def admin_required(fn):
    return roles_required("admin")(fn)


def manager_required(fn):
    return roles_required("admin", "manager")(fn)


def current_user():
    """Helper for views that want the authenticated user without the decorator."""
    return getattr(g, "current_user", None)