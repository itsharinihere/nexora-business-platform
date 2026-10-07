"""Deterministic demo data generator.

The dataset is seeded with a fixed RNG seed so screenshots, insights and test
expectations stay stable between runs. Dates are spread across the last ~9
months so the 90-day and 1-year analytics ranges both have real shape.
"""

import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from .constants import (
    CUSTOMER_INDUSTRIES,
    LEAD_PRIORITIES,
    LEAD_SOURCES,
    LEAD_STATUSES,
    TASK_PRIORITIES,
    TASK_STATUSES,
    TICKET_CATEGORIES,
    TICKET_STATUSES,
)
from .extensions import db
from .models import (
    Activity,
    Customer,
    Lead,
    Notification,
    Role,
    SupportTicket,
    Task,
    User,
    utcnow,
)

RNG_SEED = 20260214
HISTORY_DAYS = 270

# Module-level generator so every helper below draws from the same stream and
# the whole dataset stays reproducible across runs.
RNG = random.Random(RNG_SEED)

TEAM = [
    # (name, email, role, title, department, location)
    ("Harini Karthikeyan", "harini@nexora.dev", "admin", "Operations Lead", "Operations", "Chennai, India"),
    ("Arun Mehta", "arun@nexora.dev", "manager", "Sales Manager", "Sales", "Bengaluru, India"),
    ("Priya Nair", "priya@nexora.dev", "manager", "Support Lead", "Customer Success", "Chennai, India"),
    ("Karthik Raman", "karthik@nexora.dev", "employee", "Account Executive", "Sales", "Chennai, India"),
    ("Divya Suresh", "divya@nexora.dev", "employee", "Account Executive", "Sales", "Remote"),
    ("Rahul Verma", "rahul@nexora.dev", "employee", "Support Engineer", "Customer Success", "Bengaluru, India"),
    ("Sneha Iyer", "sneha@nexora.dev", "employee", "Support Engineer", "Customer Success", "Remote"),
    ("Vikram Joshi", "vikram@nexora.dev", "employee", "Implementation Specialist", "Delivery", "Pune, India"),
    ("Meera Krishnan", "meera@nexora.dev", "employee", "Business Analyst", "Operations", "Chennai, India"),
]

DEMO_PASSWORD = "Nexora@2026"

COMPANIES = [
    "Northwind Traders", "Bluepeak Systems", "Vertex Analytics", "Lumen Healthcare",
    "Orbit Retail Group", "Stellar Logistics", "Quantum Fintech", "Harborview Media",
    "Cascade Manufacturing", "Ironwood Realty", "Solstice Education", "Fernway Hospitality",
    "Atlas Insurance", "Pinnacle Consulting", "Redwood Energy", "Sapphire Foods",
    "Nimbus Cloud", "Granite Construction", "Halcyon Travel", "Zenith Textiles",
    "Clearwater Utilities", "Beacon Telecom", "Silverline Pharma", "Mosaic Publishing",
    "Evergreen Agriculture", "Titan Fitness", "Lighthouse Legal", "Cobalt Automotive",
    "Saffron Restaurant Group", "Waypoint Studios", "Keystone Bank", "Driftwood Coffee",
]

FIRST_NAMES = [
    "Aarav", "Diya", "Vivaan", "Ananya", "Aditya", "Ishita", "Vihaan", "Saanvi",
    "Arjun", "Kavya", "Rohan", "Meera", "Karthik", "Nisha", "Siddharth", "Pooja",
    "Rahul", "Anjali", "Manish", "Shreya", "Varun", "Deepa", "Nikhil", "Ritu",
    "Suresh", "Lakshmi", "Ganesh", "Swathi", "Mohan", "Priya",
]
LAST_NAMES = [
    "Sharma", "Verma", "Iyer", "Nair", "Reddy", "Patel", "Singh", "Kumar",
    "Menon", "Rao", "Joshi", "Desai", "Chopra", "Malhotra", "Bose", "Gupta",
]

SUBJECT_TEMPLATES = [
    "Unable to log in to the reporting dashboard",
    "Invoice {ref} does not match the agreed amount",
    "Data sync stopped between CRM and accounting",
    "Request to add two new user seats",
    "Dashboard charts render blank after the latest update",
    "Onboarding session needs to be rescheduled",
    "Export to CSV times out for large date ranges",
    "API key rotation broke the mobile integration",
    "Permission error when opening the finance folder",
    "Webhook deliveries are failing silently",
    "Need help configuring SSO for our domain",
    "Weekly summary email stopped arriving",
    "Duplicate contacts were created during the import",
    "Custom fields are not saving on the lead form",
    "Request: bulk edit support for open tickets",
]

