from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session, joinedload
from uuid import UUID
from typing import List
from backend.app.database import get_db
from backend.app.models import Wishlist, Listing, User, Notification, NotificationType
from backend.app.schemas import WishlistRead, WishlistCreate
from backend.app.auth import get_current_user

router = APIRouter(prefix="/api/v1/wishlist", tags=["wishlist"])

@router.get("", response_model=List[WishlistRead])
def get_wishlist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves the authenticated student's saved wishlist items, including nested listing details.
    """
    return db.query(Wishlist).options(
        joinedload(Wishlist.listing).joinedload(Listing.seller).joinedload(User.college),
        joinedload(Wishlist.listing).joinedload(Listing.seller).joinedload(User.department)
    ).filter(
        Wishlist.user_id == current_user.id
    ).order_by(Wishlist.created_at.desc()).all()


@router.post("", response_model=WishlistRead, status_code=status.HTTP_201_CREATED)
def add_to_wishlist(
    payload: WishlistCreate,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Saves a listing to the student's wishlist. Checks duplicate entries and listing existence.
    """
    # Check if listing exists
    listing = db.query(Listing).filter(Listing.id == payload.listing_id).first()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product listing not found."
        )

    # Check if already in wishlist
    existing_entry = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.id,
        Wishlist.listing_id == payload.listing_id
    ).first()

    if existing_entry:
        response.status_code = status.HTTP_200_OK
        return db.query(Wishlist).options(
            joinedload(Wishlist.listing).joinedload(Listing.seller)
        ).filter(Wishlist.id == existing_entry.id).first()

    wishlist_item = Wishlist(
        user_id=current_user.id,
        listing_id=payload.listing_id
    )
    db.add(wishlist_item)
    
    # Create "Listing Interest" notification for the seller
    if listing.seller_id != current_user.id:
        notif = Notification(
            user_id=listing.seller_id,
            type=NotificationType.INTEREST,
            title="Listing Interest",
            message=f"A student saved your listing '{listing.title}' to their wishlist."
        )
        db.add(notif)

    db.commit()
    db.refresh(wishlist_item)

    # Return with loaded relationships
    return db.query(Wishlist).options(
        joinedload(Wishlist.listing).joinedload(Listing.seller).joinedload(User.college),
        joinedload(Wishlist.listing).joinedload(Listing.seller).joinedload(User.department)
    ).filter(Wishlist.id == wishlist_item.id).first()


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_wishlist(
    listing_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Removes a listing from the student's wishlist.
    """
    wishlist_item = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.id,
        Wishlist.listing_id == listing_id
    ).first()

    if not wishlist_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found in your wishlist."
        )

    db.delete(wishlist_item)
    db.commit()
    return None
