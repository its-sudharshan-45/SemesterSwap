from sqlalchemy.orm import Session, joinedload
from uuid import UUID
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status

from backend.app.models import (
    PurchaseRequest, Meeting, TransactionConfirmation, Listing, User,
    AuditAction, NotificationType
)
from backend.app.schemas import OrderCreatePayload
from backend.app.services.security_logger import log_security_event
from backend.app.services.audit_logger import log_transaction_event
from backend.app.services.notification_service import send_notification

def check_user_limits(db: Session, user_id: UUID):
    """
    Checks rate limits and abuse prevention rules:
    - Max 10 purchase requests per day.
    - Max 5 cancellations per week.
    """
    now = datetime.now(timezone.utc)
    one_day_ago = now - timedelta(days=1)
    one_week_ago = now - timedelta(days=7)

    # 1. Rate limiting on purchase requests (10 per day)
    daily_requests = db.query(PurchaseRequest).filter(
        PurchaseRequest.buyer_id == user_id,
        PurchaseRequest.created_at >= one_day_ago
    ).count()
    if daily_requests >= 10:
        log_security_event(db, user_id, "RATE_LIMIT_EXCEEDED", "User exceeded 10 daily purchase requests.")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded: Maximum 10 purchase requests per day."
        )

    # 2. Abuse detection: Excessive cancellations (5 per week)
    weekly_cancellations = db.query(PurchaseRequest).filter(
        PurchaseRequest.cancelled_by == user_id,
        PurchaseRequest.cancelled_at >= one_week_ago
    ).count()
    if weekly_cancellations >= 5:
        log_security_event(db, user_id, "ABUSE_LIMIT_EXCEEDED", "User exceeded 5 weekly cancellations.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account restricted: Maximum 5 cancellations per week exceeded."
        )

def create_purchase_request(db: Session, buyer_id: UUID, payload: OrderCreatePayload) -> PurchaseRequest:
    # Check rate limits & restrictions
    check_user_limits(db, buyer_id)

    # Start transaction with row locking on the Listing to prevent race conditions
    listing = db.query(Listing).filter(Listing.id == payload.product_id).with_for_update().first()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found."
        )

    if listing.status not in ("available", "REQUEST_PENDING"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This listing is no longer available."
        )

    if listing.seller_id == buyer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot purchase your own listing."
        )

    existing_request = db.query(PurchaseRequest).filter(
        PurchaseRequest.listing_id == listing.id,
        PurchaseRequest.buyer_id == buyer_id,
        PurchaseRequest.status == "PENDING"
    ).first()
    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending request for this listing."
        )

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7)

    # Create PurchaseRequest
    request = PurchaseRequest(
        listing_id=listing.id,
        buyer_id=buyer_id,
        seller_id=listing.seller_id,
        status="PENDING",
        expires_at=expires_at
    )
    db.add(request)
    db.flush()

    # Create Meeting in PROPOSED stage
    meeting = Meeting(
        request_id=request.id,
        location=payload.meeting_location,
        date=payload.meeting_date,
        time=payload.meeting_time,
        payment_method=payload.payment_method,
        status="PROPOSED"
    )
    db.add(meeting)
    db.flush()

    # Create TransactionConfirmation
    confirmation = TransactionConfirmation(
        meeting_id=meeting.id,
        buyer_confirmed=False,
        seller_confirmed=False
    )
    db.add(confirmation)

    # Update listing status to REQUEST_PENDING
    listing.status = "REQUEST_PENDING"

    # Create Audit Log for Request Creation
    log_transaction_event(
        db=db,
        purchase_request_id=request.id,
        meeting_id=meeting.id,
        actor_id=buyer_id,
        action_type=AuditAction.REQUEST_CREATED,
        old_status=None,
        new_status="PENDING",
        metadata={
            "product_id": str(listing.id),
            "payment_method": payload.payment_method,
            "meeting_location": payload.meeting_location
        }
    )

    # Add notifications using service
    send_notification(
        db=db,
        user_id=request.buyer_id,
        type=NotificationType.NEW_REQUEST,
        title="Meeting Request Sent",
        message=f"Your meeting request for '{listing.title}' has been successfully sent. It will expire in 7 days."
    )
    send_notification(
        db=db,
        user_id=request.seller_id,
        type=NotificationType.NEW_REQUEST,
        title="New Meeting Request",
        message=f"A student has proposed a meeting swap for '{listing.title}'."
    )

    db.commit()

    # Return with relations loaded
    return db.query(PurchaseRequest).options(
        joinedload(PurchaseRequest.buyer),
        joinedload(PurchaseRequest.seller),
        joinedload(PurchaseRequest.listing),
        joinedload(PurchaseRequest.meeting).joinedload(Meeting.confirmation)
    ).filter(PurchaseRequest.id == request.id).first()

def expire_old_purchase_requests(db: Session) -> int:
    """
    Delegates cleanup checks to scheduler jobs for unified auditing, validation, and alerts.
    """
    from backend.app.jobs.scheduler import expire_pending_requests, process_no_shows
    process_no_shows(db)
    return expire_pending_requests(db)
