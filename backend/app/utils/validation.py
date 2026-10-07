"""Request validation helpers.

Validation lives on the server so the API is trustworthy regardless of which
client calls it. The client mirrors these rules for instant feedback but is
never the only line of defence.
"""

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from ..constants import (
    CUSTOMER_INDUSTRIES,
    CUSTOMER_STATUSES,
    EMAIL_RE,
    LEAD_PRIORITIES,
    LEAD_SOURCES,
    LEAD_STATUSES,
    TASK_PRIORITIES,
    TASK_STATUSES,
    TICKET_CATEGORIES,
    TICKET_STATUSES,
    USER_STATUSES,
)
from .errors import ValidationError

# `constants.EMAIL_RE` lives there to keep the vocabulary in one module.
EMAIL_RE = re.compile(EMAIL_RE)
PASSWORD_MIN_LENGTH = 8
PHONE_RE = re.compile(r"^[0-9+()\-.\s]{6,25}$")
DATE_FORMATS = ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d")


def collect(errors: dict[str, str]):
    if errors:
        raise ValidationError("Please correct the highlighted fields.", details=errors)


def require_json(payload) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError("A JSON object body is required.")
    return payload


def validate_email(value: str) -> str:
    value = (value or "").strip().lower()
    if not value:
        raise ValidationError("Email is required.", {"email": "Email is required."})
    if len(value) > 180 or not EMAIL_RE.match(value):
        raise ValidationError(
            "Enter a valid email address.", {"email": "Enter a valid email address."}
        )
    return value


def validate_password(value: str) -> str:
    if not value:
        raise ValidationError("Password is required.", {"password": "Password is required."})
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValidationError(
            f"Password must be at least {PASSWORD_MIN_LENGTH} characters.",
            {"password": f"Use at least {PASSWORD_MIN_LENGTH} characters."},
        )
    if len(value) > 128:
        raise ValidationError(
            "Password is too long.", {"password": "Use at most 128 characters."}
        )
    if value.lower() == value or value.upper() == value:
        raise ValidationError(
            "Password needs a mix of upper and lower case characters.",
            {"password": "Add upper and lower case characters."},
        )
    if not any(ch.isdigit() for ch in value):
        raise ValidationError(
            "Password must include a number.",
            {"password": "Include at least one number."},
        )
    return value


def _key(label: str) -> str:
    """Normalise a human label into the machine field key used by the payload.

    `validate_string` is called with display labels ("Due date"), but clients
    attach errors using payload keys ("due_date"). Deriving the key keeps the
    `details` map consistent no matter which validator raised it.
    """
    return label.strip().lower().replace(" ", "_")


def validate_string(
    value,
    field: str,
    *,
    required: bool = True,
    max_length: int = 255,
    min_length: int = 1,
) -> str | None:
    key = _key(field)
    if value is None:
        if required:
            raise ValidationError(
                f"{field} is required.", {key: f"{field} is required."}
            )
        return None
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be text.", {key: f"{field} must be text."})
    cleaned = value.strip()
    if not cleaned:
        if required:
            raise ValidationError(
                f"{field} is required.", {key: f"{field} is required."}
            )
        return None
    if len(cleaned) < min_length:
        raise ValidationError(
            f"{field} is too short.", {key: f"Use at least {min_length} characters."}
        )
    if len(cleaned) > max_length:
        raise ValidationError(
            f"{field} is too long.",
            {key: f"Use at most {max_length} characters."},
        )
    return cleaned


def validate_email_field(value, field: str = "email", required: bool = True):
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValidationError("Email is required.", {field: "Email is required."})
        return None
    return validate_email(value)


def validate_phone(value, field: str = "phone", required: bool = False):
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValidationError("Phone is required.", {field: "Phone is required."})
        return None
    if not isinstance(value, str) or not PHONE_RE.match(value.strip()):
        raise ValidationError(
            "Enter a valid phone number.", {field: "Enter a valid phone number."}
        )
    return value.strip()


def validate_choice(value, field: str, allowed, required: bool = True):
    if value is None or value == "":
        if required:
            raise ValidationError(
                f"{field} is required.", {field: f"Select a {field.lower()}."}
            )
        return None
    if value not in allowed:
        raise ValidationError(
            f"{field} must be one of: {', '.join(allowed)}.",
            {field: f"Select a valid {field.lower()}."},
        )
    return value


def validate_money(value, field: str = "value", required: bool = False):
    if value is None or value == "":
        if required:
            raise ValidationError(
                f"{field} is required.", {field: f"{field} is required."}
            )
        return Decimal("0")
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError(
            f"{field} must be a number.", {field: "Enter a valid number."}
        )
    if amount < 0:
        raise ValidationError(
            f"{field} cannot be negative.", {field: "Enter a positive number."}
        )
    if amount > Decimal("99999999999"):
        raise ValidationError(
            f"{field} is too large.", {field: "Value is unrealistically large."}
        )
    return amount.quantize(Decimal("0.01"))


def validate_date(value, field: str = "date", required: bool = False):
    if value is None or value == "":
        if required:
            raise ValidationError(f"{field} is required.", {field: f"{field} is required."})
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be a date.", {field: "Enter a valid date."})
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    raise ValidationError(f"{field} must be a date.", {field: "Use YYYY-MM-DD format."})


def validate_bool(value, default: bool | None = None):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "on"}:
            return True
        if lowered in {"false", "0", "no", "off"}:
            return False
    raise ValidationError("Expected a boolean value.")


def validate_user_id(value, field: str, required: bool = True):
    if value is None or value == "":
        if required:
            raise ValidationError(
                f"{field} is required.", {field: f"Select a {field.lower()}."}
            )
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"Invalid {field}.", {field: "Select a valid option."})


# Domain specific field validators ------------------------------------------


def validate_lead_status(value, required: bool = False):
    return validate_choice(value, "status", LEAD_STATUSES, required)


def validate_lead_priority(value, required: bool = False):
    return validate_choice(value, "priority", LEAD_PRIORITIES, required)


def validate_lead_source(value, required: bool = False):
    return validate_choice(value, "source", LEAD_SOURCES, required)


def validate_customer_status(value, required: bool = False):
    return validate_choice(value, "status", CUSTOMER_STATUSES, required)


def validate_industry(value, required: bool = False):
    return validate_choice(value, "industry", CUSTOMER_INDUSTRIES, required)


def validate_task_status(value, required: bool = False):
    return validate_choice(value, "status", TASK_STATUSES, required)


def validate_task_priority(value, required: bool = False):
    return validate_choice(value, "priority", TASK_PRIORITIES, required)


def validate_ticket_status(value, required: bool = False):
    return validate_choice(value, "status", TICKET_STATUSES, required)


def validate_ticket_category(value, required: bool = False):
    return validate_choice(value, "category", TICKET_CATEGORIES, required)


def validate_user_status(value, required: bool = False):
    return validate_choice(value, "status", USER_STATUSES, required)