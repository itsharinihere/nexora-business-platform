"""Analytics and Smart Insights endpoints."""

from datetime import timedelta

from flask import Blueprint, request

from ..services import analytics, insights
from ..utils.auth import auth_required
from ..utils.responses import success

bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")


@bp.get("")
@auth_required()
def overview():
    range_key = request.args.get("range")
    return success(analytics.build_overview(range_key))


@bp.get("/summary")
@auth_required()
def summary():
    """Lightweight KPI block for cards that only need the headline numbers."""
    range_key = request.args.get("range")
    window = analytics.resolve_range(range_key)
    return success(
        {
            "range": {
                "key": window["key"],
                "label": window["label"],
                "start": window["start"].isoformat(),
                "end": (window["end"] - timedelta(days=1)).isoformat(),
            },
            "summary": analytics.summary(window),
            "counts": analytics.global_counts(),
        }
    )


@bp.get("/insights")
@auth_required()
def list_insights():
    range_key = request.args.get("range") or "30d"
    payload = insights.generate_insights(range_key)
    return success(
        {
            "insights": payload,
            "summary": {
                "total": len(payload),
                "critical": len([i for i in payload if i["severity"] == "critical"]),
                "warning": len([i for i in payload if i["severity"] == "warning"]),
                "info": len([i for i in payload if i["severity"] == "info"]),
                "success": len([i for i in payload if i["severity"] == "success"]),
            },
            "engine": {
                "type": "rule_based",
                "description": (
                    "Insights are produced by deterministic rules that compare stored "
                    "metrics against fixed thresholds. No external AI service is used."
                ),
            },
        }
    )