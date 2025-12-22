import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

class EmailService:
    async def send_payment_notification(self, invoice, email_to: str, settings=None):
        """
        Sends an email notification using SMTP settings if available, otherwise simulates it.
        """
        subject = f"Aviso de Pago - Factura {invoice.factura}"
        body = f"""Hola {invoice.nombre},

Le informamos que se ha procesado el pago de su factura:
- Factura: {invoice.factura}
- Importe: {invoice.importe:,.2f} €
- Fecha Vencimiento: {invoice.fecha_vencimiento.strftime('%d/%m/%Y') if invoice.fecha_vencimiento else '-'}

El pago se realizará mediante Confirming Bankinter.

Atentamente,
Departamento Financiero
"""

        # Check for Real SMTP Config
        use_smtp = False
        if settings and settings.smtp_server and settings.smtp_user:
            use_smtp = True

        if use_smtp:
            try:
                msg = MIMEMultipart()
                msg['From'] = settings.smtp_from_email or settings.smtp_user
                msg['To'] = email_to
                msg['Subject'] = subject
                msg.attach(MIMEText(body, 'plain'))

                if int(settings.smtp_port) == 465:
                    server = smtplib.SMTP_SSL(settings.smtp_server, settings.smtp_port)
                else:
                    server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
                    server.starttls()
                
                server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(msg['From'], email_to, msg.as_string())
                server.quit()
                logger.info(f"SMTP Email sent to {email_to}")
                return True
            except Exception as e:
                logger.error(f"SMTP Error: {e}")
                raise e
        else:
            # Simulation Mode
            print(f"--- [EMAIL SIMULATION] ---")
            print(f"TO: {email_to}")
            print(f"SUBJECT: {subject}")
            print(f"SMTP Configured: No (using simulation)")
            logger.info(f"Simulated email sent to {email_to}")
            return True

email_service = EmailService()
