"""Notification centre endpoints."""

from flask import Blueprint, g, request
from sqlalchemy.orm import joinedload

from ..extensions import db
from ..models import Notification, utcnow
from ..services.notifications import unread_count
from ..utils.auth import auth_required
from ..utils.errors import NotFoundError
from ..utils.pagination import apply_pagination, get_bool_arg, get_pagination
from ..utils.responses import paginated, success

bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


def _get_notification_or_404(notification_id: int, user_id: int) -> Notification:
    notification = db.session.get(Notification, notification_id)
    # Scoping by user_id prevents one account reading another's notifications.
    if notification is None or notification.user_id != user_id:
        raise NotFoundError("That notification could not be found.")
    return notification


@bp.get("")
@auth_required()
def list_notifications():
    query = db.session.query(Notification).filter(
        Notification.user_id == g.current_user.id
    )

    if get_bool_arg("unread_only"):
        query = query.filter(Notification.is_read.is_(False))

    notification_type = request.args.get("type")
    if notification_type and notification_type != "all":
        query = query.filter(Notification.type == notification_type)

    query = query.order_by(Notification.created_at.desc())
    pagination = get_pagination()
    items, meta = apply_pagination(query, pagination)

    return paginated(
        [n.to_dict() for n in items],
        meta,
        extra={"unread_count": unread_count(g.current_user.id)},
    )


@bp.get("/unread-count")
@auth_required()
def unread():
    return success({"unread_count": unread_count(g.current_user.id)})


@bp.post("/<int:notification_id>/read")
@auth_required()
def mark_read(notification_id: int):
    notification = _get_notification_or_404(notification_id, g.current_user.id)
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = utcnow()
        db.session.commit()
    return success({"notification": notification.to_dict()})


@bp.post("/<int:notification_id>/unread")
@auth_required()
def mark_unread(notification_id: int):
    notification = _get_notification_or_404(notification_id, g.current_user.id)
    notification.is_read = False
    notification.read_at = None
    db.session.commit()
    return success({"notification": notification.to_dict()})


@bp.post("/read-all")
@auth_required()
def mark_all_read():
    updated = (
        db.session.query(Notification)
        .filter(Notification.user_id == g.current_user.id, Notification.is_read.is_(False))
        .update({"is_read": True, "read_at": utcnow()}, synchronize_session=False)
    )
    db.session.commit()
    return success({"message": f"{updated} notifications marked as read.", "updated": updated})


@bp.delete("/<int:notification_id>")
@auth_required()
def delete_notification(notification_id: int):
    notification = _get_notification_or_404(notification_id, g.current_user.id)
    db.session.delete(notification)
    db.session.commit()
    return success({"message": "Notification deleted."})