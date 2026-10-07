"""Analytics, the insights engine and supporting read endpoints."""

import pytest

from app.services import analytics, insights


@pytest.mark.parametrize("range_key", ["7d", "30d", "90d", "1y"])
def test_every_range_builds_a_chart(client, auth_admin, range_key):
    response = client.get(f"/api/analytics?range={range_key}", headers=auth_admin)
    assert response.status_code == 200

    data = response.json["data"]
    assert data["range"]["key"] == range_key
    labels = data["lead_trend"]["labels"]
    assert len(labels) > 0
    # Each series must line up with the labels, or the chart renders broken.
    assert len(data["lead_trend"]["new_leads"]) == len(labels)
    assert len(data["lead_trend"]["won_value"]) == len(labels)
    assert len(data["customer_growth"]["total_customers"]) == len(labels)
    assert len(data["task_completion"]["completed"]) == len(labels)
    assert len(data["support_metrics"]["resolved"]) == len(labels)


def test_an_unknown_range_falls_back_to_the_default(client, auth_admin):
    response = client.get("/api/analytics?range=forever", headers=auth_admin)
    assert response.status_code == 200
    assert response.json["data"]["range"]["key"] == "30d"


def test_bucket_granularity_matches_the_range():
    from datetime import timedelta

    today = analytics.utcnow().date()
    start = today - timedelta(days=60)
    end = today + timedelta(days=1)

    daily = analytics.build_buckets(start, end, "day")
    weekly = analytics.build_buckets(start, end, "week")
    monthly = analytics.build_buckets(start, end, "month")

    assert len(daily) == 61
    assert 0 < len(weekly) < len(daily)
    assert 0 < len(monthly) < len(weekly)


def test_bucket_ranges_are_contiguous_and_non_overlapping():
    from datetime import timedelta

    today = analytics.utcnow().date()
    buckets = analytics.build_buckets(today - timedelta(days=29), today + timedelta(days=1), "day")

    assert len(buckets) == 30
    for current, following in zip(buckets, buckets[1:]):
        assert current["end"] == following["start"]
    assert buckets[-1]["end"] == today + timedelta(days=1)


def test_summary_deltas_are_present(client, auth_admin):
    summary = client.get("/api/analytics/summary", headers=auth_admin).json["data"]["summary"]
    for key in ("leads", "conversion_rate", "task_completion_rate", "avg_response_hours"):
        assert key in summary
        assert "value" in summary[key]
        assert "delta" in summary[key]


def test_dashboard_payload_is_complete(client, auth_admin):
    data = client.get("/api/dashboard", headers=auth_admin).json["data"]

    assert data["greeting"]["name"]
    assert data["stats"]["total_leads"] > 0
    assert "lead_trend" in data["charts"]
    assert "lead_funnel" in data["charts"]
    assert isinstance(data["recent_activity"], list)
    assert isinstance(data["upcoming_tasks"], list)
    assert isinstance(data["insights"], list)
    assert "attention" in data


def test_dashboard_recent_activity_excludes_logins(client, auth_admin):
    activity = client.get("/api/dashboard", headers=auth_admin).json["data"]["recent_activity"]
    assert all(item["action"] != "auth.login" for item in activity)


def test_insights_are_rule_based_and_disclose_it(client, auth_admin):
    data = client.get("/api/analytics/insights", headers=auth_admin).json["data"]

    assert data["engine"]["type"] == "rule_based"
    assert "no external ai" in data["engine"]["description"].lower()

    for insight in data["insights"]:
        assert insight["severity"] in {"critical", "warning", "info", "success"}
        assert insight["title"]
        assert insight["message"]
        assert insight["module"] in {"leads", "tasks", "support", "team", "customers"}


def test_insights_are_sorted_by_severity():
    produced = insights.generate_insights("30d")
    order = {"critical": 0, "warning": 1, "info": 2, "success": 3}
    severities = [order[i["severity"]] for i in produced]
    assert severities == sorted(severities)


def test_insight_ids_are_unique():
    produced = insights.generate_insights("90d")
    ids = [i["id"] for i in produced]
    assert len(ids) == len(set(ids))


def test_insight_rule_triggers_on_real_data(db):
    """A high-priority pending task must raise the matching insight."""
    from app.models import Task, User

    admin = db.session.query(User).filter(User.email == "harini@nexora.dev").first()
    db.session.add_all(
        Task(
            reference=f"TSK-TEST-{n}",
            title=f"Rule probe task {n}",
            priority="critical",
            status="todo",
            assignee_id=admin.id,
        )
        for n in range(4)
    )
    db.session.commit()

    produced = insights.generate_insights("30d")
    ids = {i["id"] for i in produced}
    assert "high_priority_tasks" in ids

    for n in range(4):
        task = db.session.query(Task).filter(Task.reference == f"TSK-TEST-{n}").first()
        db.session.delete(task)
    db.session.commit()


def test_activity_feed_supports_module_filters(client, auth_admin):
    total = client.get("/api/activities?per_page=1", headers=auth_admin).json["meta"]["pagination"]["total"]
    leads = client.get("/api/activities?action=lead&per_page=1", headers=auth_admin).json["meta"][
        "pagination"
    ]["total"]
    assert 0 < leads <= total


def test_activity_facets_are_returned(client, auth_admin):
    facets = client.get("/api/activities", headers=auth_admin).json["meta"]["facets"]
    assert facets["total"] > 0
    assert any(f["value"] == "lead" for f in facets["entity_types"])


def test_team_workload_can_be_sorted_by_load(client, auth_admin):
    workload = client.get("/api/team?sort=workload", headers=auth_admin).json["data"]["members"]
    scores = [m["workload"]["workload_score"] for m in workload]
    assert scores == sorted(scores, reverse=True)


def test_team_defaults_to_name_order(client, auth_admin):
    members = client.get("/api/team", headers=auth_admin).json["data"]["members"]
    names = [m["name"] for m in members]
    assert names == sorted(names)


def test_team_rejects_an_unknown_sort(client, auth_admin):
    assert client.get("/api/team?sort=password_hash", headers=auth_admin).status_code == 400


def test_notifications_can_be_read_and_reset(client, auth_admin):
    client.post("/api/notifications/read-all", headers=auth_admin)
    assert (
        client.get("/api/notifications/unread-count", headers=auth_admin).json["data"]["unread_count"]
        == 0
    )
    assert client.post("/api/notifications/read-all", headers=auth_admin).status_code == 200


def test_settings_round_trip(client, auth_admin):
    original = client.get("/api/settings", headers=auth_admin).json["data"]

    response = client.patch(
        "/api/settings", headers=auth_admin, json={"theme": "dark", "notify_support": False}
    )
    assert response.status_code == 200
    assert response.json["data"]["appearance"]["theme"] == "dark"

    # Restore so later assertions are not order dependent.
    client.patch(
        "/api/settings",
        headers=auth_admin,
        json={"theme": original["appearance"]["theme"], "notify_support": True},
    )


def test_settings_rejects_an_invalid_theme(client, auth_admin):
    assert client.patch("/api/settings", headers=auth_admin, json={"theme": "neon"}).status_code == 400


def test_error_envelope_is_consistent(client, auth_admin):
    response = client.get("/api/leads/999999", headers=auth_admin)
    body = response.json
    assert body["success"] is False
    assert set(body["error"]) >= {"code", "message"}
    assert "error" not in body.get("data", {})