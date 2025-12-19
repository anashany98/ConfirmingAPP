from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/confirming_db")
engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE settings ADD COLUMN export_path VARCHAR DEFAULT ''"))
        conn.commit()
    print("Migration successful: Added export_path to settings table.")
except Exception as e:
    print(f"Migration failed (maybe column exists): {e}")