TASK_TEMPLATES = [
    "Prepare Q{quarter} pipeline review deck",
    "Follow up on {company} renewal quote",
    "Clean up duplicate records in the CRM import",
    "Draft onboarding plan for {company}",
    "Fix response-time reporting for last week",
    "Run the weekly data quality check",
    "Update the pricing sheet for the new tier",
    "Prepare demo environment for the {company} call",
    "Migrate {company} contacts to the new schema",
    "Write the monthly operations summary",
    "Audit seat usage across all accounts",
    "Set up automated ticket routing rules",
    "Review and approve the security questionnaire",
    "Schedule Q{quarter} business review with {company}",
    "Reconcile support SLAs against the contract",
    "Archive closed deals from last quarter",
    "Prepare the training deck for the new module",
    "Investigate the failed nightly export job",
    "Confirm bank details for the payout batch",
    "Reduce first-response time on open tickets",
]

COMPANY_SUFFIXES = ["Pvt Ltd", "Private Limited", "and Sons", "Group", "& Co", "Solutions"]

NOTE_SNIPPETS = [
    "Interested in the annual plan, asked for a quote.",
    "Budget confirmed for next quarter. Decision maker is the CFO.",
    "Requested a technical deep dive before committing.",
    "Currently evaluating two other vendors.",
    "Referred by an existing customer, warm introduction.",
    "Wants on-site training included in the contract.",
    "Existing account, expanding seat count.",
    "Procurement needs a formal vendor registration first.",
]


def _dt(days_ago: float) -> datetime:
    """A naive-UTC datetime roughly `days_ago` in the past."""
    return utcnow() - timedelta(days=days_ago, hours=RNG.uniform(0, 23), minutes=RNG.randint(0, 59))


def _person() -> tuple[str, str]:
    return RNG.choice(FIRST_NAMES), RNG.choice(LAST_NAMES)


def _email(first: str, last: str, domain: str | None = None) -> str:
    slug_domain = domain or f"{last.lower()}{RNG.randint(1, 40)}.com"
    return f"{first.lower()}.{last.lower()}{RNG.randint(1, 99)}@{slug_domain}"


def _roles() -> dict[str, Role]:
    existing = {role.name: role for role in db.session.query(Role).all()}
    defaults = {
        "admin": ("Administrator", "Full access to every module and setting."),
        "manager": ("Manager", "Manages records, team workload and reporting."),
        "employee": ("Employee", "Works on assigned leads, tasks and tickets."),
    }
    for name, (label, description) in defaults.items():
        if name not in existing:
            role = Role(name=name, label=label, description=description)
            db.session.add(role)
            existing[name] = role
    db.session.flush()
    return existing


def _users(roles: dict[str, Role]) -> list[User]:
    users: list[User] = []
    for index, (name, email, role_name, title, department, location) in enumerate(TEAM):
        user = User(
            name=name,
            email=email,
            role_id=roles[role_name].id,
            title=title,
            department=department,
            location=location,
            phone=f"+91 9{RNG.randint(10000, 99999)} {RNG.randint(10000, 99999)}",
            status="active",
            bio=f"{title} at the business operations team, focused on {department.lower()}.",
            created_at=utcnow() - timedelta(days=HISTORY_DAYS + RNG.randint(5, 60)),
            last_login_at=_dt(RNG.uniform(0, 3)),
        )
        user.set_password(DEMO_PASSWORD)
        db.session.add(user)
        users.append(user)

    # One invited member so the Team page shows a non-active state.
    invited = User(
        name="Test Engineer",
        email="trainee@nexora.dev",
        role_id=roles["employee"].id,
        title="Trainee",
        department="Delivery",
        status="invited",
        created_at=utcnow() - timedelta(days=4),
    )
    invited.set_password(DEMO_PASSWORD)
    db.session.add(invited)
    db.session.flush()

    _log(users[0], "team.member_created", f"{users[0].name} set up the NEXORA workspace", entity_type="user", entity_id=users[0].id)
    return users


def _log(actor, action, description, entity_type=None, entity_id=None, entity_label=None, when=None, metadata=None):
    db.session.add(
        Activity(
            actor_id=actor.id if actor else None,
            action=action,
            description=description,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_label=entity_label,
            metadata_json=metadata or {},
            created_at=when or utcnow(),
        )
    )


