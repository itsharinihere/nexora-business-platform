"""Domain exceptions mapped to HTTP responses by the error handlers."""

from .responses import failure


class ApiError(Exception):
    """Base class for errors that should be shown to the client."""

    status_code = 400
    code = "bad_request"
    default_message = "The request could not be processed."

    def __init__(self, message: str | None = None, details: dict | None = None):
        super().__init__(message or self.default_message)
        self.message = message or self.default_message
        self.details = details

    def to_response(self):
        return failure(self.message, self.status_code, self.code, self.details)


class ValidationError(ApiError):
    status_code = 400
    code = "validation_error"
    default_message = "Some fields need your attention."


class AuthenticationError(ApiError):
    status_code = 401
    code = "unauthorized"
    default_message = "You need to sign in to continue."


class PermissionError_(ApiError):
    status_code = 403
    code = "forbidden"
    default_message = "You do not have permission to perform this action."


class NotFoundError(ApiError):
    status_code = 404
    code = "not_found"
    default_message = "The requested resource was not found."


class ConflictError(ApiError):
    status_code = 409
    code = "conflict"
    default_message = "That resource already exists."


class RateLimitError(ApiError):
    status_code = 429
    code = "rate_limited"
    default_message = "Too many requests. Please slow down."