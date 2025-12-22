from app.services.pdf_service import generate_monthly_report_pdf
import io

stats = {
    "month": "Diciembre",
    "year": 2025,
    "total_amount": 0.0,
    "total_invoices": 0,
    "active_providers": 0,
    "top_providers": [],
    "weekly_breakdown": [ { "week": "Semana 1", "amount": 0.0 } ]
}

try:
    print("Generating Empty PDF...")
    pdf_bytes = generate_monthly_report_pdf(stats)
    print(f"Empty PDF Generated successfully. Size: {len(pdf_bytes)} bytes")
except Exception as e:
    print(f"FAILED Empty: {e}")
    import traceback
    traceback.print_exc()

# Also test fully empty breakdown?
stats['weekly_breakdown'] = []
try:
    print("Generating Zero Weeks PDF...")
    pdf_bytes = generate_monthly_report_pdf(stats)
    print(f"Zero Weeks PDF Generated successfully.")
except Exception as e:
    print(f"FAILED Zero Weeks: {e}")
    traceback.print_exc()
