"""Application factory."""

import logging
import os

from flask import Flask, jsonify

from config.settings import get_config
from .errors import register_error_handlers
from .extensions import cors, db, jwt, migrate


def _configure_logging(app: Flask) -> None:
    level = logging.DEBUG if app.config.get("DEBUG") else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    )
    app.logger.setLevel(level)
    logging.getLogger("werkzeug").setLevel(logging.WARNING)


def _configure_cors(app: Flask) -> None:
    origins = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ]
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": origins}},
        supports_credentials=False,  # auth travels in the Authorization header
        expose_headers=["Content-Type", "Authorization"],
    )


def _register_jwt_callbacks(app: Flask) -> None:
    """Return JWT failures in the same envelope as every other error."""

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "token_expired",
                        "message": "Your session has expired. Please sign in again.",
                    },
                }
            ),
            401,
        )

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "invalid_token",
                        "message": "Your session token is not valid. Please sign in again.",
                    },
                }
            ),
            401,
        )

    @jwt.unauthorized_loader
    def missing_token(reason):
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "unauthorized",
                        "message": "You need to sign in to continue.",
                    },
                }
            ),
            401,
        )


def create_app(config_name: str | None = None) -> Flask:
    app = Flask(__name__)
    config_class = get_config(config_name)
    app.config.from_object(config_class)
    app.config["ENV_NAME"] = config_name or os.getenv("FLASK_ENV") or "development"

    _configure_logging(app)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    _configure_cors(app)
    _register_jwt_callbacks(app)

    # Importing models here guarantees they are registered before create_all().
    from . import models  # noqa: F401

    from .routes import register_blueprints

    register_blueprints(app)
    register_error_handlers(app)

    @app.get("/")
    def root():
        return jsonify(
            {
                "service": "NEXORA API",
                "version": "1.0.0",
                "docs": "/api/",
                "health": "/api/health",
            }
        )

    return app