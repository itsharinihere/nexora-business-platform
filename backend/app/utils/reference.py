"""Human-readable reference generator.

Records get a stable, sortable public id (`LD-2026-0042`) in addition to the
numeric primary key, matching the reference style in the product spec.
Sequences are derived from the table max id so the function stays correct
without a separate counter table.
"""

from ..extensions import db
from ..models import Customer, Lead, SupportTicket, Task, utcnow


def _next_sequential(model, column, prefix: str, width: int = 4) -> str:
    """Allocate the next `PREFIX-YYYY-NNNN` reference for `model`."""
    year = utcnow().year
    stem = f"{prefix}-{year}-"

    highest = 0
    for (existing,) in db.session.query(column).filter(column.like(f"{stem}%")).all():
        tail = existing.rsplit("-", 1)[-1]
        if tail.isdigit():
            highest = max(highest, int(tail))

    return f"{stem}{str(highest + 1).zfill(width)}"


def next_lead_reference() -> str:
    return _next_sequential(Lead, Lead.reference, "LD")


def next_customer_reference() -> str:
    return _next_sequential(Customer, Customer.reference, "CU")


def next_ticket_reference() -> str:
    return _next_sequential(SupportTicket, SupportTicket.reference, "NX")


def next_task_reference() -> str:
    """Tasks use a flat sequence (`TSK-1024`) rather than a year-scoped one."""
    highest = 1000
    for (existing,) in db.session.query(Task.reference).all():
        tail = existing.rsplit("-", 1)[-1]
        if tail.isdigit():
            highest = max(highest, int(tail))
    return f"TSK-{highest + 1}"