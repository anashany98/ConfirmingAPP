from app.database import SessionLocal
from app.models import Settings

db = SessionLocal()
settings = db.query(Settings).first()

if settings:
    print(f"SMTP Server: {settings.smtp_server}")
    print(f"SMTP Port: {settings.smtp_port}")
    print(f"SMTP User: {settings.smtp_user}")
    print(f"SMTP Pass: {settings.smtp_password[:3]}***") # Masked
    print(f"SMTP From: {settings.smtp_from_email}")
else:
    print("No settings found.")