def _leads(users: list[User], companies: list[str]) -> list[Lead]:
    leads: list[Lead] = []
    year = utcnow().year
    counters = {year: 0, year - 1: 0}

    sales_team = [u for u in users if u.department == "Sales"] or users
    count = 96

    for index in range(count):
        first, last = _person()
        company = companies[index % len(companies)]
        created = _dt(RNG.uniform(0, HISTORY_DAYS))
        created_year = created.year
        counters[created_year] = counters.get(created_year, 0) + 1

        # Weight status toward the early funnel, as a real pipeline looks.
        status = RNG.choices(
            LEAD_STATUSES,
            weights=[26, 22, 16, 14, 13, 9],
        )[0]

        contacted = None
        if status != "new":
            contacted = created + timedelta(hours=RNG.uniform(2, 72))

        expected = Decimal(RNG.choice([45000, 75000, 120000, 180000, 240000, 320000, 480000, 650000]))
        if RNG.random() < 0.12:
            expected = Decimal(RNG.randint(8, 60)) * 1000

        owner = RNG.choice(sales_team) if RNG.random() > 0.08 else None

        lead = Lead(
            reference=f"LD-{created_year}-{counters[created_year]:04d}",
            name=f"{first} {last}",
            company=company,
            email=_email(first, last),
            phone=f"+91 {RNG.randint(70, 99)}{RNG.randint(10000000, 99999999)}",
            source=RNG.choices(LEAD_SOURCES, weights=[24, 20, 18, 12, 12, 8, 4, 2])[0],
            status=status,
            priority=RNG.choices(LEAD_PRIORITIES, weights=[30, 38, 22, 10])[0],
            owner_id=owner.id if owner else None,
            expected_value=expected,
            notes=RNG.choice(NOTE_SNIPPETS),
            created_at=created,
            updated_at=created + timedelta(days=RNG.uniform(0, 6)),
            last_contacted_at=contacted,
            qualified_at=(contacted + timedelta(days=RNG.uniform(1, 6))) if status in ("qualified", "proposal", "won") else None,
            closed_at=(
                contacted + timedelta(days=RNG.uniform(6, 40))
                if status in ("won", "lost") and contacted
                else None
            ),
        )
        db.session.add(lead)
        leads.append(lead)

        actor = owner or RNG.choice(users)
        _log(
            actor,
            "lead.created",
            f"{actor.name} created lead {lead.reference} for {company}",
            entity_type="lead",
            entity_id=None,
            entity_label=lead.reference,
            when=created,
        )

    db.session.flush()
    return leads


def _customers(users: list[User], leads: list[Lead], companies: list[str]) -> list[Customer]:
    customers: list[Customer] = []
    year = utcnow().year
    counters = {year: 0, year - 1: 0}

    owners = [u for u in users if u.department in ("Sales", "Operations")] or users
    won_leads = [l for l in leads if l.status == "won"]

    # Accounts primarily come from won leads, which keeps the two modules
    # consistent with each other.
    for lead in won_leads:
        created_year = lead.created_at.year
        counters[created_year] = counters.get(created_year, 0) + 1
        customer = Customer(
            reference=f"CU-{created_year}-{counters[created_year]:04d}",
            name=lead.name,
            company=lead.company,
            email=lead.email,
            phone=lead.phone,
            industry=RNG.choice(CUSTOMER_INDUSTRIES),
            status=RNG.choices(["active", "onboarding", "at_risk", "churned"], weights=[52, 20, 18, 10])[0],
            account_value=lead.expected_value,
            owner_id=lead.owner_id,
            notes=f"Converted from lead {lead.reference}. {RNG.choice(NOTE_SNIPPETS)}",
            health_score=RNG.randint(45, 98),
            created_at=lead.closed_at or lead.created_at + timedelta(days=10),
            last_interaction_at=_dt(RNG.uniform(0, 40)),
        )
        db.session.add(customer)
        lead.customer_id = None  # assigned after flush
        customers.append((customer, lead))
        _log(
            (db.session.get(User, lead.owner_id) if lead.owner_id else None) or owners[0],
            "customer.created",
            f"Customer {customer.reference} created from converted lead {lead.reference} ({customer.company})",
            entity_type="customer",
            entity_label=customer.reference,
            when=customer.created_at,
        )

    # A handful of accounts that were onboarded directly.
    used_companies = {c.company for c, _ in customers}
    extras = [c for c in companies if c not in used_companies][:12]
    for company in extras:
        created_year = utcnow().year
        counters[created_year] = counters.get(created_year, 0) + 1
        first, last = _person()
        customer = Customer(
            reference=f"CU-{created_year}-{counters[created_year]:04d}",
            name=f"{first} {last}",
            company=company,
            email=_email(first, last),
            phone=f"+91 {RNG.randint(70, 99)}{RNG.randint(10000000, 99999999)}",
            industry=RNG.choice(CUSTOMER_INDUSTRIES),
            status=RNG.choices(["active", "onboarding", "at_risk"], weights=[60, 25, 15])[0],
            account_value=Decimal(RNG.choice([60000, 120000, 200000, 350000, 500000])),
            owner_id=RNG.choice(owners).id,
            notes="Direct onboarding, no originating lead.",
            health_score=RNG.randint(60, 98),
            created_at=_dt(RNG.uniform(0, HISTORY_DAYS)),
            last_interaction_at=_dt(RNG.uniform(0, 30)),
        )
        db.session.add(customer)
        customers.append((customer, None))

    db.session.flush()

    for customer, lead in customers:
        if lead is not None:
            lead.customer_id = customer.id

    db.session.flush()
    return [c for c, _ in customers]


