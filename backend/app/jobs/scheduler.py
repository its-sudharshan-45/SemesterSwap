from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone, timedelta
from typing import List
import re

from backend.app.models import (
    PurchaseRequest, Meeting, TransactionConfirmation, Listing, 
    Notification, NotificationType, AuditAction, User
)
from backend.app.services.audit_logger import log_transaction_event
from backend.app.services.notification_service import send_notification
from backend.app.validators.transaction_state_validator import validate_status_transition

def expire_pending_requests(db: Session) -> int:
    """
    Finds all PENDING purchase requests that have expired, transitions them to EXPIRED,
    reverts the listing status if appropriate, logs audit events, and sends notifications.
    """
    now = datetime.now(timezone.utc)
    expired_requests = db.query(PurchaseRequest).filter(
        PurchaseRequest.status == "PENDING",
        PurchaseRequest.expires_at <= now
    ).all()

    count = 0
    for req in expired_requests:
        old_status = req.status
        try:
            validate_status_transition(old_status, "EXPIRED")
        except Exception:
            continue

        req.status = "EXPIRED"
        if req.meeting:
            req.meeting.status = "CANCELLED"
            req.meeting.cancelled_at = now
            req.meeting.cancel_reason = "System Automatic Expiration"

        # Check for other pending requests on the same listing
        other_pending = db.query(PurchaseRequest).filter(
            PurchaseRequest.listing_id == req.listing_id,
            PurchaseRequest.status == "PENDING",
            PurchaseRequest.id != req.id
        ).first()

        if not other_pending and req.listing:
            req.listing.status = "available"

        # Create Audit Log for expiration (recorded as REQUEST_CANCELLED with expiration details)
        log_transaction_event(
            db=db,
            purchase_request_id=req.id,
            meeting_id=req.meeting.id if req.meeting else None,
            actor_id=None,
            action_type=AuditAction.REQUEST_CANCELLED,
            old_status=old_status,
            new_status="EXPIRED",
            metadata={
                "reason": "System Automatic Expiration",
                "cancelled_by": str(req.buyer_id)
            }
        )

        # Notify buyer
        send_notification(
            db=db,
            user_id=req.buyer_id,
            type=NotificationType.REQUEST_EXPIRED,
            title="Request Expired",
            message=f"Your purchase request for '{req.listing.title}' has expired."
        )

        # Notify seller
        send_notification(
            db=db,
            user_id=req.seller_id,
            type=NotificationType.REQUEST_EXPIRED,
            title="Request Proposal Expired",
            message=f"The swap proposal for '{req.listing.title}' has expired."
        )

        count += 1

    if count > 0:
        db.commit()
    return count

def process_no_shows(db: Session) -> int:
    """
    Detects scheduled meetings that have passed their confirmation deadline.
    Marks them as NO_SHOW, logs audit events, and penalizes the non-confirming user.
    """
    now = datetime.now(timezone.utc)
    # Find SCHEDULED meetings where confirmation_deadline has passed
    overdue_meetings = db.query(Meeting).join(PurchaseRequest).filter(
        Meeting.status == "SCHEDULED",
        Meeting.confirmation_deadline <= now
    ).all()

    count = 0
    for meeting in overdue_meetings:
        req = meeting.request
        if not req:
            continue

        conf = meeting.confirmation
        buyer_conf = conf.buyer_confirmed if conf else False
        seller_conf = conf.seller_confirmed if conf else False

        # If both confirmed, it shouldn't be here (it should be COMPLETED).
        # But if not completed yet, double check.
        if buyer_conf and seller_conf:
            continue

        meeting.status = "NO_SHOW"
        meeting.no_show_marked_at = now
        
        # Transition purchase request to CANCELLED
        old_req_status = req.status
        req.status = "CANCELLED"
        req.cancelled_at = now
        req.cancel_reason = "Meeting No-Show (Confirmation Deadline Expired)"

        if req.listing:
            req.listing.status = "available"

        # Determine responsible party/parties for the no-show
        no_show_parties = []
        if not buyer_conf:
            no_show_parties.append("buyer")
        if not seller_conf:
            no_show_parties.append("seller")

        # Create Audit Record
        log_transaction_event(
            db=db,
            purchase_request_id=req.id,
            meeting_id=meeting.id,
            actor_id=None,
            action_type=AuditAction.NO_SHOW_MARKED,
            old_status="SCHEDULED",
            new_status="NO_SHOW",
            metadata={
                "buyer_confirmed": buyer_conf,
                "seller_confirmed": seller_conf,
                "no_show_parties": no_show_parties
            }
        )

        # Notify users of no-show status
        send_notification(
            db=db,
            user_id=req.buyer_id,
            type=NotificationType.MEETING_CANCELLED,
            title="Meeting No-Show",
            message=f"The meeting for '{req.listing.title}' has been marked as a no-show due to missing confirmations."
        )
        send_notification(
            db=db,
            user_id=req.seller_id,
            type=NotificationType.MEETING_CANCELLED,
            title="Meeting No-Show",
            message=f"The meeting for '{req.listing.title}' has been marked as a no-show due to missing confirmations."
        )
        
        count += 1

    if count > 0:
        db.commit()
    return count

