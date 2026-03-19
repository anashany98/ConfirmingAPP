from app.database import SessionLocal, engine, Base
from app import models
from datetime import datetime, timedelta
import random

def populate_db():
    print("Populating database...")
    db = SessionLocal()
    
    try:
        # 1. Create Tables if they don't exist
        Base.metadata.create_all(bind=engine)

        # 2. Default Settings
        if not db.query(models.Settings).first():
            print("Creating default settings...")
            settings = models.Settings(
                codigo_empresa="9999",
                numero_cuenta_cargo="ES0400491500051234567892",
                sufijo="000",
                nombre_empresa="MI EMPRESA GLOBAL S.L.",
                cif_empresa="B12345678",
                export_path="./exports"
            )
            db.add(settings)

        # 3. Sample Providers
        providers_data = [
            {"cif": "B87654321", "name": "Proveedor Tecnológico S.A.", "email": "tecnico@prov-tec.com", "address": "Calle Ficticia 123", "city": "Madrid", "zip_code": "28001", "iban": "ES7001825700680201502479", "country": "ES"},
            {"cif": "A11223344", "name": "Logística Rápida S.L.", "email": "info@logirapida.es", "address": "Polígono Industrial Nave 4", "city": "Barcelona", "zip_code": "08005", "iban": "ES2114650100722030876293", "country": "ES"},
            {"cif": "B55667788", "name": "Servicios Generales Global", "email": "admin@sergeglo.es", "address": "Av. Libertad 45", "city": "Sevilla", "zip_code": "41010", "iban": "ES4421000100722030876211", "country": "ES"},
        ]

        for p_data in providers_data:
            if not db.query(models.Provider).filter(models.Provider.cif == p_data["cif"]).first():
                print(f"Creating provider: {p_data['name']}")
                provider = models.Provider(**p_data)
                db.add(provider)

        # 4. Sample History (Batches & Invoices)
        if not db.query(models.Batch).first():
            print("Creating sample history...")
            for i in range(3):
                batch_date = datetime.utcnow() - timedelta(days=i*10)
                batch = models.Batch(
                    name=f"Remesa {batch_date.strftime('%Y-%m-%d')}",
                    created_at=batch_date,
                    payment_date=batch_date + timedelta(days=30),
                    status=models.BatchStatus.SENT if i > 0 else models.BatchStatus.GENERATED,
                    uploaded_to_bank=True if i > 0 else False
                )
                db.add(batch)
                db.flush() # Get batch ID

                # Add some invoices to the batch
                for j in range(2):
                    provider = providers_data[j]
                    invoice = models.Invoice(
                        batch_id=batch.id,
                        cif=provider["cif"],
                        nombre=provider["name"],
                        importe=random.uniform(500, 5000),
                        factura=f"F-2024-{i}{j}",
                        fecha_vencimiento=batch.payment_date,
                        cuenta=provider["iban"],
                        status=models.InvoiceStatus.VALID
                    )
                    db.add(invoice)

        db.commit()
        print("Database population complete!")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    populate_db()
