"""Blueprint registry."""

from .activities import bp as activities_bp
from .analytics import bp as analytics_bp
from .auth import bp as auth_bp
from .customers import bp as customers_bp
from .dashboard import bp as dashboard_bp
from .leads import bp as leads_bp
from .meta import bp as meta_bp
from .notifications import bp as notifications_bp
from .settings import bp as settings_bp
from .tasks import bp as tasks_bp
from .team import bp as team_bp
from .tickets import bp as tickets_bp

ALL_BLUEPRINTS = (
    meta_bp,
    auth_bp,
    dashboard_bp,
    leads_bp,
    customers_bp,
    tasks_bp,
    team_bp,
    tickets_bp,
    analytics_bp,
    notifications_bp,
    activities_bp,
    settings_bp,
)


def register_blueprints(app) -> None:
    for blueprint in ALL_BLUEPRINTS:
        app.register_blueprint(blueprint)