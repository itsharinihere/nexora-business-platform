"""Customer, task and support ticket creation plus their validation rules."""

import uuid


# --- Customers --------------------------------------------------------------


def _customer(**overrides):
    base = {
        "name": "Test Customer",
        "company": "Test Holdings",
        "industry": "Technology",
        "status": "active",
        "account_value": 250000,
    }
    base.update(overrides)
    return base


def test_create_customer(client, auth_admin):
    response = client.post("/api/customers", headers=auth_admin, json=_customer())
    assert response.status_code == 201
    customer = response.json["data"]["customer"]
    assert customer["reference"].startswith("CU-")
    assert customer["account_value"] == 250000.0
    assert customer["health_score"] == 85


def test_create_customer_requires_a_company(client, auth_admin):
    response = client.post("/api/customers", headers=auth_admin, json={"name": "No Company"})
    assert response.status_code == 400
    assert "company" in response.json["error"]["details"]


def test_create_customer_rejects_an_unknown_industry(client, auth_admin):
    response = client.post(
        "/api/customers", headers=auth_admin, json=_customer(industry="Intergalactic Trade")
    )
    assert response.status_code == 400


def test_create_customer_rejects_a_negative_value(client, auth_admin):
    response = client.post("/api/customers", headers=auth_admin, json=_customer(account_value=-1))
    assert response.status_code == 400


def test_customer_detail_includes_activity_and_stats(client, auth_admin):
    created = client.post("/api/customers", headers=auth_admin, json=_customer()).json["data"]["customer"]
    response = client.get(f"/api/customers/{created['id']}", headers=auth_admin)
    assert response.status_code == 200
    data = response.json["data"]
    assert "activity" in data
    assert "stats" in data
    assert data["stats"]["health_score"] == 85


def test_update_customer_status(client, auth_admin):
    created = client.post("/api/customers", headers=auth_admin, json=_customer()).json["data"]["customer"]
    response = client.patch(
        f"/api/customers/{created['id']}", headers=auth_admin, json={"status": "at_risk"}
    )
    assert response.status_code == 200
    assert response.json["data"]["customer"]["status"] == "at_risk"
    assert response.json["data"]["customer"]["is_at_risk"] is True


def test_health_score_is_bounded(client, auth_admin):
    created = client.post("/api/customers", headers=auth_admin, json=_customer()).json["data"]["customer"]
    assert (
        client.patch(
            f"/api/customers/{created['id']}", headers=auth_admin, json={"health_score": 900}
        ).status_code
        == 400
    )


# --- Tasks ------------------------------------------------------------------


def _task(**overrides):
    base = {
        "title": "Prepare the quarterly pipeline review",
        "description": "Pull the numbers and build the deck.",
        "priority": "high",
        "status": "todo",
    }
    base.update(overrides)
    return base


def test_create_task(client, auth_admin):
    response = client.post("/api/tasks", headers=auth_admin, json=_task())
    assert response.status_code == 201
    task = response.json["data"]["task"]
    assert task["reference"].startswith("TSK-")
    assert task["status"] == "todo"


def test_create_task_rejects_a_short_title(client, auth_admin):
    response = client.post("/api/tasks", headers=auth_admin, json={"title": "no"})
    assert response.status_code == 400
    assert "title" in response.json["error"]["details"]


def test_create_task_rejects_an_invalid_date(client, auth_admin):
    response = client.post(
        "/api/tasks", headers=auth_admin, json=_task(due_date="31/31/2020")
    )
    assert response.status_code == 400


def test_create_task_rejects_an_unknown_status(client, auth_admin):
    response = client.post("/api/tasks", headers=auth_admin, json=_task(status="almost-done"))
    assert response.status_code == 400


def test_completing_a_task_stamps_completed_at(client, auth_admin):
    task_id = client.post("/api/tasks", headers=auth_admin, json=_task()).json["data"]["task"]["id"]
    response = client.patch(f"/api/tasks/{task_id}", headers=auth_admin, json={"status": "completed"})
    assert response.status_code == 200
    assert response.json["data"]["task"]["completed_at"] is not None


