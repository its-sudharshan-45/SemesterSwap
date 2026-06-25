from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class CollegeRead(BaseModel):
    id: UUID
    name: str
    email_domain: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DepartmentRead(BaseModel):
    id: UUID
    code: str
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserRead(BaseModel):
    id: UUID
    auth_id: UUID
    college_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    full_name: Optional[str] = None
    email: str
    admission_year: Optional[int] = None
    roll_number: Optional[int] = None
    profile_image: Optional[str] = None
    rating: float
    total_transactions: int
    verification_status: str
    created_at: datetime
    updated_at: datetime
    college: Optional[CollegeRead] = None
    department: Optional[DepartmentRead] = None

    model_config = ConfigDict(from_attributes=True)


class UserPublicRead(BaseModel):
    id: UUID
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    rating: float
    verification_status: str

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    profile_image: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


VALID_CATEGORIES = {
    "Textbooks", "Notes", "Calculators", "Lab Equipment",
    "Electronics", "Accessories", "Others"
}

VALID_CONDITIONS = {
    "New", "Like New", "Good", "Acceptable"
}


class ListingBase(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    category: str
    condition: str
    price: float = Field(..., gt=0)
    images: List[str]

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            raise ValueError(f"Category must be one of: {', '.join(VALID_CATEGORIES)}")
        return v

    @field_validator("condition")
    @classmethod
    def validate_condition(cls, v: str) -> str:
        if v not in VALID_CONDITIONS:
            raise ValueError(f"Condition must be one of: {', '.join(VALID_CONDITIONS)}")
        return v

    @field_validator("images")
    @classmethod
    def validate_images(cls, v: List[str]) -> List[str]:
        if len(v) < 1:
            raise ValueError("At least one image is required.")
        if len(v) > 5:
            raise ValueError("Maximum 5 images allowed.")
        return v


class ListingCreate(ListingBase):
    id: Optional[UUID] = None



class ListingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    category: Optional[str] = None
    condition: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    images: Optional[List[str]] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_CATEGORIES:
            raise ValueError(f"Category must be one of: {', '.join(VALID_CATEGORIES)}")
        return v

    @field_validator("condition")
    @classmethod
    def validate_condition(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_CONDITIONS:
            raise ValueError(f"Condition must be one of: {', '.join(VALID_CONDITIONS)}")
        return v

    @field_validator("images")
    @classmethod
    def validate_images(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None:
            if len(v) < 1:
                raise ValueError("At least one image is required.")
            if len(v) > 5:
                raise ValueError("Maximum 5 images allowed.")
        return v


class ListingRead(BaseModel):
    id: UUID
    seller_id: UUID
    title: str
    description: str
    category: str
    condition: str
    price: float
    status: str
    images: List[str]
    created_at: datetime
    updated_at: datetime
    reserved_until: Optional[datetime] = None
    seller: Optional[UserRead] = None

    model_config = ConfigDict(from_attributes=True)


class ConversationCreate(BaseModel):
    product_id: UUID
    seller_id: UUID

    @model_validator(mode="before")
    @classmethod
    def resolve_product_id(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "listing_id" in data and "product_id" not in data:
                data["product_id"] = data["listing_id"]
        return data


class MessageCreate(BaseModel):
    content: str


class MessageRead(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    content: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationRead(BaseModel):
    id: UUID
    product_id: UUID
    listing_id: Optional[UUID] = None
    buyer_id: UUID
    seller_id: UUID
    created_at: datetime
    updated_at: datetime
    product: Optional[ListingRead] = None
    listing: Optional[ListingRead] = None
    buyer: Optional[UserRead] = None
    seller: Optional[UserRead] = None
    messages: Optional[List[MessageRead]] = None
    unread_count: Optional[int] = None
    last_message: Optional[MessageRead] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationRead(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WishlistCreate(BaseModel):
    listing_id: UUID


class WishlistRead(BaseModel):
    id: UUID
    user_id: UUID
    listing_id: UUID
    created_at: datetime
    listing: Optional[ListingRead] = None

    model_config = ConfigDict(from_attributes=True)


class BlockUserRequest(BaseModel):
    blocked_id: UUID


class ReportCreate(BaseModel):
    reported_user_id: UUID
    listing_id: Optional[UUID] = None
    reason: str


class AIDescriptionGenerateRequest(BaseModel):
    product_title: str
    condition: str
    additional_info: Optional[str] = None


class AIDescriptionGenerateResponse(BaseModel):
    description: str


class AITitleImproveRequest(BaseModel):
    title: str
    condition: Optional[str] = None


class AITitleImproveResponse(BaseModel):
    improved_title: str


class AICategorySuggestRequest(BaseModel):
    title: str
    description: Optional[str] = None


class AICategorySuggestResponse(BaseModel):
    category: str


class AIListingReviewRequest(BaseModel):
    title: str
    description: str
    category: str
    condition: str
    price: float


class AIListingReviewResponse(BaseModel):
    score: int
    suggestions: List[str]


class AIPriceAnalysisRequest(BaseModel):
    category: str
    title: str
    condition: str
    original_price: Optional[float] = None
    age_months: Optional[int] = None


class AIPriceAnalysisResponse(BaseModel):
    average_price: float
    min_price: float
    max_price: float
    confidence_level: str  # "High", "Medium", "Low"
    method: str            # "historical_statistics" or "llm_fallback"
    explanation: str


class AIImageAnalysisResponse(BaseModel):
    product_type: str
    title_brand: str
    estimated_condition: str  # "New", "Like New", "Good", "Acceptable"
    confidence: float          # Confidence percentage (0-100)
    suggestions: List[str]
    warnings: List[str]


class AIImageTaskResponse(BaseModel):
    task_id: UUID
    status: str  # "pending", "success", "failed"
    result: Optional[AIImageAnalysisResponse] = None
    error: Optional[str] = None


class AnalyticsViewRequest(BaseModel):
    listing_id: UUID


class AnalyticsSearchRequest(BaseModel):
    query: str


class OrderCreatePayload(BaseModel):
    product_id: UUID
    payment_method: str  # 'CASH', 'UPI'
    meeting_date: str
    meeting_time: str
    meeting_location: str
    message: Optional[str] = None


class PaymentProcessPayload(BaseModel):
    success: bool
    transaction_id: Optional[str] = None
    payment_method: Optional[str] = None


class TransactionConfirmationRead(BaseModel):
    id: UUID
    meeting_id: UUID
    buyer_confirmed: bool
    seller_confirmed: bool
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class MeetingRead(BaseModel):
    id: UUID
    request_id: UUID
    location: str
    date: str
    time: str
    payment_method: str
    status: str
    cancelled_by: Optional[UUID] = None
    cancel_reason: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    confirmation: Optional[TransactionConfirmationRead] = None

    model_config = ConfigDict(from_attributes=True)


class OrderRead(BaseModel):
    id: UUID
    buyer_id: UUID
    seller_id: UUID
    product_id: UUID
    amount: Decimal
    order_status: str
    payment_method: str
    payment_status: str
    transaction_id: Optional[str] = None
    seller_accepted: bool
    paid_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    cancelled_by: Optional[UUID] = None
    cancel_reason: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    buyer: Optional[UserRead] = None
    seller: Optional[UserRead] = None
    product: Optional[ListingRead] = None
    meeting: Optional[MeetingRead] = None

    model_config = ConfigDict(from_attributes=True)


class ReviewCreate(BaseModel):
    order_id: UUID
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class ReviewRead(BaseModel):
    id: UUID
    order_id: UUID
    reviewer_id: UUID
    reviewee_id: UUID
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    reviewer: Optional[UserPublicRead] = None
    reviewee: Optional[UserPublicRead] = None

    model_config = ConfigDict(from_attributes=True)


class UserTrustProfile(BaseModel):
    user_id: UUID
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    college_name: Optional[str] = None
    department_name: Optional[str] = None
    admission_year: Optional[int] = None
    rating: float
    total_reviews: int
    completed_transactions: int
    products_sold: int
    created_at: datetime
    verification_status: str
    trust_score: int
    successful_swaps: int
    cancellation_count: int
    cancellation_rate: float
    no_show_count: int
    reliability_score: Optional[int] = None
    reliability_level: str
    reviews: List[ReviewRead]

    model_config = ConfigDict(from_attributes=True)


class PricePredictionRequest(BaseModel):
    title: str
    category: str
    condition: str
    original_price: Optional[float] = None
    age_months: Optional[int] = None
    product_id: Optional[UUID] = None


class PricePredictionResponse(BaseModel):
    id: UUID
    product_id: Optional[UUID] = None
    average_price: float
    min_price: float
    max_price: float
    confidence_level: str
    confidence_score: float
    method: str
    explanation: str

    model_config = ConfigDict(from_attributes=True)


class FraudAnalysisRequest(BaseModel):
    title: str
    description: str
    category: str
    condition: str
    price: float
    product_id: Optional[UUID] = None


class FraudAnalysisResponse(BaseModel):
    id: UUID
    product_id: Optional[UUID] = None
    risk_score: float
    risk_level: str
    analysis_reason: str
    recommendations: List[str]

    model_config = ConfigDict(from_attributes=True)


class SmartSearchRequest(BaseModel):
    query: str


class SearchListingItem(BaseModel):
    listing: ListingRead
    relevance_score: float
    explanation: str

    model_config = ConfigDict(from_attributes=True)


class SmartSearchResponse(BaseModel):
    explanation: str
    results: List[SearchListingItem]

    model_config = ConfigDict(from_attributes=True)


class SellerInsightsResponse(BaseModel):
    product_id: UUID
    views: int
    chats: int
    wishlist_count: int
    conversion_rate: float
    average_response_time: float
    selling_probability: float
    suggestions: List[str]

    model_config = ConfigDict(from_attributes=True)


class ImageQualityResponse(BaseModel):
    id: UUID
    product_id: Optional[UUID] = None
    quality_score: float
    quality_level: str
    feedback: List[str]

    model_config = ConfigDict(from_attributes=True)


class RecommendationSectionsResponse(BaseModel):
    recommended_for_you: List[ListingRead]
    similar_products: List[ListingRead]
    trending_in_college: List[ListingRead]
    based_on_searches: List[ListingRead]

    model_config = ConfigDict(from_attributes=True)


class ReschedulePayload(BaseModel):
    meeting_location: str
    meeting_date: str
    meeting_time: str


class CancelPayload(BaseModel):
    reason: str


class MeetingLocationCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None


class MeetingLocationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class MeetingLocationRead(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    is_active: bool
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TransactionAuditLogRead(BaseModel):
    id: UUID
    purchase_request_id: UUID
    meeting_id: Optional[UUID] = None
    actor_id: Optional[UUID] = None
    action_type: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    metadata: Optional[dict] = Field(None, validation_alias="action_metadata")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)








