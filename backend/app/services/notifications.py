"""In-app notification delivery.

Notifications respect each recipient's saved preferences, so turning a
category off in Settings genuinely stops the noise.
"""

from ..extensions import db
from ..models import Notification, Role, User

# Maps a notification type to the User boolean column that gates it.
PREFERENCE_FIELD = {
    "task_reminder": "notify_task_reminders",
    "new_lead": "notify_new_leads",
    "support_ticket": "notify_support",
    "assignment": "notify_assignments",
    "system": None,  # system notices are always delivered
}


def notify(
    user_id: int | None,
    notification_type: str,
    title: str,
    message: str | None = None,
    link: str | None = None,
    *,
    flush: bool = True,
) -> Notification | None:
    """Create one notification, honouring the recipient's preferences."""
    if user_id is None:
        return None

    user = db.session.get(User, user_id)
    if user is None or user.status != "active":
        return None

    field = PREFERENCE_FIELD.get(notification_type)
    if field and not getattr(user, field, True):
        return None

    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title[:160],
        message=(message or "")[:400] or None,
        link=link,
    )
    db.session.add(notification)
    if flush:
        db.session.flush()
    return notification


def notify_many(
    user_ids,
    notification_type: str,
    title: str,
    message: str | None = None,
    link: str | None = None,
) -> int:
    """Fan a notification out to several users, skipping duplicates."""
    sent = 0
    for user_id in set(user_ids):
        if user_id is None:
            continue
        if notify(user_id, notification_type, title, message, link) is not None:
            sent += 1
    return sent


def notify_roles(
    roles,
    notification_type: str,
    title: str,
    message: str | None = None,
    link: str | None = None,
) -> int:
    # `roles` may be a single name or a collection, so normalise to a tuple.
    wanted = (roles,) if isinstance(roles, str) else tuple(roles)
    recipients = [
        row[0]
        for row in db.session.query(User.id)
        .join(Role, User.role_id == Role.id)
        .filter(Role.name.in_(wanted), User.status == "active")
        .all()
    ]
    return notify_many(recipients, notification_type, title, message, link)


def unread_count(user_id: int) -> int:
    return (
        db.session.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .count()
    )