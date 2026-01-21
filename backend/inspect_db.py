from app.database import SessionLocal
from app.models import Batch

db = SessionLocal()
batch = db.query(Batch).order_by(Batch.id.desc()).first()

if batch:
    print(f"Latest Batch ID: {batch.id}, Name: {batch.name}")
    print(f"Invoices count: {len(batch.invoices)}")
    for inv in batch.invoices:
        print(f" - ID: {inv.id}, CIF: {inv.cif}, Name: '{inv.nombre}', Email: '{inv.email}'")
else:
    print("No batches found.")
