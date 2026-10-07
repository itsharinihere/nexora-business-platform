"""Shared pytest fixtures.

The app is created once per session against a temporary SQLite file and seeded
with the same deterministic demo data the app ships with. Tests then exercise
the real routes and models rather than mocks.
"""

import os
import tempfile

import pytest

os.environ.setdefault("FLASK_ENV", "testing")

from app import create_app  # noqa: E402
from app.extensions import db as _db  # noqa: E402
from app.seed import DEMO_PASSWORD, seed_all  # noqa: E402


@pytest.fixture(scope="session")
def app():
    handle, db_path = tempfile.mkstemp(suffix=".sqlite")
    os.close(handle)

    application = create_app("testing")
    application.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
    application.config["SEED_DEMO_DATA"] = True

    with application.app_context():
        _db.drop_all()
        _db.create_all()
        seed_all()
        yield application
        _db.session.remove()
        _db.drop_all()

    os.unlink(db_path)


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def db(app):
    with app.app_context():
        yield _db


def _token_for(client, email):
    response = client.post(
        "/api/auth/login", json={"email": email, "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200, response.get_data(as_text=True)
    return response.json["data"]["access_token"]


@pytest.fixture(scope="session")
def admin_token(app):
    client = app.test_client()
    return _token_for(client, "harini@nexora.dev")


@pytest.fixture(scope="session")
def manager_token(app):
    client = app.test_client()
    return _token_for(client, "arun@nexora.dev")


@pytest.fixture(scope="session")
def employee_token(app):
    client = app.test_client()
    return _token_for(client, "karthik@nexora.dev")


@pytest.fixture()
def auth_admin(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture()
def auth_manager(manager_token):
    return {"Authorization": f"Bearer {manager_token}"}


@pytest.fixture()
def auth_employee(employee_token):
    return {"Authorization": f"Bearer {employee_token}"}


@pytest.fixture()
def unique_email():
    """A distinct address per test so parallel/repeat runs never collide."""
    import uuid

    return f"test.{uuid.uuid4().hex[:10]}@nexora.dev"