def send_transaction_reminders(db: Session) -> int:
    """
    Sends alerts before meeting times, before request expirations, and before confirmation deadlines.
    Guards against duplicates by checking the notifications log.
    """
    now = datetime.now(timezone.utc)
    sent_count = 0

    # 1. 24-hour expiration reminder for PENDING requests
    tomorrow = now + timedelta(days=1)
    expiring_requests = db.query(PurchaseRequest).filter(
        PurchaseRequest.status == "PENDING",
        PurchaseRequest.expires_at > now,
        PurchaseRequest.expires_at <= tomorrow
    ).all()

    for req in expiring_requests:
        # Check if reminder already sent
        marker = f"exp-rem-{req.id}"
        exists = db.query(Notification).filter(
            Notification.user_id == req.buyer_id,
            Notification.type == NotificationType.MEETING_REMINDER,
            Notification.message.like(f"%{marker}%")
        ).first()

        if not exists:
            msg = f"Your request for '{req.listing.title}' will expire soon. (Ref: {marker})"
            send_notification(db, req.buyer_id, NotificationType.MEETING_REMINDER, "Request Expiring Soon", msg)
            send_notification(db, req.seller_id, NotificationType.MEETING_REMINDER, "Swap Proposal Expiring Soon", msg)
            sent_count += 2

    # 2. 1-hour upcoming meeting reminder
    # Parse meeting datetime
    scheduled_meetings = db.query(Meeting).filter(Meeting.status == "SCHEDULED").all()
    for meeting in scheduled_meetings:
        req = meeting.request
        if not req:
            continue
        
        try:
            # Parse meeting date
            parts = meeting.time.split("-")
            start_time_str = parts[0].strip() if parts else ""
            match = re.search(r"(\d+):(\d+)\s*(AM|PM)", start_time_str, re.IGNORECASE)
            hour, minute = 12, 0
            if match:
                hour = int(match.group(1))
                minute = int(match.group(2))
                period = match.group(3).upper()
                if period == "PM" and hour < 12:
                    hour += 12
                elif period == "AM" and hour == 12:
                    hour = 0
            m_dt = datetime.strptime(meeting.date, "%Y-%m-%d").replace(
                hour=hour, minute=minute, second=0, microsecond=0, tzinfo=timezone.utc
            )
            
            # Check if meeting is in 1 hour
            time_to_meeting = m_dt - now
            if timedelta(minutes=0) <= time_to_meeting <= timedelta(minutes=65):
                marker = f"meet-rem-{meeting.id}"
                exists = db.query(Notification).filter(
                    Notification.user_id == req.buyer_id,
                    Notification.type == NotificationType.MEETING_REMINDER,
                    Notification.message.like(f"%{marker}%")
                ).first()

                if not exists:
                    msg = f"Your meeting for '{req.listing.title}' is starting soon at {meeting.location}. (Ref: {marker})"
                    send_notification(db, req.buyer_id, NotificationType.MEETING_REMINDER, "Upcoming Meeting", msg)
                    send_notification(db, req.seller_id, NotificationType.MEETING_REMINDER, "Upcoming Meeting", msg)
                    sent_count += 2
        except Exception:
            pass

    # 3. Confirmation deadline warning (12 hours before deadline)
    deadline_threshold = now + timedelta(hours=12)
    warning_meetings = db.query(Meeting).filter(
        Meeting.status == "SCHEDULED",
        Meeting.confirmation_deadline > now,
        Meeting.confirmation_deadline <= deadline_threshold
    ).all()

    for meeting in warning_meetings:
        req = meeting.request
        if not req:
            continue

        conf = meeting.confirmation
        buyer_conf = conf.buyer_confirmed if conf else False
        seller_conf = conf.seller_confirmed if conf else False

        marker = f"dead-rem-{meeting.id}"
        
        if not buyer_conf:
            exists = db.query(Notification).filter(
                Notification.user_id == req.buyer_id,
                Notification.type == NotificationType.NO_SHOW_WARNING,
                Notification.message.like(f"%{marker}%")
            ).first()
            if not exists:
                msg = f"Please confirm your swap for '{req.listing.title}'. Unconfirmed meetings result in a no-show penalty. (Ref: {marker})"
                send_notification(db, req.buyer_id, NotificationType.NO_SHOW_WARNING, "Confirm Your Swap", msg)
                sent_count += 1

        if not seller_conf:
            exists = db.query(Notification).filter(
                Notification.user_id == req.seller_id,
                Notification.type == NotificationType.NO_SHOW_WARNING,
                Notification.message.like(f"%{marker}%")
            ).first()
            if not exists:
                msg = f"Please confirm payment receipt for '{req.listing.title}'. Unconfirmed meetings result in a no-show penalty. (Ref: {marker})"
                send_notification(db, req.seller_id, NotificationType.NO_SHOW_WARNING, "Confirm Payment Receipt", msg)
                sent_count += 1

    if sent_count > 0:
        db.commit()
    return sent_count
