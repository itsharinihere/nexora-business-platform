"""Lead model — the top of the sales funnel."""

from sqlalchemy import CheckConstraint, Index

from .. import db
from .mixins import utc_column, utcnow


class Lead(db.Model):
    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint(
            "status IN ('new','contacted','qualified','proposal','won','lost')",
            name="ck_leads_status",
        ),
        CheckConstraint(
            "priority IN ('low','medium','high','critical')", name="ck_leads_priority"
        ),
        CheckConstraint("expected_value >= 0", name="ck_leads_expected_value"),
        # Composite indexes mirror the exact filter/sort combinations the UI issues.
        Index("ix_leads_status_created", "status", "created_at"),
        Index("ix_leads_owner_status", "owner_id", "status"),
        Index("ix_leads_created_at", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(24), unique=True, nullable=False, index=True)

    name = db.Column(db.String(120), nullable=False)
    company = db.Column(db.String(140))
    email = db.Column(db.String(180), index=True)
    phone = db.Column(db.String(40))

    source = db.Column(db.String(40), nullable=False, default="website", index=True)
    status = db.Column(db.String(20), nullable=False, default="new", index=True)
    priority = db.Column(db.String(20), nullable=False, default="medium", index=True)

    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), index=True)

    expected_value = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    notes = db.Column(db.Text)

    created_at = utc_column()
    updated_at = utc_column(onupdate=utcnow)
    last_contacted_at = utc_column(nullable=True)
    qualified_at = utc_column(nullable=True)
    closed_at = utc_column(nullable=True)

    owner = db.relationship("User", back_populates="owned_leads", foreign_keys=[owner_id])
    customer = db.relationship("Customer", back_populates="source_leads", foreign_keys=[customer_id])

    @property
    def is_open(self) -> bool:
        return self.status not in {"won", "lost"}

    @property
    def is_overdue(self) -> bool:
        """A lead counts as stale once it has not been contacted in 14 days."""
        if not self.is_open or self.last_contacted_at is None:
            return False
        age = utcnow() - self.last_contacted_at
        return age.days >= 14

    def to_dict(self, detailed: bool = False) -> dict:
        payload = {
            "id": self.id,
            "reference": self.reference,
            "name": self.name,
            "company": self.company,
            "email": self.email,
            "phone": self.phone,
            "source": self.source,
            "status": self.status,
            "priority": self.priority,
            "expected_value": float(self.expected_value or 0),
            "owner": self.owner.to_dict() if self.owner else None,
            "owner_id": self.owner_id,
            "customer_id": self.customer_id,
            "created_at": self.created_at.isoformat() + "Z",
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
            "last_contacted_at": (
                self.last_contacted_at.isoformat() + "Z" if self.last_contacted_at else None
            ),
            "is_open": self.is_open,
            "is_stale": self.is_overdue,
        }
        if detailed:
            payload.update({"notes": self.notes, "customer": self.customer.to_dict() if self.customer else None})
        return payload

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Lead {self.reference} {self.name}>"