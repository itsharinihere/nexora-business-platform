"""Domain vocabularies shared by models, validation, seeding and the API.

Keeping the allowed values in one place means a bad value can never reach the
database and the metadata served to the frontend always matches what the
backend actually accepts.
"""

import re

# Intentionally pragmatic rather than RFC-complete: one @, a dotted domain,
# no spaces. Anything stricter starts rejecting valid real-world addresses.
EMAIL_RE = r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"

LEAD_STATUSES = ("new", "contacted", "qualified", "proposal", "won", "lost")
LEAD_PRIORITIES = ("low", "medium", "high", "critical")
LEAD_SOURCES = (
    "website",
    "referral",
    "linkedin",
    "cold_call",
    "email_campaign",
    "event",
    "partner",
    "social_media",
)

CUSTOMER_STATUSES = ("active", "onboarding", "at_risk", "churned")
CUSTOMER_INDUSTRIES = (
    "Technology",
    "Finance",
    "Healthcare",
    "Retail",
    "Manufacturing",
    "Education",
    "Logistics",
    "Real Estate",
    "Media",
    "Hospitality",
)

TASK_STATUSES = ("todo", "in_progress", "review", "completed")
TASK_PRIORITIES = ("low", "medium", "high", "critical")

TICKET_STATUSES = ("open", "in_progress", "waiting", "resolved", "closed")
TICKET_CATEGORIES = (
    "technical",
    "billing",
    "account",
    "integration",
    "training",
    "bug",
    "feature_request",
)

USER_STATUSES = ("active", "invited", "inactive")
ROLE_NAMES = ("admin", "manager", "employee")

NOTIFICATION_TYPES = (
    "task_reminder",
    "new_lead",
    "support_ticket",
    "assignment",
    "system",
)

# Actions recorded on the activity timeline.
ACTIVITY_ACTIONS = (
    "auth.login",
    "auth.register",
    "auth.logout",
    "lead.created",
    "lead.updated",
    "lead.deleted",
    "lead.status_changed",
    "lead.assigned",
    "customer.created",
    "customer.updated",
    "customer.deleted",
    "task.created",
    "task.updated",
    "task.completed",
    "task.deleted",
    "task.status_changed",
    "task.assigned",
    "ticket.created",
    "ticket.updated",
    "ticket.status_changed",
    "ticket.assigned",
    "ticket.resolved",
    "team.member_created",
    "team.member_updated",
)

# Columns that must never reach a client payload.
SENSITIVE_USER_FIELDS = {"password_hash"}