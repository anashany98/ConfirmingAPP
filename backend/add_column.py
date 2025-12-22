from app.database import engine
from sqlalchemy import text

def add_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE batches ADD COLUMN uploaded_to_bank BOOLEAN DEFAULT FALSE"))
            conn.commit()
            print("Columna 'uploaded_to_bank' añadida con éxito.")
        except Exception as e:
            print(f"Error al añadir columna (probablemente ya exista): {e}")

if __name__ == "__main__":
    add_column()
