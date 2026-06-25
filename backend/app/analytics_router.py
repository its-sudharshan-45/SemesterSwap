import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User, ListingView, SearchHistory, Listing
from backend.app.auth import get_current_user
from backend.app.schemas import AnalyticsViewRequest, AnalyticsSearchRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.post("/view", status_code=status.HTTP_201_CREATED)
def log_listing_view(
    payload: AnalyticsViewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    POST /api/v1/analytics/view
    Logs that a student viewed a specific listing.
    """
    listing = db.query(Listing).filter(Listing.id == payload.listing_id).first()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )

    try:
        view_entry = ListingView(
            user_id=current_user.id,
            listing_id=payload.listing_id
        )
        db.add(view_entry)
        db.commit()
        return {"status": "success", "message": "Listing view logged successfully"}
    except Exception as e:
        logger.error(f"Error logging listing view: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to log listing view"
        )


@router.post("/search", status_code=status.HTTP_201_CREATED)
def log_search_query(
    payload: AnalyticsSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    POST /api/v1/analytics/search
    Logs a query search string entered by a student.
    """
    query_str = payload.query.strip()
    if not query_str:
        return {"status": "success", "message": "Empty query ignored"}

    try:
        search_entry = SearchHistory(
            user_id=current_user.id,
            query=query_str
        )
        db.add(search_entry)
        db.commit()
        return {"status": "success", "message": "Search query logged successfully"}
    except Exception as e:
        logger.error(f"Error logging search query: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to log search query"
        )
