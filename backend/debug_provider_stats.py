from app.database import SessionLocal
from app.models import Invoice, Provider
from sqlalchemy import func

db = SessionLocal()

# Target CIF from known batch
target_cif = "A03257177" 

print(f"Checking stats for CIF: '{target_cif}'")

# Check Invoices
invoices = db.query(Invoice).filter(Invoice.cif == target_cif).all()
print(f"Found {len(invoices)} invoices.")
for inv in invoices:
    print(f" - ID: {inv.id}, Importe: {inv.importe}, CIF: '{inv.cif}'")

# Check Stats Query
stats = db.query(
    func.sum(Invoice.importe),
    func.count(Invoice.id),
    func.avg(Invoice.importe)
).filter(Invoice.cif == target_cif).first()

print(f"Stats Result: {stats}")
