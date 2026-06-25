from fastapi import APIRouter, Depends, HTTPException, status, Query, Response, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
from datetime import datetime, timezone
from uuid import UUID
from typing import List, Optional, Any
from backend.app.database import get_db
from backend.app.models import Conversation, Message, Notification, Listing, User, BlockedUser
from backend.app.schemas import ConversationCreate, ConversationRead, MessageCreate, MessageRead
from backend.app.auth import get_current_user
from backend.app.services.notification_service import NotificationService

router = APIRouter(prefix="/api/v1/conversations", tags=["conversations"])

def get_block_set(db: Session, user_id: Any) -> set:
    """Helper to fetch all UUIDs blocked by or blocker of the current user."""
    blocks = db.query(BlockedUser.blocked_id).filter(BlockedUser.blocker_id == user_id).all()
    blocked_by = db.query(BlockedUser.blocker_id).filter(BlockedUser.blocked_id == user_id).all()
    return {r[0] for r in blocks} | {r[0] for r in blocked_by}

@router.get("", response_model=List[ConversationRead])
def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves all conversations the current user belongs to.
    Filters out any conversations where the other participant is blocked.
    Includes last message summary and unread message count.
    """
    # 1. Fetch block relationships
    block_set = get_block_set(db, current_user.id)

    # 2. Get user conversations
    conversations = db.query(Conversation).options(
        joinedload(Conversation.product),
        joinedload(Conversation.buyer),
        joinedload(Conversation.seller)
    ).filter(
        or_(
            Conversation.buyer_id == current_user.id,
            Conversation.seller_id == current_user.id
        )
    ).all()

    # 3. Filter out blocks and enrich with unread count + last message
    result = []
    for conv in conversations:
        other_user_id = conv.seller_id if conv.buyer_id == current_user.id else conv.buyer_id
        if other_user_id in block_set:
            continue

        # Get unread count (messages sent by other user that are not read)
        unread_count = db.query(Message).filter(
            Message.conversation_id == conv.id,
            Message.sender_id != current_user.id,
            Message.is_read == False
        ).count()

        # Get last message
        last_msg = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(Message.created_at.desc()).first()

        # Build schema payload
        conv_read = ConversationRead.model_validate(conv)
        conv_read.unread_count = unread_count
        if last_msg:
            conv_read.last_message = MessageRead.model_validate(last_msg)
            
        result.append(conv_read)

    # Sort conversations by last activity or updated_at desc
    result.sort(key=lambda x: x.updated_at, reverse=True)
    return result


@router.get("/{id}", response_model=ConversationRead)
def get_conversation(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves details of a specific conversation participant.
    """
    conv = db.query(Conversation).options(
        joinedload(Conversation.product).joinedload(Listing.seller),
        joinedload(Conversation.buyer).joinedload(User.college),
        joinedload(Conversation.buyer).joinedload(User.department),
        joinedload(Conversation.seller).joinedload(User.college),
        joinedload(Conversation.seller).joinedload(User.department)
    ).filter(Conversation.id == id).first()

    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found."
        )

    # Check participant permissions
    if conv.buyer_id != current_user.id and conv.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation."
        )

    # Check blocks
    block_set = get_block_set(db, current_user.id)
    other_user_id = conv.seller_id if conv.buyer_id == current_user.id else conv.buyer_id
    if other_user_id in block_set:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied due to blocking."
        )

    unread_count = db.query(Message).filter(
        Message.conversation_id == conv.id,
        Message.sender_id != current_user.id,
        Message.is_read == False
    ).count()

    last_msg = db.query(Message).filter(
        Message.conversation_id == conv.id
    ).order_by(Message.created_at.desc()).first()

    conv_read = ConversationRead.model_validate(conv)
    conv_read.unread_count = unread_count
    if last_msg:
        conv_read.last_message = MessageRead.model_validate(last_msg)

    return conv_read


