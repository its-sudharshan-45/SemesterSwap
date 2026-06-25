from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional, Dict, Any
from backend.app.models import Listing, AIPricePrediction
from backend.app.ai import estimate_price_statistics, estimate_price_llm

def get_price_recommendation(
    db: Session,
    title: str,
    category: str,
    condition: str,
    original_price: Optional[float] = None,
    age_months: Optional[int] = None,
    product_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None
) -> Dict[str, Any]:
    """
    Computes pricing recommendation, logs details to the database and returns details.
    """
    # 1. Search matching historical listings in the same category
    words = [w.lower() for w in title.split() if len(w) >= 3]
    historical_candidates = []
    if words:
        cat_listings = db.query(Listing).filter(Listing.category == category).all()
        for lst in cat_listings:
            if any(word in lst.title.lower() for word in words):
                historical_candidates.append(lst)
                
    # Fall back to category only if < 5 match title keywords
    if len(historical_candidates) < 5:
        historical_candidates = db.query(Listing).filter(Listing.category == category).all()
        
    historical_listings = [(lst.price, lst.condition) for lst in historical_candidates]
    
    prompt_tokens = None
    completion_tokens = None
    provider = None
    
    if len(historical_listings) >= 5:
        avg_price, min_price, max_price = estimate_price_statistics(historical_listings, condition)
        method = "historical_statistics"
        confidence_score = 90.0 if len(historical_listings) >= 10 else 75.0
        reasoning = f"Based on statistical analysis of {len(historical_listings)} matching listings in category '{category}'."
    else:
        # LLM fallback
        llm_res, prompt_tokens, completion_tokens, provider = estimate_price_llm(
            category=category,
            title=title,
            condition=condition,
            original_price=original_price,
            age_months=age_months,
            db=db,
            user_id=user_id
        )
        avg_price = float(llm_res.get("average_price", 500.0))
        min_price = float(llm_res.get("min_price", 300.0))
        max_price = float(llm_res.get("max_price", 700.0))
        confidence_label = str(llm_res.get("confidence_level", "Low"))
        confidence_score = 80.0 if confidence_label == "Medium" else 50.0
        method = "llm_fallback"
        reasoning = str(llm_res.get("explanation", "Depreciation factors and baseline marketplace trends."))

    # Save prediction log to database
    prediction = AIPricePrediction(
        product_id=product_id,
        predicted_price=avg_price,
        minimum_price=min_price,
        maximum_price=max_price,
        confidence_score=confidence_score,
        reasoning=reasoning
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    return {
        "id": str(prediction.id),
        "product_id": str(prediction.product_id) if prediction.product_id else None,
        "average_price": avg_price,
        "min_price": min_price,
        "max_price": max_price,
        "confidence_level": "High" if confidence_score >= 85 else "Medium" if confidence_score >= 70 else "Low",
        "confidence_score": confidence_score,
        "method": method,
        "explanation": reasoning
    }
