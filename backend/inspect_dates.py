from app.database import SessionLocal
from app.models import Batch, Invoice

db = SessionLocal()
batches = db.query(Batch).order_by(Batch.id.desc()).limit(5).all()

print(f"Checking last 5 batches...")
for batch in batches:
    payment_date = batch.payment_date
    print(f"\nBatch ID: {batch.id}, Name: {batch.name}")
    print(f"Batch Payment Date (Global): {payment_date}")
    
    invoices = batch.invoices
    if invoices:
        print(f"Invoices ({len(invoices)}):")
        for inv in invoices[:3]: # check first 3
            print(f" - ID: {inv.id}, CIF: {inv.cif}, Vencimiento: {inv.fecha_vencimiento}")
        if len(invoices) > 3:
            print(" ...")
    else:
        print(" No invoices.")
