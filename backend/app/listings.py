from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from uuid import UUID, uuid4
from typing import List, Optional
from backend.app.database import get_db
from backend.app.models import Listing, User, College, Department, Wishlist, Notification
from backend.app.schemas import ListingCreate, ListingUpdate, ListingRead
from backend.app.auth import get_current_user
from backend.app.services.purchase_request_service import expire_old_purchase_requests

router = APIRouter(prefix="/api/v1/listings", tags=["listings"])

@router.get("", response_model=List[ListingRead])
def get_listings(
    q: Optional[str] = Query(None, description="Search term for title or description"),
    category: Optional[str] = Query(None, description="Filter by category"),
    condition: Optional[str] = Query(None, description="Filter by condition"),
    min_price: Optional[float] = Query(None, description="Minimum price filter"),
    max_price: Optional[float] = Query(None, description="Maximum price filter"),
    status: Optional[str] = Query("available", description="Filter by status (available, sold, or null/empty for all)"),
    db: Session = Depends(get_db)
):
    """
    Retrieves a list of product listings based on search terms and filters.
    Includes details about the seller, their college, and department.
    """
    # Eagerly load the nested relationships to avoid N+1 query problem
    query = db.query(Listing).options(
        joinedload(Listing.seller).joinedload(User.college),
        joinedload(Listing.seller).joinedload(User.department)
    )

    if status:
        query = query.filter(Listing.status == status)

    if category:
        query = query.filter(Listing.category == category)

    if condition:
        query = query.filter(Listing.condition == condition)

    if min_price is not None:
        query = query.filter(Listing.price >= min_price)

    if max_price is not None:
        query = query.filter(Listing.price <= max_price)

    if q:
        q_clean = q.strip().lower()
        search_filter = or_(
            func.lower(Listing.title).contains(q_clean),
            func.lower(Listing.description).contains(q_clean)
        )
        query = query.filter(search_filter)

    # Order by newest first
    query = query.order_by(Listing.created_at.desc())

    return query.all()


@router.get("/{id}", response_model=ListingRead)
def get_listing(id: UUID, db: Session = Depends(get_db)):
    """
    Retrieves details of a specific product listing by its UUID.
    """
    listing = db.query(Listing).options(
        joinedload(Listing.seller).joinedload(User.college),
        joinedload(Listing.seller).joinedload(User.department)
    ).filter(Listing.id == id).first()

    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )
    return listing


@router.post("", response_model=ListingRead, status_code=status.HTTP_201_CREATED)
def create_listing(
    payload: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new product listing. Only authenticated and verified students can list items.
    """
    listing = Listing(
        id=payload.id if payload.id is not None else uuid4(),
        seller_id=current_user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        condition=payload.condition,
        price=payload.price,
        images=payload.images,
        status="available"
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)

    # Fetch with relationships loaded
    return db.query(Listing).options(
        joinedload(Listing.seller).joinedload(User.college),
        joinedload(Listing.seller).joinedload(User.department)
    ).filter(Listing.id == listing.id).first()


@router.put("/{id}", response_model=ListingRead)
def update_listing(
    id: UUID,
    payload: ListingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Modifies an existing listing. Only the seller who owns the listing can update it.
    """
    listing = db.query(Listing).filter(Listing.id == id).first()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )

    # Ownership check
    if listing.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to edit this listing."
        )

    if payload.title is not None:
        listing.title = payload.title
    if payload.description is not None:
        listing.description = payload.description
    if payload.category is not None:
        listing.category = payload.category
    if payload.condition is not None:
        listing.condition = payload.condition
    if payload.price is not None:
        listing.price = payload.price
    if payload.images is not None:
        listing.images = payload.images

    db.commit()
    db.refresh(listing)

    # Fetch with relationships loaded
    return db.query(Listing).options(
        joinedload(Listing.seller).joinedload(User.college),
        joinedload(Listing.seller).joinedload(User.department)
    ).filter(Listing.id == listing.id).first()


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes a product listing. Only the listing owner can delete it.
    """
    listing = db.query(Listing).filter(Listing.id == id).first()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )

    # Ownership check
    if listing.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this listing."
        )

    db.delete(listing)
    db.commit()
    return None


@router.patch("/{id}/sold", response_model=ListingRead)
def mark_listing_as_sold(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates the status of a listing from 'available' to 'sold'. Only the listing owner can mark it.
    """
    listing = db.query(Listing).filter(Listing.id == id).first()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )

    # Ownership check
    if listing.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update this listing."
        )

    listing.status = "sold"
    
    # Notify wishlisters
    wishlister_ids = db.query(Wishlist.user_id).filter(Wishlist.listing_id == id).all()
    for row in wishlister_ids:
        wishlist_user_id = row[0]
        # Prevent notifying the seller themselves if they saved their own item
        if wishlist_user_id != current_user.id:
            notif = Notification(
                user_id=wishlist_user_id,
                type="status",
                title="Listing Status",
                message=f"An item you saved ({listing.title}) has been marked as sold."
            )
            db.add(notif)
            
    db.commit()
    db.refresh(listing)

    # Fetch with relationships loaded
    return db.query(Listing).options(
        joinedload(Listing.seller).joinedload(User.college),
        joinedload(Listing.seller).joinedload(User.department)
    ).filter(Listing.id == listing.id).first()
