from app.database import engine, SessionLocal
from app.models import Batch
from sqlalchemy import text

def verify():
    db = SessionLocal()
    try:
        # 1. Check if column exists physically
        print("Checking column existence...")
        with engine.connect() as conn:
            result = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'uploaded_to_bank'"))
            row = result.fetchone()
            if row:
                print(f"Column found: {row}")
            else:
                print("COLUMN NOT FOUND IN DB!")

        # 2. Check current values
        batches = db.query(Batch).all()
        print(f"\nFound {len(batches)} batches.")
        for b in batches:
            print(f"ID: {b.id}, Uploaded: {b.uploaded_to_bank} (Type: {type(b.uploaded_to_bank)})")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify()
