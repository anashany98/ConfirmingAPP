import asyncio
from app.database import SessionLocal
from app.models import Settings, Invoice
from app.services.email_service import email_service
from datetime import datetime

async def test():
    db = SessionLocal()
    settings = db.query(Settings).first()
    
    # Mock Invoice
    inv = Invoice(
        factura="TEST-001",
        nombre="Test Provider",
        importe=100.0,
        fecha_vencimiento=datetime.now()
    )
    
    print("Attempting to send email...")
    print(f"Server: {settings.smtp_server}:{settings.smtp_port}")
    print(f"User: {settings.smtp_user}")
    
    try:
        # Send to the SAME USER address as test
        to_email = settings.smtp_user 
        await email_service.send_payment_notification(inv, to_email, settings)
        print("SUCCESS: Email sent.")
    except Exception as e:
        print(f"FAILURE: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
