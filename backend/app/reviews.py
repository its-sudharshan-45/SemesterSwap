from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from uuid import UUID
from typing import List

from backend.app.database import get_db
from backend.app.models import Review, User, Notification, PurchaseRequest
from backend.app.schemas import ReviewCreate, ReviewRead
from backend.app.auth import get_current_user

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])

@router.post("", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits a rating and written review for a completed swap transaction.
    Enforces participant boundaries and self-review constraints.
    """
    # 1. Fetch order and check existence
    order = db.query(PurchaseRequest).filter(PurchaseRequest.id == payload.order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found."
        )

    # 2. Verify that the order is COMPLETED
    if order.order_status != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reviews can only be submitted after an order has been successfully completed."
        )

    # 3. Verify user involvement in the transaction
    if current_user.id != order.buyer_id and current_user.id != order.seller_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to review this order because you were not a participant."
        )

    # 4. Determine reviewee
    reviewee_id = order.seller_id if current_user.id == order.buyer_id else order.buyer_id

    # 5. Prevent self-review (redundant but safe)
    if current_user.id == reviewee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot review yourself."
        )

    # 6. Check if this reviewer already submitted a review for this order
    existing_review = db.query(Review).filter(
        Review.order_id == payload.order_id,
        Review.reviewer_id == current_user.id
    ).first()
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted a review for this transaction."
        )

    # 7. Create review
    review = Review(
        order_id=payload.order_id,
        reviewer_id=current_user.id,
        reviewee_id=reviewee_id,
        rating=payload.rating,
        comment=payload.comment
    )
    db.add(review)
    db.flush()

    # Recalculate average rating for reviewee
    from sqlalchemy import func
    avg_rating_val = db.query(func.avg(Review.rating)).filter(Review.reviewee_id == reviewee_id).scalar()
    reviewee = db.query(User).filter(User.id == reviewee_id).first()
    if reviewee:
        reviewee.rating = float(avg_rating_val) if avg_rating_val is not None else 0.0

    # 8. Create notification for reviewee
    reviewer_name = current_user.full_name or "A student"
    notif = Notification(
        user_id=reviewee_id,
        type="status",
        title="New Review Received",
        message=f"{reviewer_name} gave you a {payload.rating}-star rating swap feedback."
    )
    db.add(notif)
    db.commit()
    db.refresh(review)

    # 9. Return loaded review details
    return db.query(Review).options(
        joinedload(Review.reviewer),
        joinedload(Review.reviewee)
    ).filter(Review.id == review.id).first()


@router.get("/received", response_model=List[ReviewRead])
def get_received_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves all reviews received by the currently authenticated user.
    """
    return db.query(Review).options(
        joinedload(Review.reviewer),
        joinedload(Review.reviewee)
    ).filter(Review.reviewee_id == current_user.id).order_by(Review.created_at.desc()).all()
