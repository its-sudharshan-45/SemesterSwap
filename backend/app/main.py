from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from backend.app.auth import get_current_user
from backend.app.database import get_db, Base, engine
from backend.app.config import settings
from backend.app.models import User, College, Department, Review, Order, Notification, PurchaseRequest, MeetingLocation, EmailNotification
from backend.app.schemas import UserRead, UserUpdate, UserTrustProfile, ReviewRead, OrderRead
from datetime import datetime, timezone, timedelta
from uuid import UUID
from sqlalchemy.orm import joinedload
from typing import List

from backend.app.listings import router as listings_router
from backend.app.uploads import router as uploads_router
from backend.app.conversations import router as conversations_router
from backend.app.notifications import router as notifications_router
from backend.app.wishlist import router as wishlist_router
from backend.app.safety import router as safety_router
from backend.app.ai_router import router as ai_router
from backend.app.analytics_router import router as analytics_router
from backend.app.orders import router as orders_router
from backend.app.reviews import router as reviews_router
from backend.app.services.trust import calculate_trust_score


# Create tables if they do not exist (useful for local development and testing)
Base.metadata.create_all(bind=engine)

# Seed colleges, departments, and meeting locations in local SQLite if empty
db = Session(bind=engine)
try:
    if not db.query(College).first():
        db.add(College(name="KPRIET", email_domain="kpriet.ac.in"))
        db.commit()
    if not db.query(Department).first():
        db.add_all([
            Department(code="ad", name="Artificial Intelligence & Data Science"),
            Department(code="cs", name="Computer Science Engineering"),
            Department(code="ec", name="Electronics & Communication Engineering"),
            Department(code="me", name="Mechanical Engineering")
        ])
        db.commit()
    if not db.query(MeetingLocation).first():
        db.add_all([
            MeetingLocation(name="Library Entrance", description="Main entrance of the campus library", is_active=True),
            MeetingLocation(name="CSE Block Entrance", description="Entrance of the Computer Science block", is_active=True),
            MeetingLocation(name="Main Gate", description="Main campus entrance gate", is_active=True),
            MeetingLocation(name="Campus Cafeteria", description="Central campus food court lobby", is_active=True),
            MeetingLocation(name="Student Activity Center", description="Lobby of the SAC building", is_active=True)
        ])
        db.commit()
finally:
    db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    import logging
    logger = logging.getLogger("uvicorn.error")

    async def run_scheduler_periodically():
        logger.info("Periodic background scheduler task initialized.")
        try:
            while True:
                await asyncio.sleep(60)
                try:
                    from backend.app.database import SessionLocal
                    from backend.app.jobs.scheduler import expire_pending_requests, process_no_shows, send_transaction_reminders
                    
                    def run_jobs():
                        db = SessionLocal()
                        try:
                            expired = expire_pending_requests(db)
                            no_shows = process_no_shows(db)
                            reminders = send_transaction_reminders(db)
                            return expired, no_shows, reminders
                        finally:
                            db.close()

                    expired, no_shows, reminders = await asyncio.to_thread(run_jobs)
                    if expired > 0 or no_shows > 0 or reminders > 0:
                        logger.info(f"[Scheduler] Background jobs processed: expired={expired}, no_shows={no_shows}, reminders={reminders}")
                except Exception as e:
                    logger.error(f"[Scheduler] Error in background database session: {e}")
        except asyncio.CancelledError:
            logger.info("Periodic background scheduler task cancelled.")

    scheduler_task = asyncio.create_task(run_scheduler_periodically())
    yield
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="SemesterSwap API",
    description="AI-powered college-exclusive marketplace Phase 2 backend",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(listings_router)
app.include_router(uploads_router)
app.include_router(conversations_router)
app.include_router(notifications_router)
app.include_router(wishlist_router)
app.include_router(safety_router)
app.include_router(ai_router)
app.include_router(analytics_router)
app.include_router(orders_router)
app.include_router(reviews_router)




@app.get("/api/v1/users/me", response_model=UserRead)
def read_user_me(
    current_user: User = Depends(get_current_user)
):
    """
    Returns the authenticated student's profile, including college and department details.
    """
    return current_user