@router.post("", response_model=ConversationRead, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreate,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiates a product-based chat session.
    Prevents duplicate conversations and checks active blocks.
    Dispatches a 'Listing Interest' notification to the seller.
    """
    if current_user.id == payload.seller_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot start a conversation with yourself."
        )

    # Validate listing existence
    listing = db.query(Listing).filter_by(id=payload.product_id).first()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found."
        )

    # Validate block
    block_set = get_block_set(db, current_user.id)
    if payload.seller_id in block_set:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot start a conversation with a blocked user."
        )

    # Check duplicate conversation
    existing_conv = db.query(Conversation).filter(
        Conversation.product_id == payload.product_id,
        Conversation.buyer_id == current_user.id
    ).first()

    if existing_conv:
        # Return existing conversation
        response.status_code = status.HTTP_200_OK
        return get_conversation(existing_conv.id, current_user, db)  # type: ignore

    # Create new conversation
    conv = Conversation(
        product_id=payload.product_id,
        buyer_id=current_user.id,
        seller_id=payload.seller_id
    )
    db.add(conv)
    
    # Create "Listing Interest" notification for the seller
    notif = Notification(
        user_id=payload.seller_id,
        type="interest",
        title="Listing Interest",
        message=f"A student contacted you regarding your {listing.title}."
    )
    db.add(notif)
    db.commit()
    db.refresh(conv)

    return get_conversation(conv.id, current_user, db)  # type: ignore


@router.get("/{id}/messages", response_model=List[MessageRead])
def get_conversation_messages(
    id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves message history. Marks incoming messages as read.
    """
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found."
        )

    if conv.buyer_id != current_user.id and conv.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this message history."
        )

    block_set = get_block_set(db, current_user.id)
    other_user_id = conv.seller_id if conv.buyer_id == current_user.id else conv.buyer_id
    if other_user_id in block_set:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied due to blocking."
        )

    # Update Read Receipts: Mark all messages received by current user as read
    db.query(Message).filter(
        Message.conversation_id == id,
        Message.sender_id != current_user.id,
        Message.is_read == False
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()

    # Return messages sorted by time (paginated, recent first, then reversed for oldest first display)
    msgs = db.query(Message).filter(
        Message.conversation_id == id
    ).order_by(Message.created_at.desc()).offset(offset).limit(limit).all()
    msgs.reverse()
    return msgs


@router.post("/{id}/messages", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
def send_message(
    id: UUID,
    payload: MessageCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sends a chat message. Checks blocking constraints.
    Creates a 'New Message' notification for the recipient.
    """
    if not payload.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty."
        )

    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found."
        )

    if conv.buyer_id != current_user.id and conv.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation."
        )

    # Validate blocks
    block_set = get_block_set(db, current_user.id)
    recipient_id = conv.seller_id if conv.buyer_id == current_user.id else conv.buyer_id
    if recipient_id in block_set:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Message cannot be sent due to active block."
        )

    # Insert message
    msg = Message(
        conversation_id=id,
        sender_id=current_user.id,
        content=payload.content,
        is_read=False
    )
    db.add(msg)

    # Bump conversation updated_at
    conv.updated_at = datetime.now(timezone.utc)

    # Create "New Message" notification for the recipient (Disabled per user request to avoid database clutter)
    # sender_name = current_user.full_name or "A student"
    # listing_title = conv.product.title if conv.product else "your item"
    # notif = Notification(
    #     user_id=recipient_id,
    #     type="message",
    #     title="New Message",
    #     message=f"New message from {sender_name} about {listing_title}."
    # )
    # db.add(notif)
    db.commit()
    db.refresh(msg)

    # Trigger async chat notification email alert via background tasks
    NotificationService.notify_chat_message(db, msg.id, background_tasks)

    return msg


@router.patch("/messages/{id}/read", response_model=MessageRead)
def mark_message_as_read(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Marks a single message as read.
    """
    msg = db.query(Message).filter(Message.id == id).first()
    if not msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found."
        )

    # Participant verification
    conv = msg.conversation
    if conv.buyer_id != current_user.id and conv.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation."
        )

    if msg.sender_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot mark your own sent message as read."
        )

    msg.is_read = True
    db.commit()
    db.refresh(msg)

    return msg

