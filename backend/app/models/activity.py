"""Activity model — an append-only audit/timeline feed."""

from sqlalchemy import Index
from sqlalchemy.types import JSON

from .. import db
from .mixins import utc_column


class Activity(db.Model):
    __tablename__ = "activities"
    __table_args__ = (
        Index("ix_activities_entity", "entity_type", "entity_id"),
        Index("ix_activities_created_at", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)

    action = db.Column(db.String(50), nullable=False, index=True)
    entity_type = db.Column(db.String(40), index=True)
    entity_id = db.Column(db.Integer)
    entity_label = db.Column(db.String(180))

    # Human readable sentence rendered directly in the timeline UI.
    description = db.Column(db.String(400), nullable=False)
    metadata_json = db.Column("metadata", JSON)

    created_at = utc_column()

    actor = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "entity_label": self.entity_label,
            "description": self.description,
            "metadata": self.metadata_json or {},
            "actor": self.actor.to_dict() if self.actor else None,
            "actor_name": self.actor.name if self.actor else "System",
            "created_at": self.created_at.isoformat() + "Z",
        }

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Activity {self.action} by {self.actor_id}>"