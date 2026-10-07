"""Shared column helpers so column definitions stay consistent across models."""

from datetime import datetime, timezone

from sqlalchemy import DateTime

from ..extensions import db


def utcnow() -> datetime:
    """Current time as a naive UTC datetime (portable across SQLite/Postgres)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def utcnow_iso() -> str:
    return utcnow().isoformat() + "Z"


class UTCDateTime(DateTime):
    """A DateTime that documents the naive-UTC storage convention.

    The column default cannot live on the type itself (SQLAlchemy only accepts
    `default` on `Column`), so it is supplied by `utc_column` below. This class
    exists to make the intent explicit at every declaration site.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)


def utc_column(*, nullable: bool = False, **kwargs):
    """A timestamp column defaulting to `utcnow()`.

    Replaces the deprecated `datetime.utcnow` callable, which is scheduled for
    removal in Python 3.12+.
    """
    kwargs.setdefault("default", utcnow)
    return db.Column(DateTime, nullable=nullable, **kwargs)