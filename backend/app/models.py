import uuid
import enum
from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, UUID, func, JSON, Boolean, Index, Numeric, CheckConstraint, Enum as SQLEnum
from sqlalchemy.orm import relationship, Mapped, synonym
from backend.app.database import Base


class AuditAction(str, enum.Enum):
    REQUEST_CREATED = "REQUEST_CREATED"
    REQUEST_ACCEPTED = "REQUEST_ACCEPTED"
    REQUEST_REJECTED = "REQUEST_REJECTED"
    REQUEST_CANCELLED = "REQUEST_CANCELLED"
    MEETING_RESCHEDULED = "MEETING_RESCHEDULED"
    BUYER_CONFIRMED = "BUYER_CONFIRMED"
    SELLER_CONFIRMED = "SELLER_CONFIRMED"
    COMPLETED = "COMPLETED"
    NO_SHOW_MARKED = "NO_SHOW_MARKED"


class NotificationType(str, enum.Enum):
    NEW_REQUEST = "NEW_REQUEST"
    REQUEST_ACCEPTED = "REQUEST_ACCEPTED"
    REQUEST_REJECTED = "REQUEST_REJECTED"
    REQUEST_EXPIRED = "REQUEST_EXPIRED"
    MEETING_REMINDER = "MEETING_REMINDER"
    MEETING_CANCELLED = "MEETING_CANCELLED"
    NO_SHOW_WARNING = "NO_SHOW_WARNING"
    TRANSACTION_COMPLETED = "TRANSACTION_COMPLETED"
    INTEREST = "interest"
    MESSAGE = "message"
    STATUS = "status"


class College(Base):
    __tablename__ = "colleges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email_domain = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    users = relationship("User", back_populates="college")


class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    users = relationship("User", back_populates="department")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    auth_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), unique=True, nullable=False, index=True)  # type: ignore
    college_id: Mapped[uuid.UUID | None] = Column(UUID(as_uuid=True), ForeignKey("colleges.id"), nullable=True)  # type: ignore
    department_id: Mapped[uuid.UUID | None] = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)  # type: ignore
    full_name: Mapped[str | None] = Column(String, nullable=True)  # type: ignore
    email: Mapped[str] = Column(String, unique=True, nullable=False, index=True)  # type: ignore
    admission_year: Mapped[int | None] = Column(Integer, nullable=True)  # type: ignore
    roll_number: Mapped[int | None] = Column(Integer, nullable=True)  # type: ignore
    profile_image: Mapped[str | None] = Column(String, nullable=True)  # type: ignore
    rating: Mapped[float] = Column(Float, default=0.0, nullable=False)  # type: ignore
    total_transactions: Mapped[int] = Column(Integer, default=0, nullable=False)  # type: ignore
    verification_status: Mapped[str] = Column(String, default="APPROVED", nullable=False)  # type: ignore
    student_id_verified: Mapped[bool] = Column(Boolean, default=False, nullable=False)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)  # type: ignore

    college = relationship("College", back_populates="users")
    department = relationship("Department", back_populates="users")
    listings = relationship("Listing", back_populates="seller", cascade="all, delete-orphan")
    conversations_as_buyer = relationship("Conversation", foreign_keys="[Conversation.buyer_id]", back_populates="buyer", cascade="all, delete-orphan")
    conversations_as_seller = relationship("Conversation", foreign_keys="[Conversation.seller_id]", back_populates="seller", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    wishlists = relationship("Wishlist", back_populates="user", cascade="all, delete-orphan")
    blocks = relationship("BlockedUser", foreign_keys="[BlockedUser.blocker_id]", back_populates="blocker", cascade="all, delete-orphan")
    blocked_by = relationship("BlockedUser", foreign_keys="[BlockedUser.blocked_id]", back_populates="blocked", cascade="all, delete-orphan")
    reports_filed = relationship("Report", foreign_keys="[Report.reporter_id]", back_populates="reporter", cascade="all, delete-orphan")
    reports_received = relationship("Report", foreign_keys="[Report.reported_user_id]", back_populates="reported_user", cascade="all, delete-orphan")
    reviews_given = relationship("Review", foreign_keys="[Review.reviewer_id]", back_populates="reviewer", cascade="all, delete-orphan")
    reviews_received = relationship("Review", foreign_keys="[Review.reviewee_id]", back_populates="reviewee", cascade="all, delete-orphan")


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    seller_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    title: Mapped[str] = Column(String, nullable=False)  # type: ignore
    description: Mapped[str] = Column(String, nullable=False)  # type: ignore
    category: Mapped[str] = Column(String, nullable=False)  # type: ignore
    condition: Mapped[str] = Column(String, nullable=False)  # type: ignore
    price: Mapped[float] = Column(Float, nullable=False)  # type: ignore
    status: Mapped[str] = Column(String, default="available", nullable=False)  # type: ignore
    images: Mapped[list] = Column(JSON, default=list, nullable=False)  # type: ignore
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    reserved_until: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)  # type: ignore

    seller = relationship("User", back_populates="listings")
    conversations = relationship("Conversation", back_populates="product", cascade="all, delete-orphan")
    wishlists = relationship("Wishlist", back_populates="listing", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="listing", cascade="all, delete-orphan")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    product_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    buyer_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    seller_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)  # type: ignore

    product = relationship("Listing", back_populates="conversations")
    buyer = relationship("User", foreign_keys=[buyer_id], back_populates="conversations_as_buyer")
    seller = relationship("User", foreign_keys=[seller_id], back_populates="conversations_as_seller")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

    listing_id = synonym("product_id")
    listing = synonym("product")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    conversation_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    sender_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    content: Mapped[str] = Column(String, nullable=False)  # type: ignore
    is_read: Mapped[bool] = Column(Boolean, default=False, nullable=False)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="messages")

    __table_args__ = (
        Index("idx_messages_conversation_created", "conversation_id", "created_at"),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    user_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    type: Mapped[NotificationType] = Column(SQLEnum(NotificationType, values_callable=lambda obj: [e.value for e in obj], native_enum=False), nullable=False)  # type: ignore
    title: Mapped[str] = Column(String, nullable=False)  # type: ignore
    message: Mapped[str] = Column(String, nullable=False)  # type: ignore
    is_read: Mapped[bool] = Column(Boolean, default=False, nullable=False)  # type: ignore
    read_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore

    user = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index("idx_notifications_user_read_created", "user_id", "is_read", "created_at"),
    )