def test_reopening_a_task_clears_completed_at(client, auth_admin):
    task_id = client.post("/api/tasks", headers=auth_admin, json=_task(status="completed")).json["data"]["task"]["id"]
    response = client.patch(f"/api/tasks/{task_id}", headers=auth_admin, json={"status": "in_progress"})
    assert response.json["data"]["task"]["completed_at"] is None


def test_task_board_groups_open_tasks(client, auth_admin):
    response = client.get("/api/tasks/board", headers=auth_admin)
    assert response.status_code == 200
    columns = response.json["data"]["columns"]
    # Completed is intentionally excluded from the board.
    assert [c["status"] for c in columns] == ["todo", "in_progress", "review"]
    assert response.json["data"]["total_open"] > 0


def test_task_filters(client, auth_admin):
    assert client.get("/api/tasks?priority=high", headers=auth_admin).status_code == 200
    assert client.get("/api/tasks?assignee=me", headers=auth_admin).status_code == 200
    assert client.get("/api/tasks?overdue=true", headers=auth_admin).status_code == 200


# --- Support tickets --------------------------------------------------------


def _ticket(**overrides):
    base = {
        "subject": "Dashboard charts render blank after the update",
        "description": "Charts on the reports page have been blank since yesterday.",
        "category": "technical",
        "priority": "high",
    }
    base.update(overrides)
    return base


def test_create_ticket(client, auth_admin):
    response = client.post("/api/tickets", headers=auth_admin, json=_ticket())
    assert response.status_code == 201
    ticket = response.json["data"]["ticket"]
    assert ticket["reference"].startswith("NX-")
    assert ticket["status"] == "open"
    assert ticket["is_open"] is True


def test_ticket_reference_includes_the_year(client, auth_admin):
    from datetime import datetime, timezone

    ticket = client.post("/api/tickets", headers=auth_admin, json=_ticket()).json["data"]["ticket"]
    assert str(datetime.now(timezone.utc).year) in ticket["reference"]


def test_create_ticket_requires_a_description(client, auth_admin):
    response = client.post("/api/tickets", headers=auth_admin, json={"subject": "No body"})
    assert response.status_code == 400
    assert "description" in response.json["error"]["details"]


def test_create_ticket_rejects_an_unknown_category(client, auth_admin):
    response = client.post("/api/tickets", headers=auth_admin, json=_ticket(category="vibes"))
    assert response.status_code == 400


def test_resolving_a_ticket_stamps_resolved_at(client, auth_admin):
    ticket_id = client.post("/api/tickets", headers=auth_admin, json=_ticket()).json["data"]["ticket"]["id"]
    response = client.patch(f"/api/tickets/{ticket_id}", headers=auth_admin, json={"status": "resolved"})
    assert response.status_code == 200
    body = response.json["data"]["ticket"]
    assert body["resolved_at"] is not None
    assert body["resolution_hours"] is not None
    assert body["is_open"] is False


def test_ticket_detail_includes_activity_and_sla(client, auth_admin):
    ticket_id = client.post("/api/tickets", headers=auth_admin, json=_ticket()).json["data"]["ticket"]["id"]
    response = client.get(f"/api/tickets/{ticket_id}", headers=auth_admin)
    assert response.status_code == 200
    assert "activity" in response.json["data"]
    assert response.json["data"]["sla_target_hours"] > 0


def test_respond_stamps_the_first_response(client, auth_admin):
    ticket_id = client.post("/api/tickets", headers=auth_admin, json=_ticket()).json["data"]["ticket"]["id"]
    response = client.post(f"/api/tickets/{ticket_id}/respond", headers=auth_admin)
    assert response.status_code == 200
    assert response.json["data"]["ticket"]["first_response_at"] is not None
    assert response.json["data"]["ticket"]["response_hours"] is not None


def test_ticket_search_and_filters(client, auth_admin):
    assert client.get("/api/tickets?category=technical", headers=auth_admin).status_code == 200
    assert client.get("/api/tickets?status=open", headers=auth_admin).status_code == 200
    assert client.get("/api/tickets?search=dashboard", headers=auth_admin).status_code == 200
    assert client.get("/api/tickets?status=nope", headers=auth_admin).status_code == 400