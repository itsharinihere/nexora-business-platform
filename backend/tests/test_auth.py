"""Authentication: registration, login, session and password handling."""

from app.seed import DEMO_PASSWORD


def test_health_is_public(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json["success"] is True
    assert response.json["data"]["status"] == "ok"


def test_enum_metadata_is_public(client):
    response = client.get("/api/meta/enums")
    assert response.status_code == 200
    assert "lead_statuses" in response.json["data"]


def test_register_creates_an_employee(client, unique_email):
    response = client.post(
        "/api/auth/register",
        json={"name": "Test Person", "email": unique_email, "password": "Test@12345"},
    )
    assert response.status_code == 201
    body = response.json["data"]
    assert body["user"]["email"] == unique_email
    assert body["user"]["role_name"] == "employee"
    assert body["access_token"]
    # The hash must never leave the server.
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]


def test_register_rejects_duplicate_email(client, unique_email):
    payload = {"name": "First", "email": unique_email, "password": "Test@12345"}
    assert client.post("/api/auth/register", json=payload).status_code == 201

    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 409
    assert response.json["error"]["code"] == "conflict"


def test_register_rejects_invalid_email(client):
    response = client.post(
        "/api/auth/register",
        json={"name": "Bad", "email": "not-an-email", "password": "Test@12345"},
    )
    assert response.status_code == 400
    assert "email" in response.json["error"]["details"]


def test_register_rejects_weak_password(client, unique_email):
    response = client.post(
        "/api/auth/register",
        json={"name": "Weak", "email": unique_email, "password": "abc"},
    )
    assert response.status_code == 400


def test_register_requires_name(client, unique_email):
    response = client.post(
        "/api/auth/register",
        json={"email": unique_email, "password": "Test@12345"},
    )
    assert response.status_code == 400
    assert "name" in response.json["error"]["details"]


def test_login_with_valid_credentials(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "harini@nexora.dev", "password": DEMO_PASSWORD},
    )
    assert response.status_code == 200
    assert response.json["data"]["user"]["email"] == "harini@nexora.dev"
    assert response.json["data"]["access_token"]


def test_login_with_wrong_password(client):
    response = client.post(
        "/api/auth/login", json={"email": "harini@nexora.dev", "password": "WrongPass1"}
    )
    assert response.status_code == 401


def test_login_with_unknown_email_is_indistinguishable(client):
    """An unknown email must not leak whether the account exists."""
    unknown = client.post(
        "/api/auth/login", json={"email": "ghost@nexora.dev", "password": DEMO_PASSWORD}
    )
    wrong_password = client.post(
        "/api/auth/login", json={"email": "harini@nexora.dev", "password": "WrongPass1"}
    )
    assert unknown.status_code == wrong_password.status_code == 401
    assert unknown.json["error"]["message"] == wrong_password.json["error"]["message"]


def test_protected_route_requires_a_token(client):
    response = client.get("/api/leads")
    assert response.status_code == 401


def test_invalid_token_is_rejected(client):
    response = client.get("/api/leads", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


def test_me_returns_the_current_user(client, auth_admin):
    response = client.get("/api/auth/me", headers=auth_admin)
    assert response.status_code == 200
    assert response.json["data"]["user"]["email"] == "harini@nexora.dev"
    assert "permissions" in response.json["data"]["user"]


def test_update_own_profile(client, auth_admin):
    response = client.patch("/api/auth/me", headers=auth_admin, json={"title": "Head of Operations"})
    assert response.status_code == 200
    assert response.json["data"]["user"]["title"] == "Head of Operations"


def test_change_password_requires_the_current_password(client, auth_admin):
    response = client.post(
        "/api/auth/change-password",
        headers=auth_admin,
        json={"current_password": "not-my-password", "new_password": "NewPass@2026"},
    )
    assert response.status_code == 401


def test_change_password_rejects_weak_new_password(client, auth_admin):
    response = client.post(
        "/api/auth/change-password",
        headers=auth_admin,
        json={"current_password": DEMO_PASSWORD, "new_password": "weak"},
    )
    assert response.status_code == 400


def test_logout_succeeds(client, auth_admin):
    assert client.post("/api/auth/logout", headers=auth_admin).status_code == 200