class Wishlist(Base):
    __tablename__ = "wishlists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="wishlists")
    listing = relationship("Listing", back_populates="wishlists")


class BlockedUser(Base):
    __tablename__ = "blocked_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blocker_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    blocker = relationship("User", foreign_keys=[blocker_id], back_populates="blocks")
    blocked = relationship("User", foreign_keys=[blocked_id], back_populates="blocked_by")


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reported_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="SET NULL"), nullable=True)
    reason = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)  # 'pending', 'resolved'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    reporter = relationship("User", foreign_keys=[reporter_id], back_populates="reports_filed")
    reported_user = relationship("User", foreign_keys=[reported_user_id], back_populates="reports_received")
    listing = relationship("Listing", back_populates="reports")


class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    endpoint = Column(String, nullable=False)
    provider = Column(String, nullable=True)  # 'Claude', 'Gemini'
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=False)
    status = Column(String, nullable=False)  # 'success', 'failed'
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")


class ListingView(Base):
    __tablename__ = "listing_views"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
    listing = relationship("Listing")

    __table_args__ = (
        Index("idx_listing_views_user_created", "user_id", "created_at"),
        Index("idx_listing_views_listing_created", "listing_id", "created_at"),
    )


class SearchHistory(Base):
    __tablename__ = "search_history"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")

    __table_args__ = (
        Index("idx_search_history_user_created", "user_id", "created_at"),
    )


class AIAnalysisCache(Base):
    __tablename__ = "ai_analysis_cache"
    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    feature: Mapped[str] = Column(String, nullable=False)  # type: ignore
    input_hash: Mapped[str] = Column(String, unique=True, index=True, nullable=False)  # type: ignore
    response: Mapped[dict] = Column(JSON, nullable=False)  # type: ignore
    expires_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore


class RecommendationLog(Base):
    __tablename__ = "recommendation_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
    listing = relationship("Listing")

    __table_args__ = (
        Index("idx_rec_logs_user_created", "user_id", "created_at"),
    )


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    buyer_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    seller_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    product_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    amount: Mapped[Decimal] = Column(Numeric(10, 2, asdecimal=True), nullable=False)  # type: ignore
    order_status: Mapped[str] = Column(String, default="CREATED", nullable=False)  # type: ignore
    payment_method: Mapped[str] = Column(String, nullable=False)  # type: ignore
    payment_status: Mapped[str] = Column(String, default="PENDING", nullable=False)  # type: ignore
    transaction_id: Mapped[str | None] = Column(String, nullable=True)  # type: ignore
    seller_accepted: Mapped[bool] = Column(Boolean, default=False, nullable=False)  # type: ignore
    paid_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)  # type: ignore

    def can_transition_to(self, next_status: str) -> bool:
        valid_transitions = {
            "CREATED": {"PAYMENT_PENDING", "CANCELLED"},
            "PAYMENT_PENDING": {"PAID", "CANCELLED", "SELLER_ACCEPTED"},
            "PAID": {"SELLER_ACCEPTED", "CANCELLED"},
            "SELLER_ACCEPTED": {"COMPLETED", "CANCELLED"},
            "COMPLETED": set(),
            "CANCELLED": set()
        }
        allowed = valid_transitions.get(self.order_status, set())
        return next_status in allowed

    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    product = relationship("Listing", foreign_keys=[product_id])

    __table_args__ = (
        Index("idx_orders_buyer_id", "buyer_id"),
        Index("idx_orders_seller_id", "seller_id"),
        Index("idx_orders_product_id", "product_id"),
        Index("idx_orders_status", "order_status"),
    )


