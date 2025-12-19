from app.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        try:
            print("Adding column 'phone'...")
            conn.execute(text("ALTER TABLE providers ADD COLUMN phone VARCHAR"))
        except Exception as e:
            print(f"Skipping 'phone' (maybe exists): {e}")
            
        try:
            print("Adding column 'country'...")
            conn.execute(text("ALTER TABLE providers ADD COLUMN country VARCHAR"))
        except Exception as e:
            print(f"Skipping 'country' (maybe exists): {e}")

        try:
            print("Adding column 'swift'...")
            conn.execute(text("ALTER TABLE providers ADD COLUMN swift VARCHAR"))
        except Exception as e:
            print(f"Skipping 'swift' (maybe exists): {e}")

        try:
            print("Adding column 'file_hash' to batches...")
            conn.execute(text("ALTER TABLE batches ADD COLUMN file_hash VARCHAR"))
        except Exception as e:
            print(f"Skipping 'file_hash' (maybe exists): {e}")
            
        conn.commit()
        print("Migration completed.")

if __name__ == "__main__":
    migrate()
