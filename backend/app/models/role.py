"""Role model.

Roles are rows rather than an enum column so an administrator can introduce a
new permission tier without a schema migration.
"""

from .. import db
from .mixins import utc_column


class Role(db.Model):
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(32), unique=True, nullable=False, index=True)
    label = db.Column(db.String(64), nullable=False)
    description = db.Column(db.String(255))
    created_at = utc_column()

    users = db.relationship("User", back_populates="role", lazy="select")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "label": self.label,
            "description": self.description,
        }

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Role {self.name}>"