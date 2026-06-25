from sqlalchemy.orm import Session, joinedload
from uuid import UUID
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status
import re

from backend.app.models import (
    PurchaseRequest, Meeting, Notification, NotificationType, AuditAction
)
from backend.app.services.audit_logger import log_transaction_event
from backend.app.services.notification_service import send_notification
from backend.app.validators.transaction_state_validator import validate_status_transition

def calculate_confirmation_deadline(date_str: str, time_str: str) -> datetime:
    """
    Parses meeting end time and returns deadline = end time + 24 hours in UTC.
    """
    try:
        parts = time_str.split("-")
        end_time_str = parts[-1].strip() if parts else ""
        match = re.search(r"(\d+):(\d+)\s*(AM|PM)", end_time_str, re.IGNORECASE)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2))
            period = match.group(3).upper()
            if period == "PM" and hour < 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0
        else:
            hour, minute = 12, 0
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        meeting_end = dt.replace(hour=hour, minute=minute, second=0, microsecond=0, tzinfo=timezone.utc)
        return meeting_end + timedelta(hours=24)
    except Exception:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.replace(tzinfo=timezone.utc) + timedelta(hours=36)

def reschedule_meeting(
    db: Session, 
    request_id: UUID, 
    user_id: UUID, 
    location: str, 
    date: str, 
    time: str
) -> PurchaseRequest:
    request = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found."
        )

    # Buyer or seller authorization
    if request.buyer_id != user_id and request.seller_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to reschedule this meeting."
        )

    if request.status in ("COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reschedule meeting for a request in status '{request.status}'."
        )

    meeting = request.meeting
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No meeting associated with this request."
        )

    old_location = meeting.location
    old_date = meeting.date
    old_time = meeting.time

    # Reset meeting status to PROPOSED
    meeting.status = "PROPOSED"
    meeting.location = location
    meeting.date = date
    meeting.time = time
    
    # Reset completion confirmation flags
    if meeting.confirmation:
        meeting.confirmation.buyer_confirmed = False
        meeting.confirmation.seller_confirmed = False
        meeting.confirmation.completed_at = None

    # Log audit event for reschedule proposal
    log_transaction_event(
        db=db,
        purchase_request_id=request.id,
        meeting_id=meeting.id,
        actor_id=user_id,
        action_type=AuditAction.MEETING_RESCHEDULED,
        old_status="SCHEDULED",
        new_status="PROPOSED",
        metadata={
            "proposed_by": str(user_id),
            "location": location,
            "date": date,
            "time": time
        }
    )

    # Notify counterparty
    recipient_id = request.seller_id if user_id == request.buyer_id else request.buyer_id
    send_notification(
        db=db,
        user_id=recipient_id,
        type=NotificationType.MEETING_REMINDER,
        title="Meeting Reschedule Proposed",
        message=f"A counter-proposal has been made for the swap meeting of '{request.listing.title}' to {location} on {date} ({time})."
    )
    
    db.commit()

    return db.query(PurchaseRequest).options(
        joinedload(PurchaseRequest.buyer),
        joinedload(PurchaseRequest.seller),
        joinedload(PurchaseRequest.listing),
        joinedload(PurchaseRequest.meeting).joinedload(Meeting.confirmation)
    ).filter(PurchaseRequest.id == request_id).first()


def accept_reschedule(db: Session, request_id: UUID, user_id: UUID) -> PurchaseRequest:
    request = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found."
        )

    if request.buyer_id != user_id and request.seller_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to accept this rescheduling."
        )

    meeting = request.meeting
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No meeting associated with this request."
        )

    if meeting.status != "PROPOSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meeting is not in PROPOSED stage."
        )

    # Accept the rescheduling proposal
    meeting.status = "SCHEDULED"
    meeting.confirmation_deadline = calculate_confirmation_deadline(meeting.date, meeting.time)
    
    # If the purchase request status is not ACCEPTED yet, update it
    old_status = request.status
    if old_status == "PENDING":
        validate_status_transition(old_status, "ACCEPTED")
        request.status = "ACCEPTED"
        if request.listing:
            request.listing.status = "reserved"

    # Log audit event for reschedule acceptance
    log_transaction_event(
        db=db,
        purchase_request_id=request.id,
        meeting_id=meeting.id,
        actor_id=user_id,
        action_type=AuditAction.REQUEST_ACCEPTED,
        old_status=old_status,
        new_status=request.status,
        metadata={
            "accepted_by": str(user_id),
            "location": meeting.location,
            "date": meeting.date,
            "time": meeting.time
        }
    )

    # Notify counterparty
    recipient_id = request.seller_id if user_id == request.buyer_id else request.buyer_id
    send_notification(
        db=db,
        user_id=recipient_id,
        type=NotificationType.REQUEST_ACCEPTED,
        title="Meeting Proposal Accepted",
        message=f"The proposed swap coordinates for '{request.listing.title}' have been accepted."
    )
    
    db.commit()

    return db.query(PurchaseRequest).options(
        joinedload(PurchaseRequest.buyer),
        joinedload(PurchaseRequest.seller),
        joinedload(PurchaseRequest.listing),
        joinedload(PurchaseRequest.meeting).joinedload(Meeting.confirmation)
    ).filter(PurchaseRequest.id == request_id).first()
