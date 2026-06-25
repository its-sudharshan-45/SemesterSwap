from sqlalchemy.orm import Session
from uuid import UUID
import json
import logging
from typing import Optional, Dict, Any
from backend.app.models import Listing, FraudAnalysis
from backend.app.config import settings
from backend.app.ai import call_claude_api, get_gemini_model

logger = logging.getLogger(__name__)

def detect_fraud(
    db: Session,
    title: str,
    description: str,
    category: str,
    condition: str,
    price: float,
    product_id: Optional[UUID] = None
) -> Dict[str, Any]:
    """
    Scans a product listing for pricing and content anomalies, persists logs to database,
    and returns risk score, risk level, reasoning, and recommendations.
    """
    # 1. Rule-based local price anomaly evaluation
    cat_listings = db.query(Listing).filter(
        Listing.category == category,
        Listing.status == "available"
    ).all()
    
    price_deviation_flag = False
    average_price = 0.0
    
    if len(cat_listings) >= 3:
        prices = [lst.price for lst in cat_listings]
        average_price = sum(prices) / len(prices)
        # Flag if price is less than 15% of average or more than 5x average
        if price < average_price * 0.15 or price > average_price * 5.0:
            price_deviation_flag = True

    # 2. Rule-based suspicious keyword evaluation
    suspicious_keywords = ["advance payment", "whatsapp me", "telegram me", "gift card", "crypto", "western union", "wire transfer", "outside app", "paytm advance", "gpay advance"]
    detected_keywords = [kw for kw in suspicious_keywords if kw in description.lower() or kw in title.lower()]

    # 3. LLM Listing Anomaly Scan
    system_prompt = "You are an AI Security and Fraud Detection Engine for SemesterSwap, a student-exclusive college marketplace."
    user_prompt = f"""Scan the following product listing for potential fraud, spam, or scams:
- Title: {title}
- Description: {description}
- Category: {category}
- Condition: {condition}
- Price: INR {price}
- Price Deviation Flag (Rule-based check compared to category average of {average_price:.2f}): {price_deviation_flag}
- Detected Suspicious Keywords (Rule-based check): {detected_keywords}

Format your response as a JSON object containing:
- "risk_score": float (risk score between 0.0 and 100.0, where 100 is maximum risk)
- "risk_level": str ("LOW", "MEDIUM", "HIGH")
- "analysis_reason": str (concise reason summarizing the decision)
- "recommendations": list of strings (actionable advice to mitigate risks or improve listing layout)

Return ONLY the JSON object. Do not include markdown code block indicators like ```json.
"""

    text = ""
    provider = "Gemini"
    success = False

    # Attempt Claude
    if settings.ANTHROPIC_API_KEY:
        try:
            logger.info("Attempting fraud scanning using Claude...")
            text, _, _ = call_claude_api(system_prompt, user_prompt)
            success = True
            provider = "Claude"
        except Exception as e:
            logger.warning(f"Claude fraud scan failed: {e}")

    # Fallback to Gemini
    if not success:
        logger.info("Using Gemini Flash for fraud scanning...")
        model = get_gemini_model()
        response = model.generate_content(f"{system_prompt}\n\n{user_prompt}")
        text = response.text.strip()
        provider = "Gemini"

    # Clean response
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        data = json.loads(text)
        risk_score = float(data.get("risk_score", 10.0))
        risk_level = str(data.get("risk_level", "LOW")).upper()
        analysis_reason = str(data.get("analysis_reason", "Listing checked with no anomalies found."))
        recommendations = list(data.get("recommendations", []))
    except Exception as e:
        logger.error(f"Failed to parse fraud analysis JSON: {e}. Raw: {text}")
        risk_score = 45.0 if price_deviation_flag or detected_keywords else 10.0
        risk_level = "MEDIUM" if risk_score > 30 else "LOW"
        analysis_reason = "Evaluated programmatically due to AI parsing issues."
        recommendations = ["Keep swaps on campus and in person."]

    # Write to database
    analysis_record = FraudAnalysis(
        product_id=product_id,
        risk_score=risk_score,
        risk_level=risk_level,
        analysis_reason=analysis_reason,
        recommendations=recommendations
    )
    db.add(analysis_record)
    db.commit()
    db.refresh(analysis_record)

    return {
        "id": analysis_record.id,
        "product_id": analysis_record.product_id,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "analysis_reason": analysis_reason,
        "recommendations": recommendations,
        "provider": provider
    }
