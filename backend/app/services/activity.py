"""Activity timeline writer.

Every meaningful mutation funnels through `log_activity` so the timeline can
never drift out of sync with the data it describes.
"""

from flask import g
from sqlalchemy.orm import Session

from ..models import Activity, utcnow


def log_activity(
    action: str,
    *,
    description: str,
    actor_id: int | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    entity_label: str | None = None,
    metadata: dict | None = None,
    session: Session | None = None,
) -> Activity:
    """Append one timeline entry.

    `actor_id` defaults to the authenticated user on the request context. Pass
    it explicitly (with `session`) for background jobs that have no request.
    """
    if actor_id is None:
        actor_id = getattr(getattr(g, "current_user", None), "id", None)

    entry = Activity(
        action=action,
        description=description[:400],
        actor_id=actor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=(entity_label or None) and entity_label[:180],
        metadata_json=metadata or {},
    )

    target = session or _session()
    target.add(entry)
    return entry


def _session():
    from ..extensions import db

    return db.session


def log_login(user) -> None:
    log_activity(
        "auth.login",
        description=f"{user.name} signed in",
        actor_id=user.id,
        entity_type="user",
        entity_id=user.id,
        entity_label=user.name,
        session=_session(),
    )


def cleanup(days: int = 90) -> int:
    """Delete timeline entries older than `days`. Used by the maintenance CLI."""
    cutoff = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = cutoff.fromordinal(cutoff.toordinal() - days)
    session = _session()
    deleted = session.query(Activity).filter(Activity.created_at < cutoff).delete(
        synchronize_session=False
    )
    session.commit()
    return deleted