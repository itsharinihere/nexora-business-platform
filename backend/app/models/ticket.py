"""Support ticket model.

Reference format follows the product spec: `NX-2026-0001`.
"""

from sqlalchemy import CheckConstraint, Index

from .. import db
from .mixins import utc_column, utcnow


class SupportTicket(db.Model):
    __tablename__ = "support_tickets"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open','in_progress','waiting','resolved','closed')",
            name="ck_tickets_status",
        ),
        CheckConstraint(
            "priority IN ('low','medium','high','critical')", name="ck_tickets_priority"
        ),
        Index("ix_tickets_status_priority", "status", "priority"),
        Index("ix_tickets_assignee_status", "assignee_id", "status"),
        Index("ix_tickets_requester", "requester_id"),
        Index("ix_tickets_created_at", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(24), unique=True, nullable=False, index=True)

    subject = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(40), nullable=False, default="technical", index=True)
    priority = db.Column(db.String(20), nullable=False, default="medium", index=True)
    status = db.Column(db.String(20), nullable=False, default="open", index=True)

    requester_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    requester_name = db.Column(db.String(120))
    requester_email = db.Column(db.String(180))

    assignee_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)

    # Timestamps powering response/resolution metrics.
    first_response_at = utc_column(nullable=True)
    resolved_at = utc_column(nullable=True)

    created_at = utc_column()
    updated_at = utc_column(onupdate=utcnow)

    requester = db.relationship("User", foreign_keys=[requester_id])
    assignee = db.relationship("User", foreign_keys=[assignee_id])

    @property
    def is_open(self) -> bool:
        return self.status not in {"resolved", "closed"}

    @property
    def age_hours(self) -> float:
        end = self.resolved_at or utcnow()
        return round((end - self.created_at).total_seconds() / 3600, 2)

    @property
    def response_hours(self) -> float | None:
        if self.first_response_at is None:
            return None
        return round((self.first_response_at - self.created_at).total_seconds() / 3600, 2)

    @property
    def resolution_hours(self) -> float | None:
        if self.resolved_at is None:
            return None
        return round((self.resolved_at - self.created_at).total_seconds() / 3600, 2)

    def to_dict(self, detailed: bool = False) -> dict:
        payload = {
            "id": self.id,
            "reference": self.reference,
            "subject": self.subject,
            "category": self.category,
            "priority": self.priority,
            "status": self.status,
            "requester": self.requester.to_dict() if self.requester else None,
            "requester_id": self.requester_id,
            "requester_name": self.requester_name or (
                self.requester.name if self.requester else "External requester"
            ),
            "requester_email": self.requester_email
            or (self.requester.email if self.requester else None),
            "assignee": self.assignee.to_dict() if self.assignee else None,
            "assignee_id": self.assignee_id,
            "age_hours": self.age_hours,
            "response_hours": self.response_hours,
            "resolution_hours": self.resolution_hours,
            "is_open": self.is_open,
            "created_at": self.created_at.isoformat() + "Z",
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
            "first_response_at": (
                self.first_response_at.isoformat() + "Z" if self.first_response_at else None
            ),
            "resolved_at": (
                self.resolved_at.isoformat() + "Z" if self.resolved_at else None
            ),
        }
        if detailed:
            payload.update({"description": self.description})
        return payload

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<SupportTicket {self.reference} {self.subject[:24]}>"