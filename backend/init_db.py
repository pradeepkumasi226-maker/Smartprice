import os
from pathlib import Path
from .database import engine, Base
from .app.models import *
from .app.seed.seed_data import seed_database

def init_db():
    print("[Init DB] Creating tables in SQLite database...")
    Base.metadata.create_all(bind=engine)
    print("[Init DB] Tables created successfully.")
    print("[Init DB] Seeding initial deterministic retail data...")
    seed_database(force=False)
    print("[Init DB] Initialization complete!")

if __name__ == "__main__":
    init_db()
