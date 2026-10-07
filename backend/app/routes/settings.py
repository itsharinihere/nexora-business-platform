"""Settings endpoints: preferences and appearance."""

from flask import Blueprint, g, request

from ..constants import NOTIFICATION_TYPES
from ..extensions import db
from ..services.activity import log_activity
from ..utils.auth import auth_required
from ..utils.responses import success
from ..utils.validation import require_json, validate_bool, validate_choice

bp = Blueprint("settings", __name__, url_prefix="/api/settings")

THEME_OPTIONS = ("light", "dark", "system")

PREFERENCE_FIELDS = {
    "notify_task_reminders": "task_reminder",
    "notify_new_leads": "new_lead",
    "notify_support": "support_ticket",
    "notify_assignments": "assignment",
}


@bp.get("")
@auth_required()
def get_settings():
    user = g.current_user
    return success(
        {
            "appearance": {"theme": user.theme_preference, "options": list(THEME_OPTIONS)},
            "notifications": {
                "preferences": {field: getattr(user, field) for field in PREFERENCE_FIELDS},
                "types": list(NOTIFICATION_TYPES),
            },
        }
    )


@bp.patch("")
@auth_required()
def update_settings():
    payload = require_json(request.get_json(silent=True))
    user = g.current_user
    updated: list[str] = []

    if "theme" in payload:
        user.theme_preference = validate_choice(
            payload["theme"], "theme", THEME_OPTIONS, required=True
        )
        updated.append("theme")

    for field in PREFERENCE_FIELDS:
        if field in payload:
            setattr(user, field, validate_bool(payload[field], default=True))
            updated.append(field)

    db.session.commit()

    if updated:
        log_activity(
            "team.member_updated",
            description=f"{user.name} updated their {', '.join(sorted(set(updated)))} settings",
            actor_id=user.id,
            entity_type="user",
            entity_id=user.id,
            entity_label=user.name,
            metadata={"fields": sorted(set(updated))},
        )
        db.session.commit()

    return success(
        {
            "appearance": {"theme": user.theme_preference},
            "notifications": {
                "preferences": {field: getattr(user, field) for field in PREFERENCE_FIELDS}
            },
        }
    )