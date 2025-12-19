from app.database import engine
from sqlalchemy import text

def add_payment_date_column():
    with engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        try:
            print("Adding column 'payment_date' to batches...")
            # Using TIMESTAMP because SQLAlchemy DateTime maps to TIMESTAMP in Postgres
            conn.execute(text("ALTER TABLE batches ADD COLUMN payment_date TIMESTAMP"))
            print("Success.")
        except Exception as e:
            print(f"Error (maybe already exists): {e}")

if __name__ == "__main__":
    add_payment_date_column()
