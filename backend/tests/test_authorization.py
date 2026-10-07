"""Role-based access control and ownership boundaries."""

import uuid

from app.seed import DEMO_PASSWORD


def test_admin_can_reach_every_module(client, auth_admin):
    for path in (
        "/api/dashboard",
        "/api/leads",
        "/api/customers",
        "/api/tasks",
        "/api/team",
        "/api/tickets",
        "/api/analytics",
        "/api/notifications",
        "/api/activities",
        "/api/settings",
    ):
        assert client.get(path, headers=auth_admin).status_code == 200, path


def test_employee_can_read_the_operational_modules(client, auth_employee):
    for path in ("/api/dashboard", "/api/leads", "/api/customers", "/api/tasks", "/api/tickets"):
        assert client.get(path, headers=auth_employee).status_code == 200, path


def test_employee_cannot_invite_team_members(client, auth_employee):
    response = client.post(
        "/api/team",
        headers=auth_employee,
        json={"name": "Nope", "email": f"nope.{uuid.uuid4().hex[:8]}@x.dev", "password": "Pass@1234"},
    )
    assert response.status_code == 403
    assert response.json["error"]["code"] == "forbidden"


def test_employee_cannot_delete_a_lead(client, auth_employee):
    created = client.post(
        "/api/leads",
        headers=auth_employee,
        json={"name": "Employee Lead", "company": "Employee Co"},
    ).json["data"]["lead"]
    assert client.delete(f"/api/leads/{created['id']}", headers=auth_employee).status_code == 403


def test_employee_cannot_delete_a_ticket(client, auth_employee):
    ticket = client.get("/api/tickets?per_page=1", headers=auth_employee).json["data"][0]
    assert client.delete(f"/api/tickets/{ticket['id']}", headers=auth_employee).status_code == 403


def test_manager_can_delete(client, auth_manager):
    created = client.post(
        "/api/leads",
        headers=auth_manager,
        json={"name": "Manager Lead", "company": "Manager Co"},
    ).json["data"]["lead"]
    assert client.delete(f"/api/leads/{created['id']}", headers=auth_manager).status_code == 200


def test_admin_can_change_a_member_role(client, auth_admin):
    members = client.get("/api/team", headers=auth_admin).json["data"]["members"]
    target = next(m for m in members if m["role_name"] == "employee" and m["id"] != 1)

    response = client.patch(
        f"/api/team/{target['id']}", headers=auth_admin, json={"role": "manager"}
    )
    assert response.status_code == 200
    assert response.json["data"]["member"]["role_name"] == "manager"

    # Put it back so later tests see the original role.
    client.patch(f"/api/team/{target['id']}", headers=auth_admin, json={"role": "employee"})


def test_admin_cannot_demote_themselves(client, auth_admin):
    response = client.patch("/api/team/1", headers=auth_admin, json={"role": "employee"})
    assert response.status_code == 400


def test_admin_cannot_deactivate_themselves(client, auth_admin):
    response = client.patch("/api/team/1", headers=auth_admin, json={"status": "inactive"})
    assert response.status_code == 400


def test_notifications_are_scoped_to_the_owner(client, auth_admin, auth_employee):
    admin_notifications = client.get("/api/notifications", headers=auth_admin).json["data"]
    for notification in admin_notifications:
        # Reading another user's notification by id must 404, not 200.
        response = client.post(
            f"/api/notifications/{notification['id']}/read", headers=auth_employee
        )
        assert response.status_code == 404


def test_employee_sees_their_own_permissions(client, auth_employee):
    response = client.get("/api/auth/me", headers=auth_employee)
    permissions = response.json["data"]["user"]["permissions"]
    assert permissions["manage_team"] is False
    assert permissions["delete_records"] is False


def test_admin_permissions_are_granted(client, auth_admin):
    permissions = client.get("/api/auth/me", headers=auth_admin).json["data"]["user"]["permissions"]
    assert permissions["manage_team"] is True
    assert permissions["manage_settings"] is True


def test_invalidated_token_is_rejected(client, auth_admin):
    """A token signed with the wrong key must not authenticate."""
    from flask_jwt_extended import create_access_token

    forged = create_access_token(identity="1", additional_claims={"role": "admin"})
    # Re-sign with a different key to simulate tampering.
    import jwt as pyjwt

    token = pyjwt.encode(
        pyjwt.decode(forged, key="dev-only-insecure-jwt-key-do-not-use-in-production", algorithms=["HS256"]),
        key="a-completely-different-signing-key-value-here",
        algorithm="HS256",
    )
    response = client.get("/api/leads", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401