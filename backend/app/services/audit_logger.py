from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional, Dict, Any
from pydantic import BaseModel
from backend.app.models import TransactionAuditLog, AuditAction

class CancellationMetadataSchema(BaseModel):
    reason: str
    cancelled_by: UUID

class RescheduleMetadataSchema(BaseModel):
    proposed_by: UUID
    location: str
    date: str
    time: str

def log_transaction_event(
    db: Session,
    purchase_request_id: UUID,
    meeting_id: Optional[UUID],
    actor_id: Optional[UUID],
    action_type: AuditAction,
    old_status: Optional[str] = None,
    new_status: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> TransactionAuditLog:
    """
    Validates the structure of action-specific metadata and creates an immutable
    audit record in the database.
    """
    validated_metadata = metadata or {}

    # Run metadata structure validations
    if action_type == AuditAction.REQUEST_CANCELLED:
        if metadata:
            try:
                CancellationMetadataSchema(**metadata)
            except Exception as e:
                raise ValueError(f"Invalid cancellation metadata format: {e}")
        else:
            raise ValueError("Cancellation metadata is required for REQUEST_CANCELLED actions.")

    elif action_type == AuditAction.MEETING_RESCHEDULED:
        if metadata:
            try:
                RescheduleMetadataSchema(**metadata)
            except Exception as e:
                raise ValueError(f"Invalid reschedule metadata format: {e}")
        else:
            raise ValueError("Reschedule metadata is required for MEETING_RESCHEDULED actions.")

    # Create audit log entry
    log_entry = TransactionAuditLog(
        purchase_request_id=purchase_request_id,
        meeting_id=meeting_id,
        actor_id=actor_id,
        action_type=action_type,
        old_status=old_status,
        new_status=new_status,
        action_metadata=validated_metadata
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry
