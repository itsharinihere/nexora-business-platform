"""Public metadata endpoints: health check, vocabularies and API index."""

from flask import Blueprint, current_app, jsonify

from .. import constants
from ..utils.responses import success

bp = Blueprint("meta", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    """Liveness probe. Intentionally unauthenticated so it can be polled."""
    return jsonify(
        {
            "success": True,
            "data": {
                "status": "ok",
                "service": "nexora-api",
                "environment": current_app.config.get("ENV_NAME", "development"),
                "version": "1.0.0",
            },
        }
    )


@bp.get("/meta/enums")
def enums():
    """Vocabularies the UI needs, served by the same source of truth the API validates against."""
    return success(
        {
            "lead_statuses": list(constants.LEAD_STATUSES),
            "lead_priorities": list(constants.LEAD_PRIORITIES),
            "lead_sources": list(constants.LEAD_SOURCES),
            "customer_statuses": list(constants.CUSTOMER_STATUSES),
            "customer_industries": list(constants.CUSTOMER_INDUSTRIES),
            "task_statuses": list(constants.TASK_STATUSES),
            "task_priorities": list(constants.TASK_PRIORITIES),
            "ticket_statuses": list(constants.TICKET_STATUSES),
            "ticket_categories": list(constants.TICKET_CATEGORIES),
            "user_statuses": list(constants.USER_STATUSES),
            "roles": list(constants.ROLE_NAMES),
            "notification_types": list(constants.NOTIFICATION_TYPES),
            "analytics_ranges": [
                {"value": "7d", "label": "7 days"},
                {"value": "30d", "label": "30 days"},
                {"value": "90d", "label": "90 days"},
                {"value": "1y", "label": "1 year"},
            ],
            "support_sla_hours": current_app.config["SUPPORT_SLA_HOURS"],
        }
    )


@bp.get("/")
def index():
    """A machine-readable map of the available endpoints."""
    return success(
        {
            "name": "NEXORA API",
            "version": "1.0.0",
            "endpoints": {
                "auth": [
                    "POST /api/auth/register",
                    "POST /api/auth/login",
                    "POST /api/auth/logout",
                    "GET /api/auth/me",
                    "PATCH /api/auth/me",
                    "POST /api/auth/change-password",
                ],
                "dashboard": ["GET /api/dashboard", "GET /api/dashboard/my-tasks"],
                "leads": [
                    "GET /api/leads",
                    "POST /api/leads",
                    "GET /api/leads/<id>",
                    "PATCH /api/leads/<id>",
                    "DELETE /api/leads/<id>",
                    "POST /api/leads/<id>/contact",
                    "POST /api/leads/<id>/convert",
                ],
                "customers": [
                    "GET /api/customers",
                    "POST /api/customers",
                    "GET /api/customers/<id>",
                    "PATCH /api/customers/<id>",
                    "DELETE /api/customers/<id>",
                ],
                "tasks": [
                    "GET /api/tasks",
                    "GET /api/tasks/board",
                    "POST /api/tasks",
                    "GET /api/tasks/<id>",
                    "PATCH /api/tasks/<id>",
                    "DELETE /api/tasks/<id>",
                ],
                "team": [
                    "GET /api/team",
                    "POST /api/team",
                    "GET /api/team/<id>",
                    "PATCH /api/team/<id>",
                    "POST /api/team/<id>/reset-password",
                ],
                "support": [
                    "GET /api/tickets",
                    "POST /api/tickets",
                    "GET /api/tickets/<id>",
                    "PATCH /api/tickets/<id>",
                    "DELETE /api/tickets/<id>",
                    "POST /api/tickets/<id>/respond",
                ],
                "analytics": ["GET /api/analytics", "GET /api/analytics/summary", "GET /api/analytics/insights"],
                "notifications": [
                    "GET /api/notifications",
                    "GET /api/notifications/unread-count",
                    "POST /api/notifications/<id>/read",
                    "POST /api/notifications/read-all",
                ],
                "activities": ["GET /api/activities"],
                "settings": ["GET /api/settings", "PATCH /api/settings"],
                "meta": ["GET /api/health", "GET /api/meta/enums"],
            },
        }
    )