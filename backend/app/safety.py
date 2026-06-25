from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import BlockedUser, Report, User
from backend.app.schemas import BlockUserRequest, ReportCreate
from backend.app.auth import get_current_user

router = APIRouter(prefix="/api/v1/safety", tags=["safety"])

@router.post("/block", status_code=status.HTTP_201_CREATED)
def block_user(
    payload: BlockUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Blocks another user. Blocked users cannot message the blocker or start conversations.
    """
    if current_user.id == payload.blocked_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot block yourself."
        )

    # Check if user exists
    target_user = db.query(User).filter(User.id == payload.blocked_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User to block not found."
        )

    # Check if already blocked
    existing_block = db.query(BlockedUser).filter(
        BlockedUser.blocker_id == current_user.id,
        BlockedUser.blocked_id == payload.blocked_id
    ).first()

    if existing_block:
        return {"status": "success", "message": "User is already blocked."}

    block = BlockedUser(
        blocker_id=current_user.id,
        blocked_id=payload.blocked_id
    )
    db.add(block)
    db.commit()

    return {"status": "success", "message": "User has been blocked."}


@router.post("/report", status_code=status.HTTP_201_CREATED)
def report_user_or_listing(
    payload: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Files a report against another student or product listing for moderation.
    """
    if current_user.id == payload.reported_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot report yourself."
        )

    # Validate reported user exists
    target_user = db.query(User).filter(User.id == payload.reported_user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reported user not found."
        )

    report = Report(
        reporter_id=current_user.id,
        reported_user_id=payload.reported_user_id,
        listing_id=payload.listing_id,
        reason=payload.reason,
        status="pending"
    )
    db.add(report)
    db.commit()

    return {"status": "success", "message": "Report submitted successfully."}
