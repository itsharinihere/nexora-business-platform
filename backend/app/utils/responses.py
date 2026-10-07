"""Uniform JSON response helpers.

Every endpoint returns the same envelope so the frontend has exactly one
success shape and one error shape to handle:

    success -> {"success": true, "data": ..., "meta": {...}}
    failure -> {"success": false, "error": {"code", "message", "details"}}
"""

from flask import jsonify


def success(data=None, status: int = 200, meta: dict | None = None):
    payload = {"success": True, "data": data}
    if meta is not None:
        payload["meta"] = meta
    return jsonify(payload), status


def created(data=None):
    return success(data, status=201)


def failure(
    message: str,
    status: int = 400,
    code: str = "bad_request",
    details: dict | None = None,
):
    error = {"code": code, "message": message}
    if details:
        error["details"] = details
    return jsonify({"success": False, "error": error}), status


def paginated(items: list, pagination: dict, extra: dict | None = None):
    """Wrap a list payload together with its pagination metadata."""
    meta = {"pagination": pagination}
    if extra:
        meta.update(extra)
    return success(items, meta=meta)