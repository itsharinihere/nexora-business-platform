"""Application-wide error handlers.

Every failure leaves the API as the same JSON envelope. Unexpected exceptions
are logged with a traceback server-side and reported to the client as a generic
message, so stack traces and SQL never leak into a response.
"""

import logging

from flask import Flask, jsonify
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException

from .extensions import db

logger = logging.getLogger("nexora.errors")


def _wants_json() -> bool:
    from flask import request

    return request.path.startswith("/api/")


def register_error_handlers(app: Flask) -> None:
    # Domain errors carry their own status, code and details.
    from .utils.errors import ApiError

    @app.errorhandler(ApiError)
    def handle_api_error(exc: ApiError):
        db.session.rollback()
        if exc.status_code >= 500:
            logger.exception("API error: %s", exc.message)
        return exc.to_response()

    @app.errorhandler(HTTPException)
    def handle_http_exception(exc: HTTPException):
        if not _wants_json():
            return exc
        db.session.rollback()
        code_map = {
            400: "bad_request",
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            405: "method_not_allowed",
            409: "conflict",
            413: "payload_too_large",
            429: "rate_limited",
        }
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": code_map.get(exc.code, "http_error"),
                        "message": exc.description or exc.name,
                    },
                }
            ),
            exc.code or 500,
        )

    @app.errorhandler(SQLAlchemyError)
    def handle_database_error(exc: SQLAlchemyError):
        db.session.rollback()
        logger.exception("Database error: %s", exc)
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "database_error",
                        "message": "A database error occurred. Please try again.",
                    },
                }
            ),
            500,
        )

    @app.errorhandler(Exception)
    def handle_unexpected(exc: Exception):
        db.session.rollback()
        logger.exception("Unhandled error: %s", exc)
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "internal_error",
                        "message": "Something went wrong on our end. Please try again.",
                    },
                }
            ),
            500,
        )