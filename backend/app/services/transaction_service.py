from sqlalchemy.orm import Session, joinedload
from uuid import UUID
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status, BackgroundTasks
from decimal import Decimal

from backend.app.models import (
    PurchaseRequest, Meeting, TransactionConfirmation, Listing, Notification, User,
    AuditAction, NotificationType
)
from backend.app.services.meeting_service import calculate_confirmation_deadline
from backend.app.services.audit_logger import log_transaction_event
from backend.app.services.security_logger import log_security_event
from backend.app.services.notification_service import send_notification
from backend.app.validators.transaction_state_validator import validate_status_transition

def accept_purchase_request(db: Session, request_id: UUID, seller_id: UUID) -> PurchaseRequest:
    # 1. Row-lock the purchase request
    request = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).with_for_update().first()
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found."
        )

    # Auth check: Must be the seller of this listing/request
    if request.seller_id != seller_id:
        log_security_event(db, seller_id, "UNAUTHORIZED_ACTION", f"User tried to accept order {request_id} owned by seller {request.seller_id}.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to accept this request."
        )

    # State validation
    old_status = request.status
    validate_status_transition(old_status, "ACCEPTED")

    # 2. Row-lock the listing to ensure concurrency safety
    listing = db.query(Listing).filter(Listing.id == request.listing_id).with_for_update().first()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found."
        )

    # Check if the listing is already reserved/sold
    if listing.status in ("reserved", "sold"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This listing has already been reserved or sold to another buyer."
        )

    # Update states
    request.status = "ACCEPTED"
    listing.status = "reserved"

    if request.meeting:
        request.meeting.status = "SCHEDULED"
        request.meeting.confirmation_deadline = calculate_confirmation_deadline(request.meeting.date, request.meeting.time)

    # Create Audit Log
    log_transaction_event(
        db=db,
        purchase_request_id=request.id,
        meeting_id=request.meeting.id if request.meeting else None,
        actor_id=seller_id,
        action_type=AuditAction.REQUEST_ACCEPTED,
        old_status=old_status,
        new_status="ACCEPTED",
        metadata={
            "accepted_by": str(seller_id),
            "confirmation_deadline": request.meeting.confirmation_deadline.isoformat() if request.meeting and request.meeting.confirmation_deadline else None
        }
    )

    # Notify buyer
    send_notification(
        db=db,
        user_id=request.buyer_id,
        type=NotificationType.REQUEST_ACCEPTED,
        title="Meeting Accepted",
        message=f"Seller has accepted your meeting swap request for '{listing.title}'."
    )
    db.commit()

    return db.query(PurchaseRequest).options(
        joinedload(PurchaseRequest.buyer),
        joinedload(PurchaseRequest.seller),
        joinedload(PurchaseRequest.listing),
        joinedload(PurchaseRequest.meeting).joinedload(Meeting.confirmation)
    ).filter(PurchaseRequest.id == request_id).first()


