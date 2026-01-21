from app.database import SessionLocal
from app.routers.reports_router import get_monthly_pdf
import traceback

db = SessionLocal()

print("Calling get_monthly_pdf directly...")
try:
    # month=12, year=2025
    response = get_monthly_pdf(month=12, year=2025, db=db)
    print("Success!")
    print(f"Response: {response}")
except Exception:
    print("CRASHED:")
    traceback.print_exc()