def _tasks(users: list[User], leads: list[Lead], companies: list[str]) -> list[Task]:
    tasks: list[Task] = []
    assignees = [u for u in users if u.status == "active"]
    number = 1024
    today = utcnow().date()

    for _ in range(88):
        first, last = _person()
        title = RNG.choice(TASK_TEMPLATES).format(
            quarter=RNG.choice([1, 2, 3, 4]),
            company=RNG.choice(companies),
        )
        created = _dt(RNG.uniform(0, 120))
        status = RNG.choices(TASK_STATUSES, weights=[30, 26, 14, 30])[0]
        assignee = RNG.choice(assignees) if RNG.random() > 0.07 else None
        priority = RNG.choices(TASK_PRIORITIES, weights=[26, 38, 24, 12])[0]

        # Completed tasks must have completed_at; open tasks skew near-term.
        if status == "completed":
            completed = created + timedelta(days=RNG.uniform(0.5, 18))
            due = (completed + timedelta(days=RNG.uniform(-6, 6))).date()
        else:
            completed = None
            due = today + timedelta(days=RNG.randint(-12, 26))

        tasks.append(
            Task(
                reference=f"TSK-{number}",
                title=title,
                description=f"{RNG.choice(NOTE_SNIPPETS)} Raised by {first} {last}.",
                status=status,
                priority=priority,
                assignee_id=assignee.id if assignee else None,
                created_by_id=RNG.choice(users).id,
                due_date=due,
                completed_at=completed,
                position=number % 5,
                created_at=created,
                updated_at=completed or created,
            )
        )
        number += 1

    db.session.add_all(tasks)
    db.session.flush()

    for task in tasks:
        if task.status == "completed" and task.assignee_id:
            actor = db.session.get(User, task.assignee_id)
            _log(
                actor,
                "task.completed",
                f"{actor.name} completed task {task.reference}",
                entity_type="task",
                entity_label=task.reference,
                when=task.completed_at,
                metadata={"title": task.title},
            )
        elif task.created_by_id:
            actor = db.session.get(User, task.created_by_id)
            _log(
                actor,
                "task.created",
                f"{actor.name} created task {task.reference}",
                entity_type="task",
                entity_label=task.reference,
                when=task.created_at,
            )
    db.session.flush()
    return tasks