class Review(Base):
    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_requests.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reviewee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, CheckConstraint('rating >= 1 AND rating <= 5'), nullable=False)
    comment = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    order = relationship("PurchaseRequest", foreign_keys=[order_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id], back_populates="reviews_given")
    reviewee = relationship("User", foreign_keys=[reviewee_id], back_populates="reviews_received")


class AIPricePrediction(Base):
    __tablename__ = "ai_price_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="SET NULL"), nullable=True)
    predicted_price = Column(Float, nullable=False)
    minimum_price = Column(Float, nullable=False)
    maximum_price = Column(Float, nullable=False)
    confidence_score = Column(Float, nullable=False)
    reasoning = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Listing")


class AIGeneratedContent(Base):
    __tablename__ = "ai_generated_content"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="SET NULL"), nullable=True)
    prompt = Column(String, nullable=False)
    generated_title = Column(String, nullable=False)
    generated_description = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Listing")


class FraudAnalysis(Base):
    __tablename__ = "fraud_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=True)
    risk_score = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False)
    analysis_reason = Column(String, nullable=False)
    recommendations = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Listing")


class ImageQualityAnalysis(Base):
    __tablename__ = "image_quality_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=True)
    quality_score = Column(Float, nullable=False)
    quality_level = Column(String, nullable=False)
    feedback = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Listing")


class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    listing_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    buyer_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    seller_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    status: Mapped[str] = Column(String, default="PENDING", nullable=False)  # type: ignore
    expires_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)  # type: ignore
    cancelled_by: Mapped[uuid.UUID | None] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # type: ignore
    cancel_reason: Mapped[str | None] = Column(String, nullable=True)  # type: ignore
    cancelled_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)  # type: ignore

    listing = relationship("Listing", foreign_keys=[listing_id])
    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    meeting = relationship("Meeting", back_populates="request", uselist=False, cascade="all, delete-orphan")

    product = synonym("listing")

    __table_args__ = (
        CheckConstraint("buyer_id != seller_id", name="chk_buyer_seller_diff"),
    )

    @property
    def order_status(self) -> str:
        mapping = {
            "PENDING": "CREATED",
            "ACCEPTED": "SELLER_ACCEPTED",
            "REJECTED": "CANCELLED",
            "CANCELLED": "CANCELLED",
            "EXPIRED": "EXPIRED",
            "COMPLETED": "COMPLETED"
        }
        status_val = self.status
        if isinstance(status_val, str):
            return mapping.get(status_val, status_val)
        return "CREATED"

    @property
    def payment_method(self) -> str:
        return self.meeting.payment_method if self.meeting else "UPI"

    @property
    def payment_status(self) -> str:
        if self.status == "COMPLETED":
            return "SUCCESS"
        if self.status in ("REJECTED", "CANCELLED"):
            return "FAILED"
        return "PENDING"

    @property
    def seller_accepted(self) -> bool:
        return self.status in ("ACCEPTED", "COMPLETED")

    @property
    def paid_at(self) -> Optional[datetime]:
        if self.meeting and self.meeting.confirmation and self.meeting.confirmation.buyer_confirmed and self.meeting.confirmation.seller_confirmed:
            return self.meeting.confirmation.completed_at
        return None

    @property
    def amount(self) -> Decimal:
        return Decimal(str(self.listing.price)) if self.listing else Decimal("0.00")

    @property
    def product_id(self) -> uuid.UUID:
        val = self.listing_id
        if isinstance(val, uuid.UUID):
            return val
        from typing import cast
        return cast(uuid.UUID, val)


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    request_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("purchase_requests.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    location: Mapped[str] = Column(String, nullable=False)  # type: ignore
    date: Mapped[str] = Column(String, nullable=False)  # type: ignore
    time: Mapped[str] = Column(String, nullable=False)  # type: ignore
    payment_method: Mapped[str] = Column(String, nullable=False)  # type: ignore
    status: Mapped[str] = Column(String, default="PROPOSED", nullable=False)  # type: ignore
    cancelled_by: Mapped[uuid.UUID | None] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # type: ignore
    cancel_reason: Mapped[str | None] = Column(String, nullable=True)  # type: ignore
    cancelled_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)  # type: ignore
    confirmation_deadline: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)  # type: ignore
    no_show_marked_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)  # type: ignore

    request = relationship("PurchaseRequest", back_populates="meeting")
    confirmation = relationship("TransactionConfirmation", back_populates="meeting", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("payment_method IN ('CASH', 'UPI')", name="chk_payment_method"),
    )


