"""Customer model — a won lead or a directly contracted account."""

from sqlalchemy import CheckConstraint, Index

from .. import db
from .mixins import utc_column, utcnow


class Customer(db.Model):
    __tablename__ = "customers"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','onboarding','at_risk','churned')",
            name="ck_customers_status",
        ),
        CheckConstraint("account_value >= 0", name="ck_customers_account_value"),
        Index("ix_customers_status_created", "status", "created_at"),
        Index("ix_customers_owner_status", "owner_id", "status"),
        Index("ix_customers_created_at", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(24), unique=True, nullable=False, index=True)

    name = db.Column(db.String(120), nullable=False)
    company = db.Column(db.String(140), nullable=False)
    email = db.Column(db.String(180), index=True)
    phone = db.Column(db.String(40))
    industry = db.Column(db.String(60), index=True)
    status = db.Column(db.String(20), nullable=False, default="active", index=True)

    account_value = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    notes = db.Column(db.Text)

    # Denormalised health score (0-100) so list views avoid an N+1 aggregate.
    health_score = db.Column(db.Integer, nullable=False, default=80)

    created_at = utc_column()
    updated_at = utc_column(onupdate=utcnow)
    last_interaction_at = utc_column(nullable=True)

    owner = db.relationship(
        "User", back_populates="owned_customers", foreign_keys=[owner_id]
    )
    source_leads = db.relationship(
        "Lead", back_populates="customer", foreign_keys="Lead.customer_id"
    )

    @property
    def is_revenue_active(self) -> bool:
        return self.status in {"active", "onboarding"}

    @property
    def is_at_risk(self) -> bool:
        return self.status == "at_risk" or self.health_score < 60

    def to_dict(self, detailed: bool = False) -> dict:
        payload = {
            "id": self.id,
            "reference": self.reference,
            "name": self.name,
            "company": self.company,
            "email": self.email,
            "phone": self.phone,
            "industry": self.industry,
            "status": self.status,
            "account_value": float(self.account_value or 0),
            "health_score": self.health_score,
            "owner": self.owner.to_dict() if self.owner else None,
            "owner_id": self.owner_id,
            "created_at": self.created_at.isoformat() + "Z",
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
            "last_interaction_at": (
                self.last_interaction_at.isoformat() + "Z"
                if self.last_interaction_at
                else None
            ),
            "is_at_risk": self.is_at_risk,
        }
        if detailed:
            payload.update({"notes": self.notes})
        return payload

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Customer {self.reference} {self.company}>"