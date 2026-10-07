"""Manual smoke test: boots the app and exercises every endpoint in-process.

Run with:  python smoke_test.py
Not part of the pytest suite; this is the quick "does the whole API work" pass.
"""

import json

from app import create_app
from app.extensions import db

FAILURES = []


def check(label, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    if not condition:
        FAILURES.append(f"{label}: {detail}")
    print(f"  [{status}] {label}" + (f"  {detail}" if detail and not condition else ""))


def main():
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        from app.seed import DEMO_PASSWORD, seed_all

        seed_all()

    client = app.test_client()

    print("\n== public ==")
    r = client.get("/api/health")
    check("health", r.status_code == 200 and r.json["data"]["status"] == "ok", str(r.status_code))
    r = client.get("/api/meta/enums")
    check("meta/enums", r.status_code == 200 and "lead_statuses" in r.json["data"])
    r = client.get("/api/")
    check("api index", r.status_code == 200 and "endpoints" in r.json["data"])

    print("\n== auth ==")
    r = client.post("/api/auth/login", json={"email": "harini@nexora.dev", "password": "wrongpass1"})
    check("bad login -> 401", r.status_code == 401, f"{r.status_code} {r.json}")
    r = client.post("/api/auth/login", json={"email": "nobody@nowhere.dev", "password": "Nexora@2026"})
    check("unknown login -> 401", r.status_code == 401, str(r.status_code))

    r = client.post("/api/auth/login", json={"email": "harini@nexora.dev", "password": DEMO_PASSWORD})
    check("login", r.status_code == 200, f"{r.status_code} {r.get_data(as_text=True)[:200]}")
    token = r.json["data"]["access_token"]
    admin = {"Authorization": f"Bearer {token}"}
    check("login returns role", r.json["data"]["user"]["role_name"] == "admin")

    r = client.post(
        "/api/auth/register",
        json={"name": "Smoke Tester", "email": "smoke@nexora.dev", "password": "Test@12345"},
    )
    check("register", r.status_code == 201, f"{r.status_code} {r.get_data(as_text=True)[:200]}")
    check("register -> employee role", r.json["data"]["user"]["role_name"] == "employee")

    r = client.post(
        "/api/auth/register",
        json={"name": "Dupe", "email": "smoke@nexora.dev", "password": "Test@12345"},
    )
    check("duplicate email -> 409", r.status_code == 409, str(r.status_code))

    r = client.post(
        "/api/auth/register",
        json={"name": "X", "email": "bad-email", "password": "Test@12345"},
    )
    check("invalid email -> 400", r.status_code == 400, str(r.status_code))

    r = client.get("/api/leads")
    check("unauthenticated list -> 401", r.status_code == 401, str(r.status_code))

    print("\n== dashboard & analytics ==")
    for path in ("/api/dashboard", "/api/analytics", "/api/analytics/insights", "/api/settings"):
        r = client.get(path, headers=admin)
        check(f"GET {path}", r.status_code == 200, f"{r.status_code} {r.get_data(as_text=True)[:300]}")

    r = client.get("/api/dashboard", headers=admin)
    check("dashboard has insights", len(r.json["data"]["insights"]) > 0)
    check("dashboard has stats", r.json["data"]["stats"]["total_leads"] > 0)
    check("dashboard charts present", "lead_trend" in r.json["data"]["charts"])

    for rng in ("7d", "30d", "90d", "1y"):
        r = client.get(f"/api/analytics?range={rng}", headers=admin)
        check(f"analytics range={rng}", r.status_code == 200, str(r.status_code))
        if r.status_code == 200:
            check(f"  range={rng} buckets", len(r.json["data"]["lead_trend"]["labels"]) > 0)

    print("\n== leads ==")
    r = client.get("/api/leads?per_page=5", headers=admin)
    check("list leads", r.status_code == 200, str(r.status_code))
    check("pagination meta", "pagination" in r.json.get("meta", {}))
    lead_id = r.json["data"][0]["id"]

    r = client.post(
        "/api/leads",
        json={"name": "Smoke Lead", "company": "Smoke Co", "email": "smoke.lead@test.com",
              "source": "website", "priority": "high", "expected_value": 120000},
        headers=admin,
    )
    check("create lead", r.status_code == 201, f"{r.status_code} {r.get_data(as_text=True)[:300]}")
    new_lead = r.json["data"]["lead"]["id"]
    check("lead reference format", r.json["data"]["lead"]["reference"].startswith("LD-"))

    r = client.get(f"/api/leads/{new_lead}", headers=admin)
    check("get lead", r.status_code == 200)

    r = client.patch(f"/api/leads/{new_lead}", json={"status": "qualified", "priority": "critical"}, headers=admin)
    check("update lead status", r.status_code == 200 and r.json["data"]["lead"]["status"] == "qualified")

    r = client.post(f"/api/leads/{new_lead}/contact", headers=admin)
    check("log contact", r.status_code == 200)

    r = client.patch(f"/api/leads/{new_lead}", json={"status": "won"}, headers=admin)
    r = client.post(f"/api/leads/{new_lead}/convert", headers=admin)
    check("convert lead -> customer", r.status_code == 201, f"{r.status_code} {r.get_data(as_text=True)[:200]}")

    r = client.post("/api/leads", json={"name": "N"}, headers=admin)
    check("create lead invalid -> 400", r.status_code == 400, str(r.status_code))

    r = client.post("/api/leads", json={"name": "Bad Source", "source": "carrier-pigeon"}, headers=admin)
    check("invalid enum -> 400", r.status_code == 400, str(r.status_code))

    r = client.get("/api/leads?sort=not_a_column", headers=admin)
    check("invalid sort -> 400", r.status_code == 400, str(r.status_code))

    r = client.get(f"/api/leads/999999", headers=admin)
    check("missing lead -> 404", r.status_code == 404, str(r.status_code))

    r = client.get("/api/leads?search=smoke", headers=admin)
    check("search leads", r.status_code == 200 and r.json["meta"]["pagination"]["total"] >= 1)

    print("\n== customers ==")
    r = client.get("/api/customers", headers=admin)
    check("list customers", r.status_code == 200, str(r.status_code))
    cust_id = r.json["data"][0]["id"]

    r = client.post(
        "/api/customers",
        json={"name": "Smoke Customer", "company": "Smoke Holdings", "industry": "Technology",
              "account_value": 250000, "status": "active"},
        headers=admin,
    )
    check("create customer", r.status_code == 201, f"{r.status_code} {r.get_data(as_text=True)[:200]}")

    r = client.get(f"/api/customers/{cust_id}", headers=admin)
    check("customer detail + activity", r.status_code == 200 and "activity" in r.json["data"])

    r = client.patch(f"/api/customers/{cust_id}", json={"status": "at_risk"}, headers=admin)
    check("update customer", r.status_code == 200 and r.json["data"]["customer"]["status"] == "at_risk")

    r = client.patch(f"/api/customers/{cust_id}", json={"health_score": 500}, headers=admin)
    check("health_score bounds -> 400", r.status_code == 400, str(r.status_code))

    print("\n== tasks ==")
    r = client.get("/api/tasks", headers=admin)
    check("list tasks", r.status_code == 200, str(r.status_code))
    r = client.get("/api/tasks/board", headers=admin)
    check("task board", r.status_code == 200 and len(r.json["data"]["columns"]) == 3, str(r.status_code))

    r = client.post(
        "/api/tasks",
        json={"title": "Smoke test task", "description": "verify the api", "priority": "high",
              "status": "todo", "due_date": "2026-12-01"},
        headers=admin,
    )
    check("create task", r.status_code == 201, f"{r.status_code} {r.get_data(as_text=True)[:200]}")
    task_id = r.json["data"]["task"]["id"]

    r = client.patch(f"/api/tasks/{task_id}", json={"status": "completed"}, headers=admin)
    check("complete task", r.status_code == 200 and r.json["data"]["task"]["completed_at"])

    r = client.post("/api/tasks", json={"title": "no"}, headers=admin)
    check("short title -> 400", r.status_code == 400, str(r.status_code))

    r = client.post("/api/tasks", json={"title": "Bad date", "due_date": "31/31/2020"}, headers=admin)
    check("bad date -> 400", r.status_code == 400, str(r.status_code))

    print("\n== support ==")
    r = client.get("/api/tickets", headers=admin)
    check("list tickets", r.status_code == 200, str(r.status_code))
    ticket_id = r.json["data"][0]["id"]

    r = client.post(
        "/api/tickets",
        json={"subject": "Smoke ticket subject", "description": "A detailed description here",
              "category": "technical", "priority": "high"},
        headers=admin,
    )
    check("create ticket", r.status_code == 201, f"{r.status_code} {r.get_data(as_text=True)[:200]}")
    new_ticket = r.json["data"]["ticket"]["id"]
    check("ticket reference NX-", r.json["data"]["ticket"]["reference"].startswith("NX-"))

    r = client.patch(f"/api/tickets/{new_ticket}", json={"status": "resolved"}, headers=admin)
    check("resolve ticket", r.status_code == 200 and r.json["data"]["ticket"]["resolved_at"])

    r = client.get(f"/api/tickets/{new_ticket}", headers=admin)
    check("ticket detail + activity", r.status_code == 200 and "activity" in r.json["data"])

    print("\n== team & authz ==")
    r = client.get("/api/team", headers=admin)
    check("list team", r.status_code == 200 and "members" in r.json["data"])
    check("team workload present", "workload" in r.json["data"]["members"][0])

    member_id = r.json["data"]["members"][0]["id"]

    r = client.post(
        "/api/team",
        json={"name": "New Hire", "email": "newhire@nexora.dev", "password": "Pass@1234", "role": "employee"},
        headers=admin,
    )
    check("admin invites member", r.status_code == 201, f"{r.status_code} {r.get_data(as_text=True)[:200]}")

    # Employee permissions
    emp_token = client.post(
        "/api/auth/login", json={"email": "karthik@nexora.dev", "password": DEMO_PASSWORD}
    ).json["data"]["access_token"]
    emp = {"Authorization": f"Bearer {emp_token}"}

    r = client.post("/api/team", json={"name": "Nope", "email": "nope@x.dev", "password": "Pass@1234"}, headers=emp)
    check("employee cannot invite -> 403", r.status_code == 403, str(r.status_code))

    r = client.delete(f"/api/leads/{new_lead}", headers=emp)
    check("employee cannot delete -> 403", r.status_code == 403, str(r.status_code))

    r = client.delete(f"/api/leads/{new_lead}", headers=admin)
    check("admin can delete", r.status_code == 200, f"{r.status_code} {r.get_data(as_text=True)[:200]}")

    r = client.patch(f"/api/team/{member_id}", json={"role": "manager"}, headers=emp)
    check("employee cannot change role -> 403", r.status_code == 403, str(r.status_code))

    r = client.patch("/api/auth/me", json={"name": "Harini K."}, headers=admin)
    check("update own profile", r.status_code == 200 and r.json["data"]["user"]["name"] == "Harini K.")

    r = client.post("/api/auth/change-password", json={"current_password": "wrong", "new_password": "Abcd@1234"}, headers=admin)
    check("wrong current password -> 401", r.status_code == 401, str(r.status_code))

    print("\n== notifications & activity ==")
    r = client.get("/api/notifications", headers=admin)
    check("list notifications", r.status_code == 200 and "unread_count" in r.json["meta"])
    if r.json["data"]:
        nid = r.json["data"][0]["id"]
        r = client.post(f"/api/notifications/{nid}/read", headers=admin)
        check("mark read", r.status_code == 200)
    r = client.post("/api/notifications/read-all", headers=admin)
    check("mark all read", r.status_code == 200)
    r = client.get("/api/notifications/unread-count", headers=admin)
    check("unread count zero", r.json["data"]["unread_count"] == 0)

    r = client.get("/api/activities", headers=admin)
    check("list activities", r.status_code == 200 and "facets" in r.json["meta"])
    r = client.get("/api/activities?action=lead", headers=admin)
    check("activity module filter", r.status_code == 200 and r.json["meta"]["pagination"]["total"] > 0)

    r = client.get("/api/notifications", headers={"Authorization": f"Bearer {emp_token}"})
    check("notifications are user-scoped", r.status_code == 200)

    print("\n== settings ==")
    r = client.get("/api/settings", headers=admin)
    check("get settings", r.status_code == 200)
    r = client.patch("/api/settings", json={"theme": "dark", "notify_new_leads": False}, headers=admin)
    check("update settings", r.status_code == 200 and r.json["data"]["appearance"]["theme"] == "dark")
    r = client.patch("/api/settings", json={"theme": "neon"}, headers=admin)
    check("invalid theme -> 400", r.status_code == 400, str(r.status_code))

    r = client.post("/api/auth/logout", headers=admin)
    check("logout", r.status_code == 200)

    print("\n" + "=" * 58)
    if FAILURES:
        print(f"{len(FAILURES)} FAILURE(S):")
        for failure in FAILURES:
            print("  -", failure)
    else:
        print("ALL SMOKE TESTS PASSED")
    print("=" * 58)
    return 1 if FAILURES else 0


if __name__ == "__main__":
    raise SystemExit(main())