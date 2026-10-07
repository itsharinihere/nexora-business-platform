"""User (team member) model with Werkzeug password hashing."""

from werkzeug.security import check_password_hash, generate_password_hash

from .. import db
from .mixins import utc_column, utcnow
from .role import Role


def _iso(value):
    """Serialise a naive-UTC datetime to an explicit UTC ISO-8601 string."""
    return value.isoformat() + "Z" if value else None


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False, index=True)
    title = db.Column(db.String(120))
    department = db.Column(db.String(80))
    phone = db.Column(db.String(40))
    location = db.Column(db.String(120))
    bio = db.Column(db.String(500))
    status = db.Column(db.String(20), nullable=False, default="active", index=True)

    # Notification preferences, surfaced on the Settings page.
    notify_task_reminders = db.Column(db.Boolean, nullable=False, default=True)
    notify_new_leads = db.Column(db.Boolean, nullable=False, default=True)
    notify_support = db.Column(db.Boolean, nullable=False, default=True)
    notify_assignments = db.Column(db.Boolean, nullable=False, default=True)

    theme_preference = db.Column(db.String(10), nullable=False, default="system")

    last_login_at = utc_column(nullable=True)
    created_at = utc_column()
    updated_at = utc_column(onupdate=utcnow)

    role = db.relationship("Role", back_populates="users", lazy="joined")

    owned_leads = db.relationship(
        "Lead",
        back_populates="owner",
        foreign_keys="Lead.owner_id",
        lazy="dynamic",
    )
    owned_customers = db.relationship(
        "Customer",
        back_populates="owner",
        foreign_keys="Customer.owner_id",
        lazy="dynamic",
    )

    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)

    @property
    def role_name(self) -> str:
        return self.role.name if self.role else "employee"

    @property
    def is_admin(self) -> bool:
        return self.role_name == "admin"

    @property
    def can_manage_team(self) -> bool:
        return self.role_name in {"admin", "manager"}

    @property
    def can_delete_records(self) -> bool:
        return self.role_name in {"admin", "manager"}

    @property
    def initials(self) -> str:
        parts = [p for p in self.name.split() if p]
        if not parts:
            return "?"
        if len(parts) == 1:
            return parts[0][:2].upper()
        return (parts[0][0] + parts[-1][0]).upper()

    def to_dict(self, detailed: bool = False) -> dict:
        payload = {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "title": self.title,
            "department": self.department,
            "phone": self.phone,
            "location": self.location,
            "status": self.status,
            "initials": self.initials,
            "role": self.role.to_dict() if self.role else None,
            "role_name": self.role_name,
            "last_login_at": _iso(self.last_login_at),
            "created_at": _iso(self.created_at),
        }
        if detailed:
            payload.update(
                {
                    "bio": self.bio,
                    "theme_preference": self.theme_preference,
                    "permissions": {
                        "manage_team": self.can_manage_team,
                        "delete_records": self.can_delete_records,
                        "manage_settings": self.is_admin,
                    },
                    "preferences": {
                        "notify_task_reminders": self.notify_task_reminders,
                        "notify_new_leads": self.notify_new_leads,
                        "notify_support": self.notify_support,
                        "notify_assignments": self.notify_assignments,
                    },
                }
            )
        return payload

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<User {self.email}>"