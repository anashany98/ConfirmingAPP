from app.database import engine
from sqlalchemy import text

def add_hash_column():
    with engine.connect() as conn:
        # Use isolation level AUTOCOMMIT to avoid transaction blocks on error if possible, 
        # or just simple execution since it's a single DDL
        conn.execution_options(isolation_level="AUTOCOMMIT")
        try:
            print("Adding column 'file_hash' to batches...")
            conn.execute(text("ALTER TABLE batches ADD COLUMN file_hash VARCHAR"))
            conn.commit()
            print("Success.")
        except Exception as e:
            print(f"Error (maybe already exists): {e}")

if __name__ == "__main__":
    add_hash_column()
