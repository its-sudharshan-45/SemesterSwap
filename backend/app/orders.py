from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from uuid import UUID
from typing import List

from backend.app.database import get_db
from backend.app.models import PurchaseRequest, Meeting, User, MeetingLocation
from backend.app.schemas import (
    OrderCreatePayload, 
    PaymentProcessPayload, 
    OrderRead, 
    ReschedulePayload, 
    CancelPayload
)
from backend.app.auth import get_current_user
from backend.app.services.purchase_request_service import (
    create_purchase_request, 
    expire_old_purchase_requests
)
from backend.app.services.notification_service import NotificationService
from backend.app.services.meeting_service import (
    reschedule_meeting, 
    accept_reschedule
)
from backend.app.services.transaction_service import (
    accept_purchase_request, 
    reject_purchase_request, 
    cancel_purchase_request, 
    complete_purchase_request
)

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])


@router.post("/create", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreatePayload,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new peer-to-peer swap purchase request (Meeting = PROPOSED stage).
    """
    # Trigger auto-expiration cleanup of old requests before creating
    expire_old_purchase_requests(db)
    request = create_purchase_request(db, current_user.id, payload)
    NotificationService.notify_meeting_request(db, request.id, background_tasks, payload.message)
    return request


@router.post("/{order_id}/process-payment", response_model=OrderRead)
def process_payment(
    order_id: UUID,
    payload: PaymentProcessPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mock-gateway placeholder for backward compatibility with payment hooks.
    """
    request = db.query(PurchaseRequest).options(
        joinedload(PurchaseRequest.buyer),
        joinedload(PurchaseRequest.seller),
        joinedload(PurchaseRequest.listing),
        joinedload(PurchaseRequest.meeting).joinedload(Meeting.confirmation)
    ).filter(PurchaseRequest.id == order_id).first()

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found."
        )
    return request


@router.post("/{order_id}/accept", response_model=OrderRead)
def accept_order(
    order_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Seller accepts meeting proposal -> transitions to SCHEDULED.
    Locks listing to prevent multiple accepted buyers (409 Conflict).
    """
    request = accept_purchase_request(db, order_id, current_user.id)
    NotificationService.notify_meeting_accepted(db, request.id, background_tasks)
    return request


@router.post("/{order_id}/reject", response_model=OrderRead)
def reject_order(
    order_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Legacy reject/decline route. Transitions status to REJECTED/CANCELLED.
    """
    request = reject_purchase_request(db, order_id, current_user.id)
    if request.status == "REJECTED":
        NotificationService.notify_meeting_rejected(db, request.id, background_tasks)
    elif request.status == "CANCELLED" and current_user.id == request.buyer_id:
        NotificationService.notify_meeting_cancelled(db, request.id, background_tasks, request.cancel_reason)
    return request


@router.post("/{order_id}/complete", response_model=OrderRead)
def complete_order(
    order_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Records completed verification & payment confirmation. Marks complete if both agree.
    """
    return complete_purchase_request(db, order_id, current_user.id, background_tasks)


@router.post("/{order_id}/reschedule", response_model=OrderRead)
def reschedule_order_meeting(
    order_id: UUID,
    payload: ReschedulePayload,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reschedules meeting date, time, and location (resets meeting status to PROPOSED).
    """
    request = reschedule_meeting(
        db=db,
        request_id=order_id,
        user_id=current_user.id,
        location=payload.meeting_location,
        date=payload.meeting_date,
        time=payload.meeting_time
    )
    
    # Notify the counterparty of the reschedule proposal
    NotificationService.notify_meeting_rescheduled(db, request.id, current_user.id, background_tasks)
        
    return request


@router.post("/{order_id}/accept-reschedule", response_model=OrderRead)
def accept_rescheduled_meeting(
    order_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Confirms acceptance of the proposed reschedule (transitions meeting status to SCHEDULED).
    """
    return accept_reschedule(db, order_id, current_user.id)


@router.post("/{order_id}/cancel", response_model=OrderRead)
def cancel_order_meeting(
    order_id: UUID,
    payload: CancelPayload,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancels swap meeting with a cancellation reason. Reverts listing availability.
    """
    request = cancel_purchase_request(db, order_id, current_user.id, payload.reason)
    
    # If the buyer is the actor cancelling/withdrawing the swap request, notify the seller
    if current_user.id == request.buyer_id:
        NotificationService.notify_meeting_cancelled(db, request.id, background_tasks, payload.reason)
        
    return request


@router.get("/locations", response_model=List[str])
def get_meeting_locations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Exposes a controlled list of active campus location options.
    """
    locations = db.query(MeetingLocation).filter(
        MeetingLocation.is_active == True,
        MeetingLocation.deleted_at == None
    ).all()
    return [loc.name for loc in locations]


@router.post("/cleanup-expired")
def trigger_cleanup_expired(db: Session = Depends(get_db)):
    """
    Trigger cleanup of expired pending requests.
    """
    count = expire_old_purchase_requests(db)
    return {"status": "success", "expired_count": count}


@router.get("/buyer", response_model=List[OrderRead])
def get_buyer_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves chronological purchase requests created by the current student.
    """
    orders = db.query(PurchaseRequest).options(
        joinedload(PurchaseRequest.buyer),
        joinedload(PurchaseRequest.seller),
        joinedload(PurchaseRequest.listing),
        joinedload(PurchaseRequest.meeting).joinedload(Meeting.confirmation)
    ).filter(PurchaseRequest.buyer_id == current_user.id).order_by(PurchaseRequest.created_at.desc()).all()
    return orders


@router.get("/seller", response_model=List[OrderRead])
def get_seller_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves chronological incoming swap proposal requests for the seller.
    """
    orders = db.query(PurchaseRequest).options(
        joinedload(PurchaseRequest.buyer),
        joinedload(PurchaseRequest.seller),
        joinedload(PurchaseRequest.listing),
        joinedload(PurchaseRequest.meeting).joinedload(Meeting.confirmation)
    ).filter(PurchaseRequest.seller_id == current_user.id).order_by(PurchaseRequest.created_at.desc()).all()
    return orders


@router.get("/{order_id}", response_model=OrderRead)
def get_order_details(
    order_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves detailed meeting coordination tracker for orderId.
    """
    order = db.query(PurchaseRequest).options(
        joinedload(PurchaseRequest.buyer),
        joinedload(PurchaseRequest.seller),
        joinedload(PurchaseRequest.listing),
        joinedload(PurchaseRequest.meeting).joinedload(Meeting.confirmation)
    ).filter(PurchaseRequest.id == order_id).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found."
        )

    if order.buyer_id != current_user.id and order.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this order."
        )

    return order
