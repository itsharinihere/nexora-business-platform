"""Lead CRUD, filtering and reference generation."""

import uuid


def _payload(**overrides):
    base = {
        "name": "Test Lead",
        "company": "Test Industries",
        "email": f"lead.{uuid.uuid4().hex[:8]}@test.com",
        "source": "website",
        "priority": "medium",
        "expected_value": 125000,
    }
    base.update(overrides)
    return base


def test_list_leads(client, auth_admin):
    response = client.get("/api/leads?per_page=5", headers=auth_admin)
    assert response.status_code == 200
    assert len(response.json["data"]) <= 5

    pagination = response.json["meta"]["pagination"]
    assert pagination["page"] == 1
    assert pagination["per_page"] == 5
    assert pagination["total"] > 0
    assert "counts" in response.json["meta"]


def test_create_lead(client, auth_admin):
    response = client.post("/api/leads", headers=auth_admin, json=_payload())
    assert response.status_code == 201

    lead = response.json["data"]["lead"]
    assert lead["reference"].startswith("LD-")
    assert lead["status"] == "new"
    assert lead["expected_value"] == 125000.0
    assert "password_hash" not in lead


def test_create_lead_requires_a_name(client, auth_admin):
    response = client.post("/api/leads", headers=auth_admin, json={"company": "No Name Ltd"})
    assert response.status_code == 400
    assert "name" in response.json["error"]["details"]


def test_create_lead_rejects_an_unknown_source(client, auth_admin):
    response = client.post(
        "/api/leads", headers=auth_admin, json=_payload(source="carrier-pigeon")
    )
    assert response.status_code == 400


def test_create_lead_rejects_an_unknown_priority(client, auth_admin):
    response = client.post(
        "/api/leads", headers=auth_admin, json=_payload(priority="extremely-urgent")
    )
    assert response.status_code == 400


def test_create_lead_rejects_a_negative_value(client, auth_admin):
    response = client.post(
        "/api/leads", headers=auth_admin, json=_payload(expected_value=-500)
    )
    assert response.status_code == 400


def test_create_lead_rejects_a_malformed_email(client, auth_admin):
    response = client.post(
        "/api/leads", headers=auth_admin, json=_payload(email="lead@@test")
    )
    assert response.status_code == 400


def test_create_lead_rejects_an_unknown_owner(client, auth_admin):
    response = client.post("/api/leads", headers=auth_admin, json=_payload(owner_id=999999))
    assert response.status_code == 400
    assert "owner_id" in response.json["error"]["details"]


def test_get_lead_detail(client, auth_admin):
    lead_id = client.post("/api/leads", headers=auth_admin, json=_payload()).json["data"]["lead"]["id"]
    response = client.get(f"/api/leads/{lead_id}", headers=auth_admin)
    assert response.status_code == 200
    assert response.json["data"]["lead"]["id"] == lead_id


def test_missing_lead_returns_404(client, auth_admin):
    response = client.get("/api/leads/999999", headers=auth_admin)
    assert response.status_code == 404
    assert response.json["error"]["code"] == "not_found"


def test_update_lead_status_and_priority(client, auth_admin):
    lead_id = client.post("/api/leads", headers=auth_admin, json=_payload()).json["data"]["lead"]["id"]

    response = client.patch(
        f"/api/leads/{lead_id}", headers=auth_admin, json={"status": "qualified", "priority": "high"}
    )
    assert response.status_code == 200
    assert response.json["data"]["lead"]["status"] == "qualified"
    assert response.json["data"]["lead"]["priority"] == "high"


def test_log_contact_updates_the_timestamp(client, auth_admin):
    lead_id = client.post("/api/leads", headers=auth_admin, json=_payload()).json["data"]["lead"]["id"]
    response = client.post(f"/api/leads/{lead_id}/contact", headers=auth_admin)
    assert response.status_code == 200
    assert response.json["data"]["lead"]["last_contacted_at"] is not None
    # First contact moves a New lead into Contacted.
    assert response.json["data"]["lead"]["status"] == "contacted"


def test_won_lead_converts_to_a_customer(client, auth_admin):
    lead_id = client.post("/api/leads", headers=auth_admin, json=_payload()).json["data"]["lead"]["id"]
    client.patch(f"/api/leads/{lead_id}", headers=auth_admin, json={"status": "won"})

    response = client.post(f"/api/leads/{lead_id}/convert", headers=auth_admin)
    assert response.status_code == 201
    customer = response.json["data"]["customer"]
    assert customer["reference"].startswith("CU-")

    # Converting twice must be rejected.
    assert client.post(f"/api/leads/{lead_id}/convert", headers=auth_admin).status_code == 400


def test_only_a_won_lead_converts(client, auth_admin):
    lead_id = client.post("/api/leads", headers=auth_admin, json=_payload()).json["data"]["lead"]["id"]
    response = client.post(f"/api/leads/{lead_id}/convert", headers=auth_admin)
    assert response.status_code == 400


def test_search_filters_results(client, auth_admin):
    marker = f"Zephyr{uuid.uuid4().hex[:6]}"
    client.post("/api/leads", headers=auth_admin, json=_payload(company=f"{marker} Ltd"))

    response = client.get(f"/api/leads?search={marker}", headers=auth_admin)
    assert response.status_code == 200
    assert response.json["meta"]["pagination"]["total"] >= 1
    assert all(marker in lead["company"] for lead in response.json["data"])


def test_status_filter_is_validated(client, auth_admin):
    response = client.get("/api/leads?status=not-a-status", headers=auth_admin)
    assert response.status_code == 400


def test_sort_column_is_whitelisted(client, auth_admin):
    response = client.get("/api/leads?sort=password_hash", headers=auth_admin)
    assert response.status_code == 400


def test_sort_direction_is_validated(client, auth_admin):
    response = client.get("/api/leads?sort=name&order=sideways", headers=auth_admin)
    assert response.status_code == 400


def test_pagination_page_size_is_capped(client, auth_admin):
    response = client.get("/api/leads?per_page=100000", headers=auth_admin)
    assert response.status_code == 200
    assert response.json["meta"]["pagination"]["per_page"] <= 100


def test_delete_lead(client, auth_admin):
    lead_id = client.post("/api/leads", headers=auth_admin, json=_payload()).json["data"]["lead"]["id"]
    assert client.delete(f"/api/leads/{lead_id}", headers=auth_admin).status_code == 200
    assert client.get(f"/api/leads/{lead_id}", headers=auth_admin).status_code == 404