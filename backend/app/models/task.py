"""Task model — internal work tracked from Todo through Completed."""

from sqlalchemy import CheckConstraint, Index

from .. import db
from .mixins import utc_column, utcnow


class Task(db.Model):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('todo','in_progress','review','completed')",
            name="ck_tasks_status",
        ),
        CheckConstraint(
            "priority IN ('low','medium','high','critical')", name="ck_tasks_priority"
        ),
        Index("ix_tasks_status_priority", "status", "priority"),
        Index("ix_tasks_assignee_status", "assignee_id", "status"),
        # `due_date` is already indexed by its own `index=True` declaration.
    )

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(24), unique=True, nullable=False, index=True)

    title = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), nullable=False, default="todo", index=True)
    priority = db.Column(db.String(20), nullable=False, default="medium", index=True)

    assignee_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))

    due_date = db.Column(db.Date, index=True)
    completed_at = utc_column(nullable=True)

    # Manual ordering inside a Kanban column.
    position = db.Column(db.Integer, nullable=False, default=0)

    created_at = utc_column()
    updated_at = utc_column(onupdate=utcnow)

    assignee = db.relationship("User", foreign_keys=[assignee_id])
    creator = db.relationship("User", foreign_keys=[created_by_id])

    @property
    def is_completed(self) -> bool:
        return self.status == "completed"

    @property
    def is_overdue(self) -> bool:
        if self.due_date is None or self.is_completed:
            return False
        return self.due_date < utcnow().date()

    @property
    def days_until_due(self) -> int | None:
        if self.due_date is None:
            return None
        return (self.due_date - utcnow().date()).days

    def to_dict(self, detailed: bool = False) -> dict:
        payload = {
            "id": self.id,
            "reference": self.reference,
            "title": self.title,
            "status": self.status,
            "priority": self.priority,
            "position": self.position,
            "assignee": self.assignee.to_dict() if self.assignee else None,
            "assignee_id": self.assignee_id,
            "created_by": self.creator.to_dict() if self.creator else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "days_until_due": self.days_until_due,
            "is_overdue": self.is_overdue,
            "completed_at": (
                self.completed_at.isoformat() + "Z" if self.completed_at else None
            ),
            "created_at": self.created_at.isoformat() + "Z",
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
        if detailed:
            payload.update(
                {
                    "description": self.description,
                    "created_by_id": self.created_by_id,
                }
            )
        return payload

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Task {self.reference} {self.title[:24]}>"