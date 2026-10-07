"""Model package barrel export.

Importing every model here guarantees they are registered on the metadata
before `db.create_all()` or a migration autogenerate runs.
"""

from .activity import Activity
from .customer import Customer
from .lead import Lead
from .mixins import utc_column, utcnow
from .notification import Notification
from .role import Role
from .task import Task
from .ticket import SupportTicket
from .user import User

__all__ = [
    "Activity",
    "Customer",
    "Lead",
    "Notification",
    "Role",
    "SupportTicket",
    "Task",
    "User",
    "utc_column",
    "utcnow",
]