def reject_purchase_request(db: Session, request_id: UUID, user_id: UUID) -> PurchaseRequest:
    request = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found."
        )

    # Auth check
    if request.seller_id != user_id and request.buyer_id != user_id:
        log_security_event(db, user_id, "UNAUTHORIZED_ACTION", f"User tried to reject request {request_id}.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to cancel/reject this request."
        )

    old_status = request.status
    now = datetime.now(timezone.utc)

    if user_id == request.buyer_id:
        # Buyer cancels pending request
        validate_status_transition(old_status, "CANCELLED")
        request.status = "CANCELLED"
        request.cancelled_by = user_id
        request.cancelled_at = now
        request.cancel_reason = "Declined/Cancelled via legacy endpoint"
        
        # Log Audit Log
        log_transaction_event(
            db=db,
            purchase_request_id=request.id,
            meeting_id=request.meeting.id if request.meeting else None,
            actor_id=user_id,
            action_type=AuditAction.REQUEST_CANCELLED,
            old_status=old_status,
            new_status="CANCELLED",
            metadata={
                "reason": "Declined/Cancelled via legacy endpoint",
                "cancelled_by": str(user_id)
            }
        )

        recipient_id = request.seller_id
        notif_title = "Request Cancelled"
        notif_type = NotificationType.MEETING_CANCELLED
        notif_msg = f"The meeting request for '{request.listing.title}' was cancelled by the other student."
    else:
        # Seller rejects pending request
        validate_status_transition(old_status, "REJECTED")
        request.status = "REJECTED"
        request.cancelled_by = user_id
        request.cancelled_at = now
        request.cancel_reason = "Declined/Cancelled via legacy endpoint"

        # Log Audit Log
        log_transaction_event(
            db=db,
            purchase_request_id=request.id,
            meeting_id=request.meeting.id if request.meeting else None,
            actor_id=user_id,
            action_type=AuditAction.REQUEST_REJECTED,
            old_status=old_status,
            new_status="REJECTED",
            metadata={"rejected_by": str(user_id)}
        )

        recipient_id = request.buyer_id
        notif_title = "Request Declined"
        notif_type = NotificationType.REQUEST_REJECTED
        notif_msg = f"The meeting request for '{request.listing.title}' was declined by the seller."

    # Revert product to available
    if request.listing:
        request.listing.status = "available"

    # Cancel meeting status if exists
    if request.meeting:
        request.meeting.status = "CANCELLED"
        request.meeting.cancelled_by = user_id
        request.meeting.cancelled_at = now
        request.meeting.cancel_reason = "Declined/Cancelled via legacy endpoint"

    # Notify counterpart
    send_notification(
        db=db,
        user_id=recipient_id,
        type=notif_type,
        title=notif_title,
        message=notif_msg
    )
    db.commit()

    return db.query(PurchaseRequest).options(
        joinedload(PurchaseRequest.buyer),
        joinedload(PurchaseRequest.seller),
        joinedload(PurchaseRequest.listing),
        joinedload(PurchaseRequest.meeting).joinedload(Meeting.confirmation)
    ).filter(PurchaseRequest.id == request_id).first()


def cancel_purchase_request(db: Session, request_id: UUID, user_id: UUID, reason: str) -> PurchaseRequest:
    request = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found."
        )

    # Auth check
    if request.buyer_id != user_id and request.seller_id != user_id:
        log_security_event(db, user_id, "UNAUTHORIZED_ACTION", f"User tried to cancel transaction {request_id}.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to cancel this transaction."
        )

    if request.status == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a completed transaction."
        )

    # Rate limiting: Max 5 cancellations per week
    now = datetime.now(timezone.utc)
    one_week_ago = now - timedelta(days=7)
    weekly_cancellations = db.query(PurchaseRequest).filter(
        PurchaseRequest.cancelled_by == user_id,
        PurchaseRequest.cancelled_at >= one_week_ago
    ).count()
    if weekly_cancellations >= 5:
        log_security_event(db, user_id, "ABUSE_LIMIT_EXCEEDED", "User exceeded weekly cancellation limit.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account restricted: Maximum 5 cancellations per week exceeded."
        )

    # State validation
    old_status = request.status
    validate_status_transition(old_status, "CANCELLED")

    request.status = "CANCELLED"
    request.cancelled_by = user_id
    request.cancelled_at = now
    request.cancel_reason = reason

    if request.listing:
        # Check if there are other pending requests for the same listing
        other_pending = db.query(PurchaseRequest).filter(
            PurchaseRequest.listing_id == request.listing_id,
            PurchaseRequest.status == "PENDING",
            PurchaseRequest.id != request.id
        ).first()
        if not other_pending:
            request.listing.status = "available"
        else:
            request.listing.status = "REQUEST_PENDING"

    if request.meeting:
        request.meeting.status = "CANCELLED"
        request.meeting.cancelled_by = user_id
        request.meeting.cancelled_at = now
        request.meeting.cancel_reason = reason

    # Create Audit Record
    log_transaction_event(
        db=db,
        purchase_request_id=request.id,
        meeting_id=request.meeting.id if request.meeting else None,
        actor_id=user_id,
        action_type=AuditAction.REQUEST_CANCELLED,
        old_status=old_status,
        new_status="CANCELLED",
        metadata={
            "reason": reason,
            "cancelled_by": str(user_id)
        }
    )

    # Notify counterparty
    recipient_id = request.seller_id if user_id == request.buyer_id else request.buyer_id
    send_notification(
        db=db,
        user_id=recipient_id,
        type=NotificationType.MEETING_CANCELLED,
        title="Transaction Cancelled",
        message=f"The transaction for '{request.listing.title}' has been cancelled by the other user. Reason: {reason}"
    )
    db.commit()

    return db.query(PurchaseRequest).options(
        joinedload(PurchaseRequest.buyer),
        joinedload(PurchaseRequest.seller),
        joinedload(PurchaseRequest.listing),
        joinedload(PurchaseRequest.meeting).joinedload(Meeting.confirmation)
    ).filter(PurchaseRequest.id == request_id).first()


