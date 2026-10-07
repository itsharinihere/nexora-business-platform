"""Shared Flask extension instances.

Kept in their own module so models and blueprints can import them without
creating a circular dependency with the application factory.
"""

from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()