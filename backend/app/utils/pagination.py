"""Pagination parsing shared by every list endpoint."""

from flask import request

from config.settings import get_config
from .errors import ValidationError


def get_pagination() -> dict:
    """Read `page` / `per_page` from the query string, clamped to safe bounds."""
    cfg = get_config()

    def _int(name: str, default: int) -> int:
        raw = request.args.get(name)
        if raw in (None, ""):
            return default
        try:
            return int(raw)
        except (TypeError, ValueError):
            raise ValidationError(f"`{name}` must be a whole number.")

    page = max(1, _int("page", 1))
    per_page = _int("per_page", cfg.DEFAULT_PAGE_SIZE)
    if per_page < 1:
        per_page = cfg.DEFAULT_PAGE_SIZE
    per_page = min(per_page, cfg.MAX_PAGE_SIZE)

    return {"page": page, "per_page": per_page}


def apply_pagination(query, pagination: dict):
    """Apply LIMIT/OFFSET and return `(items, pagination_meta)`."""
    page = pagination["page"]
    per_page = pagination["per_page"]

    total = query.order_by(None).count()
    total_pages = max(1, (total + per_page - 1) // per_page)
    # A page beyond the end returns an empty list rather than an error, which
    # keeps infinite-scroll style clients simple.
    items = query.limit(per_page).offset((page - 1) * per_page).all()

    meta = {
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }
    return items, meta


def get_sort(default: str = "created_at", allowed: tuple[str, ...] = ()) -> tuple[str, str]:
    """Read a whitelisted `sort` / `order` pair from the query string.

    Whitelisting is what stops a crafted `sort` value from being handed
    straight to SQLAlchemy as a column name.
    """
    field = (request.args.get("sort") or default).strip()
    order = (request.args.get("order") or "desc").strip().lower()

    if allowed and field not in allowed:
        raise ValidationError(
            f"Cannot sort by `{field}`. Allowed: {', '.join(allowed)}."
        )
    if order not in {"asc", "desc"}:
        raise ValidationError("`order` must be `asc` or `desc`.")

    return field, order


def get_int_arg(name: str, default=None):
    raw = request.args.get(name)
    if raw in (None, ""):
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise ValidationError(f"`{name}` must be a whole number.")


def get_bool_arg(name: str, default=None):
    raw = request.args.get(name)
    if raw in (None, ""):
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}