class TransactionConfirmation(Base):
    __tablename__ = "transaction_confirmations"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    meeting_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), unique=True, nullable=False)  # type: ignore
    buyer_confirmed: Mapped[bool] = Column(Boolean, default=False, nullable=False)  # type: ignore
    seller_confirmed: Mapped[bool] = Column(Boolean, default=False, nullable=False)  # type: ignore
    completed_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)  # type: ignore

    meeting = relationship("Meeting", back_populates="confirmation")


class MeetingLocation(Base):
    __tablename__ = "meeting_locations"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    name: Mapped[str] = Column(String, unique=True, nullable=False)  # type: ignore
    description: Mapped[str | None] = Column(String, nullable=True)  # type: ignore
    is_active: Mapped[bool] = Column(Boolean, default=True, nullable=False)  # type: ignore
    deleted_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)  # type: ignore


class TransactionAuditLog(Base):
    __tablename__ = "transaction_audit_logs"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    purchase_request_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("purchase_requests.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    meeting_id: Mapped[uuid.UUID | None] = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="SET NULL"), nullable=True)  # type: ignore
    actor_id: Mapped[uuid.UUID | None] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # type: ignore
    action_type: Mapped[AuditAction] = Column(SQLEnum(AuditAction, native_enum=False), nullable=False)  # type: ignore
    old_status: Mapped[str | None] = Column(String, nullable=True)  # type: ignore
    new_status: Mapped[str | None] = Column(String, nullable=True)  # type: ignore
    action_metadata: Mapped[dict | None] = Column("metadata", JSON, nullable=True)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore

    purchase_request = relationship("PurchaseRequest", foreign_keys=[purchase_request_id])
    meeting = relationship("Meeting", foreign_keys=[meeting_id])
    actor = relationship("User", foreign_keys=[actor_id])


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    user_id: Mapped[uuid.UUID | None] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # type: ignore
    event_type: Mapped[str] = Column(String, nullable=False)  # type: ignore
    description: Mapped[str] = Column(String, nullable=False)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore

    user = relationship("User", foreign_keys=[user_id])


class EmailNotificationType(str, enum.Enum):
    MEETING_REQUEST = "MEETING_REQUEST"
    MEETING_ACCEPTED = "MEETING_ACCEPTED"
    MEETING_REJECTED = "MEETING_REJECTED"
    MEETING_RESCHEDULED = "MEETING_RESCHEDULED"
    MEETING_CANCELLED = "MEETING_CANCELLED"
    CHAT_MESSAGE = "CHAT_MESSAGE"
    TRANSACTION_COMPLETED = "TRANSACTION_COMPLETED"



class EmailNotification(Base):
    __tablename__ = "email_notifications"

    id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    user_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # type: ignore
    notification_type: Mapped[EmailNotificationType] = Column(SQLEnum(EmailNotificationType, values_callable=lambda obj: [e.value for e in obj], native_enum=False), nullable=False)  # type: ignore
    recipient_email: Mapped[str] = Column(String, nullable=False)  # type: ignore
    provider: Mapped[str] = Column(String, default="RESEND", nullable=False)  # type: ignore
    provider_message_id: Mapped[str | None] = Column(String, nullable=True)  # type: ignore
    status: Mapped[str] = Column(String, default="PENDING", nullable=False)  # type: ignore
    error_message: Mapped[str | None] = Column(String, nullable=True)  # type: ignore
    context_metadata: Mapped[dict | None] = Column(JSON, nullable=True)  # type: ignore
    retry_count: Mapped[int] = Column(Integer, default=0, nullable=False)  # type: ignore
    last_attempt_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)  # type: ignore
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # type: ignore
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)  # type: ignore

    user = relationship("User")

    __table_args__ = (
        Index("idx_email_notifications_user_id", "user_id"),
        Index("idx_email_notifications_type", "notification_type"),
        Index("idx_email_notifications_status", "status"),
        Index("idx_email_notifications_created_at", "created_at"),
    )






