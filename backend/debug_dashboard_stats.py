from app.database import SessionLocal
from app.models import Invoice, Batch
from sqlalchemy import func
from datetime import datetime, timedelta

db = SessionLocal()

print("--- Debugging Dashboard Stats ---")

# 1. Check Total Amount Sum
total_amount = db.query(func.sum(Invoice.importe)).scalar()
print(f"Total Amount in DB: {total_amount}")

# 2. Check Monthly Volume Logic
six_months_ago = datetime.utcnow() - timedelta(days=180)
print(f"Six Months Ago: {six_months_ago}")

results = db.query(
    Batch.created_at, 
    func.sum(Invoice.importe)
).join(Invoice).filter(
    Batch.created_at >= six_months_ago
).group_by(Batch.created_at).all()

print(f"Raw Results (Count: {len(results)}):")
for row in results:
    print(f" - Date: {row[0]}, Sum: {row[1]}")

# Simulate Python Aggregation
monthly_map = {}
current = datetime.utcnow()
for i in range(5, -1, -1):
    d = current - timedelta(days=i*30)
    key = d.strftime("%Y-%m")
    monthly_map[key] = {"amount": 0.0}

print(f"Initialized Keys: {list(monthly_map.keys())}")

for created_at, amount in results:
    if not created_at: continue
    key = created_at.strftime("%Y-%m")
    if key in monthly_map and amount:
        print(f"   -> Mapping {amount} to {key}")
        monthly_map[key]["amount"] += amount

print("Final Monthly Map:")
for k, v in monthly_map.items():
    print(f" {k}: {v['amount']}")

# 3. Check Cash Flow Projection
print("\n--- Cash Flow Projection ---")
today_date = datetime.now().date()
print(f"Today: {today_date}")

for i in range(4):
    start_range = today_date + timedelta(days=i*7)
    end_range = start_range + timedelta(days=6)
    
    print(f"Week {i+1}: {start_range} -> {end_range}")
    
    week_total = db.query(func.sum(Invoice.importe)).filter(
        Invoice.fecha_vencimiento >= start_range,
        Invoice.fecha_vencimiento <= end_range
    ).scalar() or 0.0
    
    print(f"   Sum: {week_total}")
    
    # Check if Invoice exists in range
    inv = db.query(Invoice).filter(
        Invoice.fecha_vencimiento >= start_range,
        Invoice.fecha_vencimiento <= end_range
    ).first()
    if inv:
        print(f"   Found Invoice: ID {inv.id}, Date: {inv.fecha_vencimiento}")
