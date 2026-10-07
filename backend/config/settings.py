"""Application configuration objects.

Configuration is environment driven so the same code runs locally against
SQLite and in production against PostgreSQL. `DATABASE_URL` is normalised
through SQLAlchemy's URL helpers so `postgres://` style values keep working.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _normalise_database_url(url: str) -> str:
    """Accept the common Postgres scheme aliases SQLAlchemy 2.x dropped."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


class BaseConfig:
    """Settings shared by every environment."""

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-insecure-flask-key-do-not-use-in-production")

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # Must be at least 32 bytes for HMAC-SHA256 (RFC 7518 §3.2).
    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY", "dev-only-insecure-jwt-key-do-not-use-in-production"
    )
    JWT_ACCESS_TOKEN_HOURS = int(os.getenv("JWT_ACCESS_TOKEN_HOURS", "12"))
    JWT_ERROR_MESSAGE_KEY = "message"

    JSON_SORT_KEYS = False
    PROPAGATE_EXCEPTIONS = False

    SEED_DEMO_DATA = _as_bool(os.getenv("SEED_DEMO_DATA"), True)
    DEMO_ORG_NAME = os.getenv("DEMO_ORG_NAME", "Vertex Digital Solutions")

    # Pagination guard rails
    DEFAULT_PAGE_SIZE = 20
    MAX_PAGE_SIZE = 100

    # Support SLA in hours, used by the insights engine
    SUPPORT_SLA_HOURS = {"critical": 4, "high": 12, "medium": 48, "low": 96}


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = _normalise_database_url(
        os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'nexora.sqlite'}")
    )


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = False
    SEED_DEMO_DATA = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


class ProductionConfig(BaseConfig):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = _normalise_database_url(
        os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'nexora.sqlite'}")
    )
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"


CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(name: str | None = None):
    key = (name or os.getenv("FLASK_ENV") or "development").strip().lower()
    return CONFIG_MAP.get(key, DevelopmentConfig)