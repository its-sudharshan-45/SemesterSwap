from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional
from backend.app.models import SecurityEvent

def log_security_event(
    db: Session,
    user_id: Optional[UUID],
    event_type: str,
    description: str
) -> SecurityEvent:
    """
    Persists security warnings, abuse detection limits, and unauthorized access attempts.
    """
    event = SecurityEvent(
        user_id=user_id,
        event_type=event_type,
        description=description
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
