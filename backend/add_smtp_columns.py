from app.database import engine
from sqlalchemy import text

def run_migration():
    print("Migrating database (Adding SMTP columns)...")
    try:
        with engine.connect() as conn:
            # Postgres supports ADD COLUMN IF NOT EXISTS
            conn.execute(text("ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_server VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 587"))
            conn.execute(text("ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_user VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_password VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_from_email VARCHAR DEFAULT ''"))
            conn.commit()
        print("Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    run_migration()