def complete_purchase_request(db: Session, request_id: UUID, user_id: UUID, background_tasks: BackgroundTasks) -> PurchaseRequest:
    request = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found."
        )

    # Authorization Check
    if request.buyer_id != user_id and request.seller_id != user_id:
        log_security_event(db, user_id, "UNAUTHORIZED_ACTION", f"User tried to complete order {request_id}.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to confirm completion."
        )

    if request.status != "ACCEPTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Swap request must be accepted before marking complete."
        )

    meeting = request.meeting
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No meeting associated with this request."
        )

    confirmation = meeting.confirmation
    if not confirmation:
        confirmation = TransactionConfirmation(meeting_id=meeting.id)
        db.add(confirmation)
        db.flush()

    # Enforce Role Boundaries: Buyer cannot confirm seller payment and vice versa
    if user_id == request.buyer_id:
        if confirmation.buyer_confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already confirmed product receipt."
            )
        confirmation.buyer_confirmed = True
        
        # Log Audit Log
        log_transaction_event(
            db=db,
            purchase_request_id=request.id,
            meeting_id=meeting.id,
            actor_id=user_id,
            action_type=AuditAction.BUYER_CONFIRMED,
            old_status="ACCEPTED",
            new_status="ACCEPTED",
            metadata={"buyer_id": str(user_id)}
        )
    else:
        if confirmation.seller_confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already confirmed payment receipt."
            )
        confirmation.seller_confirmed = True

        # Log Audit Log
        log_transaction_event(
            db=db,
            purchase_request_id=request.id,
            meeting_id=meeting.id,
            actor_id=user_id,
            action_type=AuditAction.SELLER_CONFIRMED,
            old_status="ACCEPTED",
            new_status="ACCEPTED",
            metadata={"seller_id": str(user_id)}
        )

    # If both confirmed, complete the request & listing
    if confirmation.buyer_confirmed and confirmation.seller_confirmed:
        old_status = request.status
        validate_status_transition(old_status, "COMPLETED")

        request.status = "COMPLETED"
        meeting.status = "COMPLETED"
        completed_time = datetime.now(timezone.utc)
        confirmation.completed_at = completed_time
        if request.listing:
            request.listing.status = "sold"

        # Update completed transaction count for both users
        buyer_user = db.query(User).filter(User.id == request.buyer_id).first()
        seller_user = db.query(User).filter(User.id == request.seller_id).first()
        if buyer_user:
            buyer_user.total_transactions += 1
        if seller_user:
            seller_user.total_transactions += 1

        # Create Completion Audit Record
        log_transaction_event(
            db=db,
            purchase_request_id=request.id,
            meeting_id=meeting.id,
            actor_id=None,
            action_type=AuditAction.COMPLETED,
            old_status=old_status,
            new_status="COMPLETED",
            metadata={"completed_at": completed_time.isoformat()}
        )

        # Notify both users
        send_notification(
            db=db,
            user_id=request.buyer_id,
            type=NotificationType.TRANSACTION_COMPLETED,
            title="Swap Completed",
            message=f"Your swap for '{request.listing.title}' has been successfully completed!"
        )
        send_notification(
            db=db,
            user_id=request.seller_id,
            type=NotificationType.TRANSACTION_COMPLETED,
            title="Product Sold",
            message=f"Congratulations! Your item '{request.listing.title}' has been marked sold."
        )

        # Send Greeting Message to Buyer's Mail
        from backend.app.services.notification_service import NotificationService
        NotificationService.notify_transaction_completed(db, request.id, background_tasks)

    db.commit()

    return db.query(PurchaseRequest).options(
        joinedload(PurchaseRequest.buyer),
        joinedload(PurchaseRequest.seller),
        joinedload(PurchaseRequest.listing),
        joinedload(PurchaseRequest.meeting).joinedload(Meeting.confirmation)
    ).filter(PurchaseRequest.id == request_id).first()
