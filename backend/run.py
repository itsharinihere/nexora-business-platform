"""NEXORA API entry point.

Local development:      python run.py
Database reset + seed:  flask --app run.py init-db
"""

import os

from dotenv import load_dotenv

load_dotenv()

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402

app = create_app()


@app.cli.command("init-db")
def init_db_command():
    """Drop, recreate, seed and report. Development convenience only."""
    from app.seed import seed_all

    db.drop_all()
    db.create_all()
    print("Database recreated.")
    if app.config.get("SEED_DEMO_DATA"):
        summary = seed_all()
        print("Seed complete:", summary)
    else:
        print("Seeding skipped (SEED_DEMO_DATA is off).")


@app.cli.command("seed")
def seed_command():
    """Seed demo data into an existing database."""
    from app.seed import seed_all

    db.create_all()
    print("Seed complete:", seed_all())


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = app.config.get("DEBUG", False)
    print(f"NEXORA API running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)