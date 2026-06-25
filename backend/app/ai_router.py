import time
import logging
import hashlib
import json
import uuid
from typing import Dict, List, Optional, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, time as datetime_time, timezone, timedelta

from backend.app.database import get_db, SessionLocal
from backend.app.models import User, AIUsageLog, Listing, ListingView, SearchHistory, AIAnalysisCache, RecommendationLog
from backend.app.auth import get_current_user
from backend.app.schemas import (
    AIDescriptionGenerateRequest,
    AIDescriptionGenerateResponse,
    AITitleImproveRequest,
    AITitleImproveResponse,
    AICategorySuggestRequest,
    AICategorySuggestResponse,
    AIListingReviewRequest,
    AIListingReviewResponse,
    AIPriceAnalysisRequest,
    AIPriceAnalysisResponse,
    AIImageAnalysisResponse,
    AIImageTaskResponse,
    ListingRead,
    PricePredictionRequest,
    PricePredictionResponse,
    FraudAnalysisRequest,
    FraudAnalysisResponse,
    SmartSearchRequest,
    SmartSearchResponse,
    SellerInsightsResponse,
    ImageQualityResponse,
    RecommendationSectionsResponse,
)
from backend.app.ai import (
    generate_description_ai,
    improve_title_ai,
    suggest_category_ai,
    review_listing_ai,
    estimate_price_statistics,
    estimate_price_llm,
    analyze_image_vision,
)
from backend.app.services.ai.pricing_service import get_price_recommendation
from backend.app.services.ai.description_service import generate_description
from backend.app.services.ai.fraud_service import detect_fraud
from backend.app.services.ai.search_service import smart_search
from backend.app.services.ai.recommendation_service import get_personalized_recommendation_sections
from backend.app.services.ai.image_analysis_service import analyze_image_quality
from backend.app.services.ai.seller_insights_service import get_seller_insights

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

# In-memory rate limiting storage: user_id -> list of request timestamps
user_requests: Dict[UUID, List[float]] = {}

def check_rate_limit(user_id: UUID):
    """
    Enforces a rate limit of 5 requests per minute per user.
    Raises HTTP 429 Too Many Requests if the limit is exceeded.
    """
    now = time.time()
    if user_id not in user_requests:
        user_requests[user_id] = []
        
    # Keep only requests within the last 60 seconds
    user_requests[user_id] = [t for t in user_requests[user_id] if now - t < 60]
    
    if len(user_requests[user_id]) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Maximum 5 AI requests per minute allowed."
        )
        
    user_requests[user_id].append(now)

