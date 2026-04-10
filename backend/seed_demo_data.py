import os
from datetime import datetime, timedelta
from pathlib import Path


database_url = os.getenv("DATABASE_URL", "")
if database_url.startswith("sqlite:///"):
    sqlite_path = database_url.replace("sqlite:///", "", 1)
    db_file = Path(sqlite_path)
    if db_file.exists():
        db_file.unlink()

from app.database import Base, SessionLocal, engine
from app.models import Batch, BatchStatus, Invoice, InvoiceStatus, Provider, Settings, User
from app.services.auth import get_password_hash


def seed_demo_data():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    now = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)

    try:
        settings = Settings(
            codigo_empresa="0045",
            numero_cuenta_cargo="5282582852852852963",
            sufijo="001",
            nombre_empresa="Confirming Demo S.L.",
            cif_empresa="B12345678",
        )
        db.add(settings)

        admin = User(
            username="admin",
            email="admin@confirming.demo",
            hashed_password=get_password_hash("admin123"),
            is_active=True,
        )
        db.add(admin)

        providers = {
            "B87654321": Provider(
                cif="B87654321",
                name="Proveedor Tecnologico S.A.",
                email="tecnico@prov-tec.com",
                address="Calle Ficticia 123",
                city="Madrid",
                zip_code="28001",
                iban="ES7001825700680201502479",
                phone="910000001",
                country="ES",
                swift="CAIXESBBXXX",
            ),
            "A11223344": Provider(
                cif="A11223344",
                name="Logistica Rapida S.L.",
                email="info@logirapida.es",
                address="Poligono Industrial Nave 4",
                city="Barcelona",
                zip_code="08005",
                iban="ES2114650100722030876293",
                phone="930000002",
                country="ES",
                swift="BSCHESMMXXX",
            ),
            "B55667788": Provider(
                cif="B55667788",
                name="Servicios Generales Global",
                email="admin@sergeglo.es",
                address="Av. Libertad 45",
                city="Sevilla",
                zip_code="41010",
                iban="ES4421000100722030876211",
                phone="950000003",
                country="ES",
                swift="BBVAESMMXXX",
            ),
            "B99887766": Provider(
                cif="B99887766",
                name="Construcciones Delta S.L.",
                email="",
                address="Parque Empresarial Sur 12",
                city="Valencia",
                zip_code="46011",
                iban="ES5500491500051234567890",
                phone="960000004",
                country="ES",
                swift="BSABESBBXXX",
            ),
            "A44556677": Provider(
                cif="A44556677",
                name="Marketing Iberico S.L.",
                email="ops@marketingiberico.es",
                address="Gran Via 18",
                city="Bilbao",
                zip_code="48001",
                iban="",
                phone="940000005",
                country="ES",
                swift="BKBKESMMXXX",
            ),
            "B22334455": Provider(
                cif="B22334455",
                name="Energia Levante S.A.",
                email="finanzas@energialevante.es",
                address="Camino del Puerto 7",
                city="Alicante",
                zip_code="03003",
                iban="ES1200492352081000456789",
                phone="965000006",
                country="ES",
                swift="CECAESMMXXX",
            ),
        }
        for provider in providers.values():
            db.add(provider)

        batch_specs = [
            {
                "name": "Remesa Enero Norte",
                "created_days": -165,
                "payment_days": -150,
                "status": BatchStatus.SENT,
                "items": [
                    ("B87654321", "BIT-2025-090", 8200.00, -148, InvoiceStatus.VALID, "Pago plataforma anual"),
                    ("A11223344", "LOG-2025-044", 6400.00, -145, InvoiceStatus.VALID, "Servicios logisticos"),
                    ("B55667788", "SER-2025-188", 1850.00, -143, InvoiceStatus.VALID, "Mantenimiento"),
                ],
            },
            {
                "name": "Remesa Febrero Centro",
                "created_days": -132,
                "payment_days": -118,
                "status": BatchStatus.SENT,
                "items": [
                    ("B87654321", "BIT-2025-111", 9400.00, -115, InvoiceStatus.VALID, "Licencias y soporte"),
                    ("B99887766", "DEL-2025-050", 12150.00, -112, InvoiceStatus.VALID, "Obra delegacion este"),
                    ("A44556677", "MKT-2025-017", 3900.00, -109, InvoiceStatus.WARNING, "Falta IBAN maestro"),
                ],
            },
            {
                "name": "Remesa Marzo Expansion",
                "created_days": -102,
                "payment_days": -88,
                "status": BatchStatus.SENT,
                "items": [
                    ("B22334455", "ENE-2025-233", 16800.00, -84, InvoiceStatus.VALID, "Consumo energetico"),
                    ("A11223344", "LOG-2025-061", 7100.00, -83, InvoiceStatus.VALID, "Distribucion norte"),
                    ("B55667788", "SER-2025-219", 2420.00, -81, InvoiceStatus.VALID, "Servicio anual"),
                ],
            },
            {
                "name": "Remesa Abril Operativa",
                "created_days": -72,
                "payment_days": -58,
                "status": BatchStatus.SENT,
                "items": [
                    ("B87654321", "BIT-2026-004", 10450.00, -55, InvoiceStatus.VALID, "Integraciones criticas"),
                    ("B99887766", "DEL-2026-014", 14800.00, -53, InvoiceStatus.WARNING, "Proveedor sin email"),
                    ("A44556677", "MKT-2026-003", 5200.00, -50, InvoiceStatus.WARNING, "Ficha sin IBAN"),
                ],
            },
            {
                "name": "Remesa Mayo Estrategica",
                "created_days": -40,
                "payment_days": -12,
                "status": BatchStatus.SENT,
                "items": [
                    ("B22334455", "ENE-2026-007", 21400.00, -8, InvoiceStatus.VALID, "Ajuste suministro trimestre"),
                    ("A11223344", "LOG-2026-014", 26000.00, 38, InvoiceStatus.WARNING, "Posible duplicidad historica"),
                    ("B55667788", "SER-2026-044", 3100.00, 12, InvoiceStatus.VALID, "Servicios mensuales"),
                ],
            },
            {
                "name": "Remesa Demo Importada A",
                "created_days": -10,
                "payment_days": 10,
                "status": BatchStatus.GENERATED,
                "items": [
                    ("B87654321", "F-2024-001", 1250.75, 3, InvoiceStatus.WARNING, "Duplicada respecto a importacion posterior"),
                    ("A11223344", "F-2024-002", 3400.00, 3, InvoiceStatus.VALID, "Importada desde fichero demo"),
                    ("B99887766", "DEL-2026-042", 18000.00, 17, InvoiceStatus.WARNING, "Proveedor sin email maestro"),
                ],
            },
            {
                "name": "Remesa Demo Importada B",
                "created_days": -2,
                "payment_days": 12,
                "status": BatchStatus.GENERATED,
                "items": [
                    ("B87654321", "F-2024-001", 1250.75, 3, InvoiceStatus.WARNING, "Duplicada respecto a lote anterior"),
                    ("B55667788", "F-2024-003", 890.20, -12, InvoiceStatus.VALID, "Factura vencida para seguimiento"),
                    ("A44556677", "MKT-2026-009", 16500.00, 24, InvoiceStatus.WARNING, "Falta IBAN maestro"),
                ],
            },
            {
                "name": "Remesa Junio Tension Caja",
                "created_days": 0,
                "payment_days": 20,
                "status": BatchStatus.GENERATED,
                "items": [
                    ("B22334455", "ENE-2026-014", 22000.00, 31, InvoiceStatus.VALID, "Pico de energia de verano"),
                    ("A11223344", "LOG-2026-014", 26000.00, 38, InvoiceStatus.WARNING, "Duplicada respecto a mayo"),
                    ("B87654321", "BIT-2026-031", 42000.00, 45, InvoiceStatus.VALID, "Renovacion infraestructura"),
                ],
            },
        ]

        for index, spec in enumerate(batch_specs, start=1):
            created_at = now + timedelta(days=spec["created_days"])
            payment_date = now + timedelta(days=spec["payment_days"])
            batch = Batch(
                name=spec["name"],
                created_at=created_at,
                payment_date=payment_date,
                status=spec["status"],
                uploaded_to_bank=spec["status"] == BatchStatus.SENT,
                file_hash=f"demo-batch-{index}",
            )
            db.add(batch)
            db.flush()

            for cif, factura, importe, due_offset, status, message in spec["items"]:
                provider = providers[cif]
                due_date = now + timedelta(days=due_offset)
                invoice = Invoice(
                    batch_id=batch.id,
                    cif=cif,
                    nombre=provider.name,
                    email=provider.email,
                    direccion=provider.address,
                    cp=provider.zip_code,
                    poblacion=provider.city,
                    pais=provider.country,
                    cuenta=provider.iban,
                    importe=importe,
                    factura=factura,
                    fecha_vencimiento=due_date,
                    fecha_aplazamiento=None,
                    status=status,
                    validation_message=message,
                )
                db.add(invoice)

        db.commit()
        print("Demo DB creada correctamente")
        print("Usuario: admin")
        print("Password: admin123")
        print(f"Base de datos: {database_url or 'DATABASE_URL por defecto'}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