@app.put("/api/v1/users/me", response_model=UserRead)
def update_user_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates the authenticated student's profile.
    Only allows modification of allowed fields: full_name and profile_image.
    """
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.profile_image is not None:
        current_user.profile_image = payload.profile_image
        
    db.commit()
    db.refresh(current_user)
    return current_user


@app.get("/api/v1/users/{userId}/trust-profile", response_model=UserTrustProfile)
def get_user_trust_profile(
    userId: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes and returns the public reputation trust profile for a student.
    Includes completed transactions, products sold, account details, and reviews feed.
    """
    user = db.query(User).options(
        joinedload(User.college),
        joinedload(User.department)
    ).filter(User.id == userId).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student user profile not found."
        )

    # 1. Total Reviews
    total_reviews = db.query(Review).filter(Review.reviewee_id == userId).count()

    # 2. Completed Transactions
    completed_transactions = db.query(PurchaseRequest).filter(
        PurchaseRequest.status == "COMPLETED",
        ((PurchaseRequest.buyer_id == userId) | (PurchaseRequest.seller_id == userId))
    ).count()

    # 3. Products Sold
    products_sold = db.query(PurchaseRequest).filter(
        PurchaseRequest.status == "COMPLETED",
        PurchaseRequest.seller_id == userId
    ).count()

    # 4. Reviews List
    reviews = db.query(Review).options(
        joinedload(Review.reviewer),
        joinedload(Review.reviewee)
    ).filter(Review.reviewee_id == userId).order_by(Review.created_at.desc()).all()

    # 4b. Reliability & Cancellation Metrics
    from backend.app.models import Meeting, TransactionConfirmation
    successful_swaps = completed_transactions
    cancellation_count = db.query(PurchaseRequest).filter(PurchaseRequest.cancelled_by == userId).count()
    total_participations = db.query(PurchaseRequest).filter(
        (PurchaseRequest.buyer_id == userId) | (PurchaseRequest.seller_id == userId)
    ).count()
    cancellation_rate = float(cancellation_count) / max(total_participations, 1)
    
    # Exclude innocent confirming user from no-show penalty
    buyer_no_shows = db.query(Meeting).join(PurchaseRequest).join(TransactionConfirmation, isouter=True).filter(
        Meeting.status == "NO_SHOW",
        PurchaseRequest.buyer_id == userId,
        (TransactionConfirmation.buyer_confirmed == False) | (TransactionConfirmation.id == None)
    ).count()

    seller_no_shows = db.query(Meeting).join(PurchaseRequest).join(TransactionConfirmation, isouter=True).filter(
        Meeting.status == "NO_SHOW",
        PurchaseRequest.seller_id == userId,
        (TransactionConfirmation.seller_confirmed == False) | (TransactionConfirmation.id == None)
    ).count()

    no_show_count = buyer_no_shows + seller_no_shows

    # Base score = 50
    reliability_score_val = 50 + (successful_swaps * 3) + (user.rating * 5) - (cancellation_count * 2) - (no_show_count * 5)
    reliability_score_clamped = max(0, min(100, int(reliability_score_val)))

    if successful_swaps < 3:
        reliability_score = None
        reliability_level = "New User"
    else:
        reliability_score = reliability_score_clamped
        if reliability_score >= 90:
            reliability_level = "Trusted User"
        elif reliability_score >= 70:
            reliability_level = "Reliable User"
        elif reliability_score >= 50:
            reliability_level = "Normal User"
        else:
            reliability_level = "Low Reliability"

    # 5. Trust Score Calculation Algorithm (Standardized)
    trust_score = calculate_trust_score(
        created_at=user.created_at,
        verification_status=user.verification_status,
        rating=user.rating,
        total_reviews=total_reviews,
        completed_transactions=completed_transactions,
        products_sold=products_sold
    )

    return UserTrustProfile(
        user_id=user.id,
        full_name=user.full_name,
        profile_image=user.profile_image,
        college_name=user.college.name if user.college else "KPRIET",
        department_name=user.department.name if user.department else "Engineering",
        admission_year=user.admission_year,
        rating=user.rating,
        total_reviews=total_reviews,
        completed_transactions=completed_transactions,
        products_sold=products_sold,
        created_at=user.created_at,
        verification_status=user.verification_status,
        trust_score=trust_score,
        successful_swaps=successful_swaps,
        cancellation_count=cancellation_count,
        cancellation_rate=cancellation_rate,
        no_show_count=no_show_count,
        reliability_score=reliability_score,
        reliability_level=reliability_level,
        reviews=[ReviewRead.model_validate(r) for r in reviews]
    )



@app.post("/api/v1/users/{userId}/verify/approve", response_model=UserRead)
def mock_approve_verification(
    userId: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mock admin action to approve student college verification status.
    Dispatches a status notification to the target user.
    """
    if settings.ENV == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mock verification endpoints are disabled in production environments."
        )
    user = db.query(User).filter(User.id == userId).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student user profile not found."
        )

    user.verification_status = "APPROVED"
    
    notif = Notification(
        user_id=userId,
        type="status",
        title="College Verification Approved",
        message="Your student credentials have been successfully verified! You have unlocked your premium trust badge."
    )
    db.add(notif)
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/v1/users/{userId}/verify/reject", response_model=UserRead)
def mock_reject_verification(
    userId: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mock admin action to reject student college verification status.
    Dispatches a status notification to the target user.
    """
    if settings.ENV == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mock verification endpoints are disabled in production environments."
        )
    user = db.query(User).filter(User.id == userId).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student user profile not found."
        )

    user.verification_status = "REJECTED"
    
    notif = Notification(
        user_id=userId,
        type="status",
        title="College Verification Rejected",
        message="Your student credentials could not be verified. Please contact campus support to resolve verification errors."
    )
    db.add(notif)
    db.commit()
    db.refresh(user)
    return user


# ----------------------------------------------------
# Meeting Locations API Endpoints
# ----------------------------------------------------
from backend.app.schemas import MeetingLocationRead
from backend.app.models import MeetingLocation

@app.get("/api/v1/locations", response_model=List[MeetingLocationRead])
def get_locations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Students can only view active, non-soft-deleted locations.
    """
    locations = db.query(MeetingLocation).filter(
        MeetingLocation.is_active == True,
        MeetingLocation.deleted_at == None
    ).all()
    return locations


# Lifespan events manage periodic scheduler startup and shutdown cleanly
# Trigger uvicorn reload to pick up new dedicated SMTP email credentials