def log_ai_usage(
    db: Session,
    user_id: UUID,
    endpoint: str,
    latency_ms: int,
    status_str: str,
    provider: Optional[str] = None,
    prompt_tokens: Optional[int] = None,
    completion_tokens: Optional[int] = None,
    error_message: Optional[str] = None,
):
    """
    Helper function to record AI request analytics to the database.
    """
    try:
        log_entry = AIUsageLog(
            user_id=user_id,
            endpoint=endpoint,
            provider=provider,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=latency_ms,
            status=status_str,
            error_message=error_message,
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to save AIUsageLog: {e}")
        db.rollback()


def run_background_vision_analysis(
    task_id: UUID,
    file_bytes: bytes,
    mime_type: str,
    user_id: UUID
):
    """
    Background worker that executes vision model API call, logs usage, and updates cache.
    """
    from backend.app.main import app
    from backend.app.database import get_db
    import inspect

    is_testing = get_db in app.dependency_overrides
    if is_testing:
        override = app.dependency_overrides[get_db]
        res = override()
        if inspect.isgenerator(res):
            db = next(res)
        else:
            db = res
    else:
        db = SessionLocal()

    start_time = time.perf_counter()
    try:
        vision_res, prompt_tokens, completion_tokens, provider = analyze_image_vision(
            file_bytes, mime_type, db=db, user_id=user_id
        )
        latency = int((time.perf_counter() - start_time) * 1000)
        
        # Save to cache
        cache_entry = db.query(AIAnalysisCache).filter(AIAnalysisCache.id == task_id).first()
        if cache_entry:
            cache_entry.response = {
                "status": "success",
                "result": vision_res
            }
            cache_entry.expires_at = datetime.now(timezone.utc) + timedelta(days=180)
            db.commit()
            
        # Log AI usage
        log_ai_usage(
            db=db,
            user_id=user_id,
            endpoint="/image-analysis",
            latency_ms=latency,
            status_str="success",
            provider=provider,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens
        )
    except Exception as e:
        latency = int((time.perf_counter() - start_time) * 1000)
        error_msg = str(e)
        logger.error(f"Image Analysis Background Task Error: {error_msg}", exc_info=True)
        
        try:
            cache_entry = db.query(AIAnalysisCache).filter(AIAnalysisCache.id == task_id).first()
            if cache_entry:
                cache_entry.response = {
                    "status": "failed",
                    "error": "Unable to generate AI suggestions at the moment. Please try again later."
                }
                db.commit()
        except Exception as db_err:
            logger.error(f"Failed to update cache failure state: {db_err}")
            db.rollback()
            
        log_ai_usage(
            db=db,
            user_id=user_id,
            endpoint="/image-analysis",
            latency_ms=latency,
            status_str="failed",
            error_message=error_msg
        )
    finally:
        if not is_testing:
            db.close()


@router.post("/generate-description", response_model=AIDescriptionGenerateResponse)
def generate_description_endpoint(
    payload: AIDescriptionGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    POST /api/v1/ai/generate-description
    Generates a description based on product title, condition, and optional additional info.
    """
    check_rate_limit(current_user.id)
    try:
        res = generate_description(
            db=db,
            title=payload.product_title,
            category="Others",
            condition=payload.condition,
            specifications=payload.additional_info,
            user_id=current_user.id
        )
        text = res["description"]
        return AIDescriptionGenerateResponse(description=text)
        
    except Exception as e:
        logger.error(f"AI Generation Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate AI suggestions at the moment. Please try again later.",
        )

@router.post("/improve-title", response_model=AITitleImproveResponse)
def improve_title_endpoint(
    payload: AITitleImproveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    POST /api/v1/ai/improve-title
    Suggests an enhanced product title.
    """
    check_rate_limit(current_user.id)
    try:
        improved, prompt_tok, comp_tok, provider = improve_title_ai(
            title=payload.title,
            condition=payload.condition,
            db=db,
            user_id=current_user.id
        )
        return AITitleImproveResponse(improved_title=improved)
        
    except Exception as e:
        logger.error(f"AI Title Improvement Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate AI suggestions at the moment. Please try again later.",
        )

@router.post("/suggest-category", response_model=AICategorySuggestResponse)
def suggest_category_endpoint(
    payload: AICategorySuggestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    POST /api/v1/ai/suggest-category
    Recommends a category from SemesterSwap's valid category listing.
    """
    check_rate_limit(current_user.id)
    try:
        category, prompt_tok, comp_tok, provider = suggest_category_ai(
            title=payload.title,
            description=payload.description,
            db=db,
            user_id=current_user.id
        )
        return AICategorySuggestResponse(category=category)
        
    except Exception as e:
        logger.error(f"AI Category Suggestion Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate AI suggestions at the moment. Please try again later.",
        )

@router.post("/review-listing", response_model=AIListingReviewResponse)
def review_listing_endpoint(
    payload: AIListingReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    POST /api/v1/ai/review-listing
    Reviews listing content details and suggests score and improvements.
    """
    check_rate_limit(current_user.id)
    try:
        score, suggestions, prompt_tok, comp_tok, provider = review_listing_ai(
            title=payload.title,
            description=payload.description,
            category=payload.category,
            condition=payload.condition,
            price=payload.price,
            db=db,
            user_id=current_user.id
        )
        return AIListingReviewResponse(score=score, suggestions=suggestions)
        
    except Exception as e:
        logger.error(f"AI Listing Review Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate AI suggestions at the moment. Please try again later.",
        )



def check_daily_rate_limit(db: Session, user_id: UUID, endpoint: str, max_limit: int):
    """
    Enforces daily usage limits of AI features using AIUsageLog.
    """
    today_start = datetime.combine(datetime.now(timezone.utc).date(), datetime_time.min).replace(tzinfo=timezone.utc)
    count = db.query(AIUsageLog).filter(
        AIUsageLog.user_id == user_id,
        AIUsageLog.endpoint == endpoint,
        AIUsageLog.created_at >= today_start,
        AIUsageLog.status == "success"
    ).count()
    
    if count >= max_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily limit of {max_limit} requests reached for this feature."
        )


@router.post("/price-analysis", response_model=AIPriceAnalysisResponse)
def price_analysis_endpoint(
    payload: AIPriceAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    POST /api/v1/ai/price-analysis
    Analyzes listing attributes and returns a fair pricing estimation.
    Includes caching check, daily rate limits, statistical calculation, and LLM fallback.
    """
    # 1. Daily rate limits: 20 requests per day per user
    check_daily_rate_limit(db, current_user.id, "/price-analysis", 20)
    
    # 2. Caching check: SHA-256 hash of request prompt fields
    req_dict = {
        "category": payload.category,
        "title": payload.title,
        "condition": payload.condition,
        "original_price": payload.original_price,
        "age_months": payload.age_months
    }
    req_bytes = json.dumps(req_dict, sort_keys=True).encode("utf-8")
    input_hash = hashlib.sha256(req_bytes).hexdigest()
    
    cached = db.query(AIAnalysisCache).filter(
        AIAnalysisCache.feature == "pricing",
        AIAnalysisCache.input_hash == input_hash
    ).first()
    
    if cached:
        # Check cache expiration (30 days)
        if cached.expires_at and cached.expires_at < datetime.now(timezone.utc):
            logger.info("Price analysis cache expired. Deleting and regenerating.")
            db.delete(cached)
            db.commit()
            cached = None
        else:
            logger.info("Price analysis cache hit.")
            return AIPriceAnalysisResponse(**cached.response)
        
    # 3. Running analysis
    start_time = time.perf_counter()
    try:
        # Search matching historical listings in the same category
        words = [w.lower() for w in payload.title.split() if len(w) >= 3]
        historical_candidates = []
        if words:
            cat_listings = db.query(Listing).filter(Listing.category == payload.category).all()
            for lst in cat_listings:
                if any(word in lst.title.lower() for word in words):
                    historical_candidates.append(lst)
                    
        # Fall back to category only if < 5 match title keywords
        if len(historical_candidates) < 5:
            historical_candidates = db.query(Listing).filter(Listing.category == payload.category).all()
            
        historical_listings = [(lst.price, lst.condition) for lst in historical_candidates]
        
        prompt_tokens = None
        completion_tokens = None
        provider = None
        
        if len(historical_listings) >= 5:
            avg_price, min_price, max_price = estimate_price_statistics(historical_listings, payload.condition)
            method = "historical_statistics"
            confidence_level = "High" if len(historical_listings) >= 10 else "Medium"
            explanation = f"Estimated using statistical analysis of {len(historical_listings)} matching historical listings in category '{payload.category}'."
        else:
            # LLM fallback
            llm_res, prompt_tokens, completion_tokens, provider = estimate_price_llm(
                category=payload.category,
                title=payload.title,
                condition=payload.condition,
                original_price=payload.original_price,
                age_months=payload.age_months,
                db=db,
                user_id=current_user.id
            )
            avg_price = float(llm_res.get("average_price", 500.0))
            min_price = float(llm_res.get("min_price", 300.0))
            max_price = float(llm_res.get("max_price", 700.0))
            confidence_level = str(llm_res.get("confidence_level", "Low"))
            method = "llm_fallback"
            explanation = str(llm_res.get("explanation", ""))
            
        latency = int((time.perf_counter() - start_time) * 1000)
        
        # Save to cache
        response_data = {
            "average_price": avg_price,
            "min_price": min_price,
            "max_price": max_price,
            "confidence_level": confidence_level,
            "method": method,
            "explanation": explanation
        }
        
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        cache_entry = AIAnalysisCache(
            feature="pricing",
            input_hash=input_hash,
            response=response_data,
            expires_at=expires_at
        )
        db.add(cache_entry)
        db.commit()
        
        # Log AI usage (only if method is not llm_fallback, as llm_fallback logs inside execute_with_failover!)
        if method != "llm_fallback":
            log_ai_usage(
                db=db,
                user_id=current_user.id,
                endpoint="/price-analysis",
                latency_ms=latency,
                status_str="success",
                provider=provider,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens
            )
        
        return AIPriceAnalysisResponse(**response_data)
        
    except Exception as e:
        latency = int((time.perf_counter() - start_time) * 1000)
        error_msg = str(e)
        logger.error(f"Price Analysis Error: {error_msg}", exc_info=True)
        # Log statistical calculation failure if we didn't try LLM fallback
        method_val = locals().get('method')
        if method_val != "llm_fallback":
            log_ai_usage(
                db=db,
                user_id=current_user.id,
                endpoint="/price-analysis",
                latency_ms=latency,
                status_str="failed",
                error_message=error_msg
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate AI suggestions at the moment. Please try again later."
        )


@router.post("/image-analysis", response_model=AIImageTaskResponse)
async def image_analysis_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    POST /api/v1/ai/image-analysis
    Accepts image file upload, schedules vision analysis as a background task.
    Returns task information immediately for client-side polling.
    """
    # 1. Daily rate limits: 10 requests per day per user
    check_daily_rate_limit(db, current_user.id, "/image-analysis", 10)
    
    # 2. Caching check: SHA-256 hash of raw image bytes
    file_bytes = await file.read()
    input_hash = hashlib.sha256(file_bytes).hexdigest()
    await file.seek(0)
    
    cached = db.query(AIAnalysisCache).filter(
        AIAnalysisCache.feature == "vision",
        AIAnalysisCache.input_hash == input_hash
    ).first()
    
    if cached:
        # Check cache expiration (180 days)
        if cached.expires_at and cached.expires_at < datetime.now(timezone.utc):
            logger.info("Vision analysis cache expired. Deleting and restarting.")
            db.delete(cached)
            db.commit()
            cached = None
        else:
            logger.info("Vision analysis cache hit.")
            resp = cached.response
            status_str = resp.get("status", "success")
            if status_str == "success":
                return AIImageTaskResponse(
                    task_id=cached.id,
                    status="success",
                    result=resp.get("result")
                )
            elif status_str == "failed":
                return AIImageTaskResponse(
                    task_id=cached.id,
                    status="failed",
                    error=resp.get("error")
                )
            else:
                return AIImageTaskResponse(
                    task_id=cached.id,
                    status="pending"
                )
                
    # 3. Cache miss: Create pending cache entry and queue background task
    task_id = uuid.uuid4()
    cache_entry = AIAnalysisCache(
        id=task_id,
        feature="vision",
        input_hash=input_hash,
        response={"status": "pending"},
        expires_at=datetime.now(timezone.utc) + timedelta(days=1)
    )
    db.add(cache_entry)
    db.commit()
    
    background_tasks.add_task(
        run_background_vision_analysis,
        task_id,
        file_bytes,
        file.content_type or "image/jpeg",
        current_user.id
    )
    
    return AIImageTaskResponse(
        task_id=task_id,
        status="pending"
    )


@router.get("/image-analysis/task/{task_id}", response_model=AIImageTaskResponse)
def get_image_analysis_task_endpoint(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    GET /api/v1/ai/image-analysis/task/{task_id}
    Polls the status of a scheduled vision analysis background task.
    """
    cached = db.query(AIAnalysisCache).filter(
        AIAnalysisCache.id == task_id,
        AIAnalysisCache.feature == "vision"
    ).first()
    
    if not cached:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vision analysis task not found."
        )
        
    resp = cached.response
    status_str = resp.get("status", "success")
    if status_str == "success":
        return AIImageTaskResponse(
            task_id=cached.id,
            status="success",
            result=resp.get("result")
        )
    elif status_str == "failed":
        return AIImageTaskResponse(
            task_id=cached.id,
            status="failed",
            error=resp.get("error")
        )
    else:
        return AIImageTaskResponse(
            task_id=cached.id,
            status="pending"
        )



@router.get("/recommendations", response_model=List[ListingRead])
def get_recommendations_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    GET /api/v1/ai/recommendations
    Generates personalized listings using weighted recommendation scoring:
    50% Content + 30% Collaborative + 20% Trending.
    Filters recommendations for diversity (max 2 listings per category, max 10 listings total).
    """
    # 1. Retrieve all active listings except user's own
    candidates = db.query(Listing).filter(
        Listing.status == "available",
        Listing.seller_id != current_user.id
    ).all()
    
    if not candidates:
        return []
        
    # 2. Extract views and searches of the current user
    user_views = db.query(ListingView).filter(ListingView.user_id == current_user.id).all()
    viewed_listing_ids = {v.listing_id for v in user_views}
    
    user_searches = db.query(SearchHistory).filter(SearchHistory.user_id == current_user.id).all()
    search_queries = [s.query for s in user_searches]
    
    # Extract interest keywords from viewed listings & searches
    interest_keywords = set()
    for q in search_queries:
        interest_keywords.update([w.lower() for w in q.split() if len(w) >= 3])
    for v_id in viewed_listing_ids:
        v_lst = db.query(Listing).filter(Listing.id == v_id).first()
        if v_lst:
            interest_keywords.update([w.lower() for w in v_lst.title.split() if len(w) >= 3])
            
    # 3. Collaborative Filtering mapping
    collaborative_scores = {}
    if viewed_listing_ids:
        other_views = db.query(ListingView.user_id).filter(
            ListingView.listing_id.in_(list(viewed_listing_ids)),
            ListingView.user_id != current_user.id
        ).all()
        other_user_ids = {ov.user_id for ov in other_views}
        
        if other_user_ids:
            co_listings = db.query(ListingView.listing_id).filter(
                ListingView.user_id.in_(list(other_user_ids)),
                ListingView.listing_id.notin_(list(viewed_listing_ids))
            ).all()
            for col_lst in co_listings:
                lid = col_lst.listing_id
                collaborative_scores[lid] = collaborative_scores.get(lid, 0) + 4
                
    # 4. Trending Listings mapping
    trending_views = db.query(
        ListingView.listing_id,
        func.count(ListingView.id).label("view_count")
    ).group_by(ListingView.listing_id).all()
    trending_scores = {r.listing_id: r.view_count for r in trending_views}
    
    # 5. Score candidates
    scored_candidates = []
    viewed_categories = {db.query(Listing.category).filter(Listing.id == v_id).scalar() for v_id in viewed_listing_ids}
    viewed_categories = {c for c in viewed_categories if c}

    for candidate in candidates:
        # Content score components: max points = 3 + 6 + 2 = 11. Capped at 10.
        category_match = candidate.category in viewed_categories
        cand_title_lower = candidate.title.lower()
        cand_desc_lower = candidate.description.lower()
        matches = sum(1 for kw in interest_keywords if kw in cand_title_lower or kw in cand_desc_lower)
        dept_match = current_user.department_id and candidate.seller.department_id == current_user.department_id
        
        content_raw = (3 if category_match else 0) + min(matches * 2, 6) + (2 if dept_match else 0)
        content_sub = min(float(content_raw), 10.0)
        
        # Collaborative score component: Capped at 10.
        co_score = collaborative_scores.get(candidate.id, 0)
        collab_sub = min(float(co_score), 10.0)
        
        # Trending score component: Capped at 10.
        trend_views = trending_scores.get(candidate.id, 0)
        trending_sub = min(float(trend_views), 10.0)
        
        # Final weighted recommendation score: 50% Content + 30% Collaborative + 20% Trending
        final_score = 0.5 * content_sub + 0.3 * collab_sub + 0.2 * trending_sub
        
        reasons = []
        if category_match:
            reasons.append((3, "similar category"))
        if matches > 0:
            reasons.append((min(matches * 2, 6), "matches search interests"))
        if dept_match:
            reasons.append((2, "popular in your department"))
        if co_score > 0:
            reasons.append((co_score, "viewed by similar students"))
        if trend_views > 0:
            reasons.append((trend_views, "trending product"))
            
        reasons.sort(key=lambda x: x[0], reverse=True)
        primary_reason = reasons[0][1] if reasons else "recommended college essential"
        
        scored_candidates.append((final_score, primary_reason, candidate))
        
    # Sort candidates by score descending
    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    
    # 6. Apply diversity filtering (max 2 per category) and select top 10
    top_recommendations = []
    category_counts = {}
    
    for score, reason, candidate in scored_candidates:
        cat = candidate.category
        if cat not in category_counts:
            category_counts[cat] = 0
            
        if category_counts[cat] < 2:
            top_recommendations.append((score, reason, candidate))
            category_counts[cat] += 1
            
        if len(top_recommendations) >= 10:
            break
            
    # 7. Log recommendations to database
    try:
        for score, reason, candidate in top_recommendations:
            rec_log = RecommendationLog(
                user_id=current_user.id,
                listing_id=candidate.id,
                reason=reason
            )
            db.add(rec_log)
        db.commit()
    except Exception as e:
        logger.error(f"Error logging recommendations to DB: {e}")
        db.rollback()
        
    return [item[2] for item in top_recommendations]


@router.post("/price-prediction", response_model=PricePredictionResponse)
def price_prediction_endpoint(
    payload: PricePredictionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_daily_rate_limit(db, current_user.id, "/price-prediction", 20)
    
    # Caching check
    req_dict = {
        "title": payload.title,
        "category": payload.category,
        "condition": payload.condition,
        "original_price": payload.original_price,
        "age_months": payload.age_months
    }
    req_bytes = json.dumps(req_dict, sort_keys=True).encode("utf-8")
    input_hash = hashlib.sha256(req_bytes).hexdigest()
    
    cached = db.query(AIAnalysisCache).filter(
        AIAnalysisCache.feature == "price_prediction",
        AIAnalysisCache.input_hash == input_hash
    ).first()
    
    if cached:
        if cached.expires_at and cached.expires_at < datetime.now(timezone.utc):
            db.delete(cached)
            db.commit()
        else:
            return PricePredictionResponse(**cached.response)
            
    start_time = time.perf_counter()
    try:
        res = get_price_recommendation(
            db=db,
            title=payload.title,
            category=payload.category,
            condition=payload.condition,
            original_price=payload.original_price,
            age_months=payload.age_months,
            product_id=payload.product_id,
            user_id=current_user.id
        )
        latency = int((time.perf_counter() - start_time) * 1000)
        
        # Cache the result
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        cache_entry = AIAnalysisCache(
            feature="price_prediction",
            input_hash=input_hash,
            response=res,
            expires_at=expires_at
        )
        db.add(cache_entry)
        db.commit()
        
        # Only log final success here if not logged inside LLM fallback
        if res.get("method") != "llm_fallback":
            log_ai_usage(db, current_user.id, "/price-prediction", latency, "success")
        return PricePredictionResponse(**res)
    except Exception as e:
        latency = int((time.perf_counter() - start_time) * 1000)
        logger.error(f"Price Prediction Error: {e}", exc_info=True)
        res_val = locals().get('res')
        if not isinstance(res_val, dict) or res_val.get("method") != "llm_fallback":
            log_ai_usage(db, current_user.id, "/price-prediction", latency, "failed", error_message=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate AI suggestions at the moment. Please try again later."
        )


@router.post("/analyze-listing", response_model=FraudAnalysisResponse)
def analyze_listing_endpoint(
    payload: FraudAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_daily_rate_limit(db, current_user.id, "/analyze-listing", 20)
    start_time = time.perf_counter()
    try:
        res = detect_fraud(
            db=db,
            title=payload.title,
            description=payload.description,
            category=payload.category,
            condition=payload.condition,
            price=payload.price,
            product_id=payload.product_id
        )
        latency = int((time.perf_counter() - start_time) * 1000)
        log_ai_usage(db, current_user.id, "/analyze-listing", latency, "success")
        return FraudAnalysisResponse(**res)
    except Exception as e:
        latency = int((time.perf_counter() - start_time) * 1000)
        log_ai_usage(db, current_user.id, "/analyze-listing", latency, "failed", error_message=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search", response_model=SmartSearchResponse)
def smart_search_endpoint(
    payload: SmartSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_daily_rate_limit(db, current_user.id, "/search", 50)
    start_time = time.perf_counter()
    try:
        # Log search query to search history
        sh = SearchHistory(user_id=current_user.id, query=payload.query)
        db.add(sh)
        db.commit()
        
        res = smart_search(db=db, query=payload.query)
        latency = int((time.perf_counter() - start_time) * 1000)
        log_ai_usage(db, current_user.id, "/search", latency, "success")
        return SmartSearchResponse(**res)
    except Exception as e:
        latency = int((time.perf_counter() - start_time) * 1000)
        log_ai_usage(db, current_user.id, "/search", latency, "failed", error_message=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/seller-insights/{product_id}", response_model=SellerInsightsResponse)
def get_seller_insights_endpoint(
    product_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        res = get_seller_insights(db=db, product_id=product_id)
        if not res:
            raise HTTPException(status_code=404, detail="Product not found.")
        return SellerInsightsResponse(**res)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image-quality", response_model=ImageQualityResponse)
def image_quality_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_daily_rate_limit(db, current_user.id, "/image-quality", 15)
    file_bytes = file.file.read()
    start_time = time.perf_counter()
    try:
        res = analyze_image_quality(
            db=db,
            image_bytes=file_bytes,
            mime_type=file.content_type or "image/jpeg"
        )
        latency = int((time.perf_counter() - start_time) * 1000)
        log_ai_usage(db, current_user.id, "/image-quality", latency, "success")
        return ImageQualityResponse(**res)
    except Exception as e:
        latency = int((time.perf_counter() - start_time) * 1000)
        log_ai_usage(db, current_user.id, "/image-quality", latency, "failed", error_message=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recommendations/sections", response_model=RecommendationSectionsResponse)
def get_recommendations_sections_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        res = get_personalized_recommendation_sections(db=db, current_user=current_user)
        return RecommendationSectionsResponse(**res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

