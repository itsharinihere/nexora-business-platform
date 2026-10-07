"""Activity timeline endpoint."""

from flask import Blueprint, g, request
from sqlalchemy.orm import joinedload

from ..extensions import db
from ..models import Activity
from ..utils.auth import auth_required
from ..utils.errors import ValidationError
from ..utils.pagination import apply_pagination, get_pagination, get_sort
from ..utils.responses import paginated

bp = Blueprint("activities", __name__, url_prefix="/api/activities")

SORTABLE = ("created_at", "action", "entity_type")


@bp.get("")
@auth_required()
def list_activities():
    query = db.session.query(Activity).options(joinedload(Activity.actor))

    entity_type = request.args.get("entity_type")
    if entity_type and entity_type != "all":
        query = query.filter(Activity.entity_type == entity_type)

    action = request.args.get("action")
    if action and action != "all":
        if not isinstance(action, str) or len(action) > 50:
            raise ValidationError("Invalid action filter.", {"action": "Invalid filter."})
        # `lead` matches the whole `lead.*` module; `lead.created` matches one action.
        if action.endswith("."):
            query = query.filter(Activity.action.like(f"{action}%"))
        else:
            query = query.filter(
                (Activity.action == action) | (Activity.action.like(f"{action}.%"))
            )

    actor_id = request.args.get("actor")
    if actor_id and actor_id != "all":
        query = query.filter(Activity.actor_id == actor_id)

    field, order = get_sort("created_at", SORTABLE)
    sort_column = getattr(Activity, field)
    query = query.order_by(sort_column.asc() if order == "asc" else sort_column.desc())

    pagination = get_pagination()
    items, meta = apply_pagination(query, pagination)

    facets = {
        "entity_types": [
            {"value": row[0], "count": row[1]}
            for row in db.session.query(Activity.entity_type, db.func.count(Activity.id))
            .group_by(Activity.entity_type)
            .order_by(db.func.count(Activity.id).desc())
            .all()
            if row[0]
        ],
        "total": db.session.query(Activity).count(),
    }

    return paginated([a.to_dict() for a in items], meta, extra={"facets": facets})