def _tickets(users: list[User], customers: list[Customer]) -> list[SupportTicket]:
    tickets: list[SupportTicket] = []
    support = [u for u in users if u.department == "Customer Success"] or users
    year = utcnow().year
    counters = {year: 0, year - 1: 0}

    for index in range(74):
        created = _dt(RNG.uniform(0, 150))
        created_year = created.year
        counters[created_year] = counters.get(created_year, 0) + 1

        status = RNG.choices(TICKET_STATUSES, weights=[22, 26, 12, 24, 16])[0]
        priority = RNG.choices(LEAD_PRIORITIES, weights=[24, 36, 26, 14])[0]
        customer = RNG.choice(customers)
        requester = RNG.choice(users) if RNG.random() > 0.25 else None
        assignee = RNG.choice(support) if RNG.random() > 0.1 else None

        first_response = (
            created + timedelta(hours=RNG.uniform(0.3, 30)) if status != "open" else None
        )
        resolved = (
            first_response + timedelta(hours=RNG.uniform(1, 90))
            if status in ("resolved", "closed") and first_response
            else None
        )

        ticket = SupportTicket(
            reference=f"NX-{created_year}-{counters[created_year]:04d}",
            subject=RNG.choice(SUBJECT_TEMPLATES).format(ref=f"INV-{RNG.randint(4000, 9900)}"),
            description=(
                "Reported by the account team during the weekly review. "
                f"{RNG.choice(NOTE_SNIPPETS)}"
            ),
            category=RNG.choices(TICKET_CATEGORIES, weights=[30, 16, 12, 14, 8, 14, 6])[0],
            priority=priority,
            status=status,
            requester_id=requester.id if requester else None,
            requester_name=(requester.name if requester else customer.name),
            requester_email=(requester.email if requester else customer.email),
            assignee_id=assignee.id if assignee else None,
            first_response_at=first_response,
            resolved_at=resolved,
            created_at=created,
            updated_at=resolved or first_response or created,
        )
        db.session.add(ticket)
        tickets.append(ticket)

        actor = assignee or requester or users[0]
        _log(
            actor,
            "ticket.created",
            f"{actor.name} opened ticket {ticket.reference}",
            entity_type="ticket",
            entity_label=ticket.reference,
            when=created,
            metadata={"priority": priority},
        )
        if resolved:
            _log(
                actor,
                "ticket.resolved",
                f"{actor.name} resolved ticket {ticket.reference}",
                entity_type="ticket",
                entity_label=ticket.reference,
                when=resolved,
            )

    db.session.flush()
    return tickets


def _notifications(users: list[User], tasks: list[Task], tickets: list[SupportTicket]) -> None:
    admin = users[0]
    support = [u for u in users if u.department == "Customer Success"]

    open_tasks = [t for t in tasks if t.status != "completed" and t.assignee_id == admin.id]
    for task in open_tasks[:3]:
        db.session.add(
            Notification(
                user_id=admin.id,
                type="task_reminder",
                title=f"Task due soon: {task.title[:60]}",
                message=f"{task.reference} is due on {task.due_date}.",
                link=f"/app/tasks/{task.id}",
                created_at=_dt(RNG.uniform(0, 2)),
            )
        )

    open_tickets = [t for t in tickets if t.status in ("open", "in_progress")]
    for ticket in open_tickets[:3]:
        db.session.add(
            Notification(
                user_id=admin.id,
                type="support_ticket",
                title=f"Ticket {ticket.reference} needs attention",
                message=ticket.subject[:120],
                link=f"/app/support/{ticket.id}",
                created_at=_dt(RNG.uniform(0, 3)),
            )
        )

    assigned_tasks = [t for t in tasks if t.status != "completed" and t.assignee_id]
    for task in RNG.sample(assigned_tasks, min(4, len(assigned_tasks))):
        db.session.add(
            Notification(
                user_id=task.assignee_id,
                type="assignment",
                title=f"Task {task.reference} assigned to you",
                message=task.title[:120],
                link=f"/app/tasks/{task.id}",
                created_at=_dt(RNG.uniform(0, 5)),
            )
        )

    db.session.add(
        Notification(
            user_id=admin.id,
            type="system",
            title="Welcome to NEXORA",
            message="Demo data has been loaded so every module has something to show.",
            link="/app/dashboard",
            is_read=True,
            created_at=_dt(1),
        )
    )

    for member in support[:1]:
        db.session.add(
            Notification(
                user_id=member.id,
                type="support_ticket",
                title="SLA at risk on a high priority ticket",
                message="A critical ticket is approaching its response target.",
                link="/app/support",
                created_at=_dt(0.2),
            )
        )

    db.session.flush()


def seed_all() -> dict:
    """Populate the database with a realistic demo workspace."""
    RNG.seed(RNG_SEED)

    roles = _roles()
    users = _users(roles)

    company_pool = [c for c in COMPANIES]
    RNG.shuffle(company_pool)

    leads = _leads(users, company_pool)
    customers = _customers(users, leads, company_pool)
    tasks = _tasks(users, leads, company_pool)
    tickets = _tickets(users, customers)
    _notifications(users, tasks, tickets)

    db.session.commit()

    return {
        "users": len(users) + 1,
        "leads": len(leads),
        "customers": len(customers),
        "tasks": len(tasks),
        "tickets": len(tickets),
        "activities": db.session.query(Activity).count(),
        "notifications": db.session.query(Notification).count(),
        "demo_password": DEMO_PASSWORD,
    }