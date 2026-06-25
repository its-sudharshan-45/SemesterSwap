import os
import html
import logging
import httpx
from datetime import datetime, timezone
from uuid import UUID
from typing import Dict, Any, Optional

from backend.app.config import settings
from backend.app.models import EmailNotification, EmailNotificationType
from backend.app.database import SessionLocal

logger = logging.getLogger("uvicorn.error")

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")


def get_template(template_name: str) -> str:
    """Reads HTML email template content."""
    path = os.path.join(TEMPLATES_DIR, template_name)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def sanitize_and_escape(data: Dict[str, Any]) -> Dict[str, str]:
    """Escapes HTML special characters to prevent script injection in emails."""
    escaped = {}
    for k, v in data.items():
        if isinstance(v, str):
            escaped[k] = html.escape(v)
        else:
            escaped[k] = str(v)
    return escaped


def send_resend_email(
    user_id: UUID,
    recipient_email: str,
    notification_type: EmailNotificationType,
    subject: str,
    template_name: str,
    template_data: Dict[str, Any],
    context_metadata: Optional[Dict[str, Any]] = None
):
    """
    Sends email via Resend API and logs status to the database.
    Runs inside a background task, handles all exceptions, and never raises them to the caller.
    """
    # 1. Prevent email header injection by stripping newlines
    clean_recipient = recipient_email.replace("\n", "").replace("\r", "").strip()
    clean_subject = subject.replace("\n", "").replace("\r", "").strip()

    # Apply email override if configured (useful for sandbox/dev testing)
    if settings.EMAIL_OVERRIDE:
        recipient_to_send = settings.EMAIL_OVERRIDE.strip()
        clean_subject = f"[Dev-To: {clean_recipient}] {clean_subject}"
    else:
        recipient_to_send = clean_recipient


    db = SessionLocal()
    email_log: Optional[EmailNotification] = None
    try:
        # 2. Log EmailNotification as PENDING
        email_log = EmailNotification(
            user_id=user_id,
            notification_type=notification_type,
            recipient_email=clean_recipient,
            provider="RESEND",
            status="PENDING",
            context_metadata=context_metadata,
            retry_count=0
        )
        db.add(email_log)
        db.commit()
        db.refresh(email_log)
        # Sanitize template data
        escaped_data = sanitize_and_escape(template_data)
        # Inject FRONTEND_URL
        escaped_data["FRONTEND_URL"] = settings.FRONTEND_URL
        
        # Build HTML content
        html_template = get_template(template_name)
        
        # Use regex to format placeholders safely without using python's .format() 
        # which conflicts with CSS curly braces
        import re
        pattern = re.compile(r'\{([a-zA-Z0-9_]+)\}')
        html_content = pattern.sub(lambda m: escaped_data.get(m.group(1), m.group(0)), html_template)

        # Check provider type
        if settings.EMAIL_PROVIDER.upper() == "SMTP":
            if not settings.SMTP_HOST:
                raise ValueError("SMTP_HOST is not configured.")
            
            # Set Email sender details (use SMTP_USER or EMAIL_FROM)
            email_from = settings.EMAIL_FROM
            if not email_from or "noreply@yourdomain.com" in email_from:
                email_from = settings.SMTP_USER or "noreply@yourdomain.com"

            # Update last attempt timestamp and increment retry count
            now = datetime.now(timezone.utc)
            email_log.last_attempt_at = now
            email_log.retry_count += 1
            db.commit()

            # Construct MIME message
            import smtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText

            msg = MIMEMultipart("alternative")
            msg["Subject"] = clean_subject
            msg["From"] = email_from
            msg["To"] = recipient_to_send

            msg.attach(MIMEText(html_content, "html"))

            # Send via SMTP
            if settings.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10.0)
            else:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10.0)
                if settings.SMTP_USE_TLS:
                    server.starttls()
            
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

            server.sendmail(settings.SMTP_USER or email_from, [recipient_to_send], msg.as_string())
            server.quit()

            # Update database status to SENT
            email_log.status = "SENT"
            email_log.provider = "SMTP"
            db.commit()

        else:
            # Check API key configuration
            if not settings.RESEND_API_KEY:
                raise ValueError("Resend API key is not configured (RESEND_API_KEY).")

            # Set Email sender details (fallback to Resend verified test email if default is empty/unconfigured)
            email_from = settings.EMAIL_FROM
            if not email_from or "noreply@yourdomain.com" in email_from:
                email_from = "SemesterSwap <onboarding@resend.dev>"

            headers = {
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "from": email_from,
                "to": [recipient_to_send],
                "subject": clean_subject,
                "html": html_content
            }

            # Update last attempt timestamp and increment retry count
            now = datetime.now(timezone.utc)
            email_log.last_attempt_at = now
            email_log.retry_count += 1
            db.commit()

            # Send HTTP POST request to Resend API
            with httpx.Client(timeout=10.0) as client:
                response = client.post("https://api.resend.com/emails", json=payload, headers=headers)
                
                if response.status_code >= 400:
                    raise httpx.HTTPStatusError(
                        f"Resend API error status {response.status_code}: {response.text}",
                        request=response.request,
                        response=response
                    )
                
                res_data = response.json()
                provider_message_id = res_data.get("id")

                # Update database status to SENT
                email_log.status = "SENT"
                email_log.provider = "RESEND"
                email_log.provider_message_id = provider_message_id
                db.commit()

    except Exception as e:
        error_msg = str(e)
        now = datetime.now(timezone.utc)
        
        # Rollback and update database status to FAILED if possible
        try:
            db.rollback()
            if email_log:
                email_log.status = "FAILED"
                email_log.error_message = error_msg
                email_log.last_attempt_at = now
                db.commit()
        except Exception as db_err:
            logger.error(f"[EmailService] Failed to record email failure in db: {db_err}")

        # Print formatted error logs as requested
        print("\n========================================")
        print("Email Delivery Failed")
        print(f"Recipient:\n{clean_recipient}")
        print(f"Type:\n{notification_type}")
        print(f"Error:\n{error_msg}")
        print("========================================\n")
        logger.error(f"[EmailService] Failed to send {notification_type} email to {clean_recipient}: {error_msg}")

    finally:
        db.close()
