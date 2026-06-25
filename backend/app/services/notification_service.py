import logging
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import BackgroundTasks

from backend.app.models import (
    Notification, NotificationType, User, PurchaseRequest, Message,
    EmailNotification, EmailNotificationType
)
from backend.app.services.email_service import send_resend_email

logger = logging.getLogger("uvicorn.error")


def send_notification(
    db: Session,
    user_id: UUID,
    type: NotificationType,
    title: str,
    message: str
) -> Notification:
    """
    Creates and records a user notification with type validation (in-app database notification).
    """
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        is_read=False,
        read_at=None
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def mark_notification_as_read(db: Session, notification_id: UUID) -> Optional[Notification]:
    """
    Marks a notification as read and records the read_at timestamp.
    """
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if notification:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
    return notification


# --- Future-Ready Preference Check Hook ---
def check_user_notification_preference(user: User, preference_key: str) -> bool:
    """
    Placeholder checks for future UI-managed notification preferences.
    Currently defaults to True (enabled) for all notification preferences.
    Supports preferences keys like: "email_meeting_requests", "email_chat_messages".
    """
    return True


# --- Centralized Notification Service Abstraction ---
class NotificationService:
    @staticmethod
    def notify_meeting_request(db: Session, request_id: UUID, background_tasks: BackgroundTasks, message: Optional[str] = None):
        """
        Coordinates in-app notification and email dispatch when buyer requests swap meeting.
        """
        request = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
        if not request:
            logger.error(f"[NotificationService] Request {request_id} not found.")
            return

        seller = db.query(User).filter(User.id == request.seller_id).first()
        buyer = db.query(User).filter(User.id == request.buyer_id).first()
        if not seller or not buyer:
            return

        # Security Check: Verify recipient user exists and is APPROVED
        if seller.verification_status != "APPROVED":
            logger.info(f"[NotificationService] Skip email for seller {seller.id} (not APPROVED)")
            return

        # Check Preference
        if not check_user_notification_preference(seller, "email_meeting_requests"):
            return

        meeting = request.meeting
        if not meeting:
            return

        template_data = {
            "sellerName": seller.full_name or "Seller",
            "buyerName": buyer.full_name or "Buyer",
            "buyerEmail": buyer.email,
            "productName": request.listing.title if request.listing else "Listing",
            "date": meeting.date,
            "timeSlot": meeting.time,
            "location": meeting.location,
            "paymentMethod": meeting.payment_method,
            "message": message or "No custom message provided.",
            "meetingId": str(meeting.id)
        }

        background_tasks.add_task(
            send_resend_email,
            user_id=seller.id,
            recipient_email=seller.email,
            notification_type=EmailNotificationType.MEETING_REQUEST,
            subject=f"New Swap Meeting Request from {buyer.email} for Your Listing",
            template_name="meeting_request.html",
            template_data=template_data,
            context_metadata={"meeting_id": str(meeting.id), "request_id": str(request_id)}
        )

    @staticmethod
    def notify_meeting_accepted(db: Session, request_id: UUID, background_tasks: BackgroundTasks):
        """
        Coordinates email notification to the buyer when seller accepts meeting request.
        """
        request = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
        if not request:
            return

        buyer = db.query(User).filter(User.id == request.buyer_id).first()
        if not buyer or buyer.verification_status != "APPROVED":
            logger.info(f"[NotificationService] Skip email for buyer {buyer.id if buyer else 'None'} (not APPROVED)")
            return

        if not check_user_notification_preference(buyer, "email_meeting_requests"):
            return

        meeting = request.meeting
        if not meeting:
            return

        seller = db.query(User).filter(User.id == request.seller_id).first()
        seller_name = seller.full_name if seller else "Seller"
        seller_email = seller.email if seller else "unknown"

        template_data = {
            "buyerName": buyer.full_name or "Buyer",
            "sellerName": seller_name,
            "sellerEmail": seller_email,
            "productName": request.listing.title if request.listing else "Listing",
            "date": meeting.date,
            "timeSlot": meeting.time,
            "location": meeting.location,
            "meetingId": str(meeting.id)
        }

        background_tasks.add_task(
            send_resend_email,
            user_id=buyer.id,
            recipient_email=buyer.email,
            notification_type=EmailNotificationType.MEETING_ACCEPTED,
            subject=f"Your Swap Meeting Request Was Accepted by {seller_email}",
            template_name="meeting_accepted.html",
            template_data=template_data,
            context_metadata={"meeting_id": str(meeting.id), "request_id": str(request_id)}
        )

    @staticmethod
    def notify_meeting_rejected(db: Session, request_id: UUID, background_tasks: BackgroundTasks):
        """
        Coordinates email notification to the buyer when seller declines meeting request.
        """
        request = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
        if not request:
            return

        buyer = db.query(User).filter(User.id == request.buyer_id).first()
        if not buyer or buyer.verification_status != "APPROVED":
            logger.info(f"[NotificationService] Skip email for buyer {buyer.id if buyer else 'None'} (not APPROVED)")
            return

        if not check_user_notification_preference(buyer, "email_meeting_requests"):
            return

        seller = db.query(User).filter(User.id == request.seller_id).first()
        seller_name = seller.full_name if seller else "Seller"
        seller_email = seller.email if seller else "unknown"

        template_data = {
            "buyerName": buyer.full_name or "Buyer",
            "sellerName": seller_name,
            "sellerEmail": seller_email,
            "productName": request.listing.title if request.listing else "Listing",
            "productId": str(request.listing_id)
        }

        background_tasks.add_task(
            send_resend_email,
            user_id=buyer.id,
            recipient_email=buyer.email,
            notification_type=EmailNotificationType.MEETING_REJECTED,
            subject=f"Your Swap Meeting Request Was Declined by {seller_email}",
            template_name="meeting_rejected.html",
            template_data=template_data,
            context_metadata={"request_id": str(request_id)}
        )

    @staticmethod
    def notify_meeting_rescheduled(db: Session, request_id: UUID, sender_id: UUID, background_tasks: BackgroundTasks):
        """
        Coordinates email notification to the counterparty when a meeting reschedule is proposed.
        """
        request = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
        if not request:
            return

        # Determine who is the proposer and who is the recipient
        if sender_id == request.seller_id:
            recipient = db.query(User).filter(User.id == request.buyer_id).first()
            sender = db.query(User).filter(User.id == request.seller_id).first()
            recipient_role = "buyer"
            sender_role = "Seller"
        else:
            recipient = db.query(User).filter(User.id == request.seller_id).first()
            sender = db.query(User).filter(User.id == request.buyer_id).first()
            recipient_role = "seller"
            sender_role = "Buyer"

        if not recipient or recipient.verification_status != "APPROVED":
            logger.info(f"[NotificationService] Skip email for {recipient_role} (not APPROVED)")
            return

        if not check_user_notification_preference(recipient, "email_meeting_requests"):
            return

        meeting = request.meeting
        if not meeting:
            return

        sender_name = sender.full_name if sender else sender_role
        sender_email = sender.email if sender else "unknown"

        template_data = {
            "buyerName": recipient.full_name or recipient_role.capitalize(),
            "sellerName": sender_name,
            "sellerEmail": sender_email,
            "productName": request.listing.title if request.listing else "Listing",
            "date": meeting.date,
            "timeSlot": meeting.time,
            "location": meeting.location,
            "meetingId": str(request.id)
        }

        background_tasks.add_task(
            send_resend_email,
            user_id=recipient.id,
            recipient_email=recipient.email,
            notification_type=EmailNotificationType.MEETING_RESCHEDULED,
            subject=f"Meeting Reschedule Proposed by {sender_role} ({sender_email})",
            template_name="meeting_rescheduled.html",
            template_data=template_data,
            context_metadata={"meeting_id": str(meeting.id), "request_id": str(request_id)}
        )

    @staticmethod
    def notify_meeting_cancelled(db: Session, request_id: UUID, background_tasks: BackgroundTasks, reason: Optional[str] = None):
        """
        Coordinates email notification to the seller when buyer cancels/withdraws their swap request.
        """
        request = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
        if not request:
            return

        seller = db.query(User).filter(User.id == request.seller_id).first()
        if not seller or seller.verification_status != "APPROVED":
            logger.info(f"[NotificationService] Skip email for seller {seller.id if seller else 'None'} (not APPROVED)")
            return

        if not check_user_notification_preference(seller, "email_meeting_requests"):
            return

        buyer = db.query(User).filter(User.id == request.buyer_id).first()
        buyer_name = buyer.full_name if buyer else "Buyer"
        buyer_email = buyer.email if buyer else "unknown"

        template_data = {
            "sellerName": seller.full_name or "Seller",
            "buyerName": buyer_name,
            "buyerEmail": buyer_email,
            "productName": request.listing.title if request.listing else "Listing",
            "productId": str(request.listing_id),
            "reason": reason or "No reason provided."
        }

        background_tasks.add_task(
            send_resend_email,
            user_id=seller.id,
            recipient_email=seller.email,
            notification_type=EmailNotificationType.MEETING_CANCELLED,
            subject=f"Swap Request Withdrawn by Buyer ({buyer_email})",
            template_name="meeting_cancelled.html",
            template_data=template_data,
            context_metadata={"request_id": str(request_id)}
        )

    @staticmethod
    def notify_chat_message(db: Session, message_id: UUID, background_tasks: BackgroundTasks):
        """
        Coordinates email notification to message recipient, with 5-minute cooldown.
        """
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            return

        conversation = message.conversation
        if not conversation:
            return

        recipient_id = conversation.seller_id if message.sender_id == conversation.buyer_id else conversation.buyer_id
        recipient = db.query(User).filter(User.id == recipient_id).first()
        if not recipient or recipient.verification_status != "APPROVED":
            logger.info(f"[NotificationService] Skip email for recipient {recipient_id} (not APPROVED)")
            return

        if not check_user_notification_preference(recipient, "email_chat_messages"):
            return

        latest_notif = db.query(EmailNotification).filter(
            EmailNotification.user_id == recipient_id,
            EmailNotification.notification_type == EmailNotificationType.CHAT_MESSAGE,
            EmailNotification.status == "SENT"
        ).order_by(EmailNotification.created_at.desc()).first()

        if latest_notif:
            now = datetime.now(timezone.utc)
            created_at = latest_notif.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
                
            same_conversation = latest_notif.context_metadata and latest_notif.context_metadata.get("conversation_id") == str(conversation.id)
            time_diff = now - created_at
            
            if same_conversation and time_diff.total_seconds() < 300:
                logger.info(f"[NotificationService] Cooldown active for conversation {conversation.id} and recipient {recipient_id}. Skip email.")
                return

        raw_content = message.content or ""
        snippet = raw_content[:100] + "..." if len(raw_content) > 100 else raw_content

        sender = db.query(User).filter(User.id == message.sender_id).first()
        sender_name = f"{sender.full_name} ({sender.email})" if sender else "A student"

        template_data = {
            "recipientName": recipient.full_name or "Student",
            "productName": conversation.product.title if conversation.product else "Listing",
            "messageSnippet": snippet,
            "timestamp": message.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if message.created_at else datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "conversationId": str(conversation.id),
            "senderName": sender_name
        }

        background_tasks.add_task(
            send_resend_email,
            user_id=recipient.id,
            recipient_email=recipient.email,
            notification_type=EmailNotificationType.CHAT_MESSAGE,
            subject=f"New Message from {sender.email if sender else 'a student'} on SemesterSwap",
            template_name="new_message.html",
            template_data=template_data,
            context_metadata={"conversation_id": str(conversation.id), "message_id": str(message_id)}
        )

    @staticmethod
    def notify_transaction_completed(db: Session, request_id: UUID, background_tasks: BackgroundTasks):
        """
        Coordinates email notification to the buyer when a transaction is completed.
        """
        request = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
        if not request:
            logger.error(f"[NotificationService] Request {request_id} not found.")
            return

        buyer = db.query(User).filter(User.id == request.buyer_id).first()
        if not buyer or buyer.verification_status != "APPROVED":
            logger.info(f"[NotificationService] Skip email for buyer {buyer.id if buyer else 'None'} (not APPROVED)")
            return

        if not check_user_notification_preference(buyer, "email_meeting_requests"):
            return

        seller = db.query(User).filter(User.id == request.seller_id).first()
        seller_name = seller.full_name if seller else "Seller"
        seller_email = seller.email if seller else "unknown"

        template_data = {
            "buyerName": buyer.full_name or "Buyer",
            "sellerName": seller_name,
            "sellerEmail": seller_email,
            "productName": request.listing.title if request.listing else "Listing",
            "requestId": str(request.id)
        }

        background_tasks.add_task(
            send_resend_email,
            user_id=buyer.id,
            recipient_email=buyer.email,
            notification_type=EmailNotificationType.TRANSACTION_COMPLETED,
            subject=f"Thanks for purchasing '{request.listing.title if request.listing else 'your item'}' on SemesterSwap!",
            template_name="thanks_for_purchasing.html",
            template_data=template_data,
            context_metadata={"request_id": str(request_id)}
        )

