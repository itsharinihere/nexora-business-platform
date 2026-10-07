"""Notification model backing the in-app notification centre."""

from sqlalchemy import Index

from .. import db
from .mixins import utc_column


class Notification(db.Model):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_read", "user_id", "is_read"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    type = db.Column(db.String(40), nullable=False, default="system", index=True)
    title = db.Column(db.String(160), nullable=False)
    message = db.Column(db.String(400))
    link = db.Column(db.String(255))

    is_read = db.Column(db.Boolean, nullable=False, default=False)
    read_at = utc_column(nullable=True)

    created_at = utc_column()

    user = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "link": self.link,
            "is_read": self.is_read,
            "read_at": self.read_at.isoformat() + "Z" if self.read_at else None,
            "created_at": self.created_at.isoformat() + "Z",
        }

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Notification {self.id} {self.type}>"