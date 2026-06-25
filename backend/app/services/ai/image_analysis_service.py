from sqlalchemy.orm import Session
from uuid import UUID
import json
import logging
from typing import Optional, Dict, Any
from backend.app.models import ImageQualityAnalysis
from backend.app.config import settings
from backend.app.ai import call_claude_vision_api, get_gemini_model

logger = logging.getLogger(__name__)

def analyze_image_quality(
    db: Session,
    image_bytes: bytes,
    mime_type: str,
    product_id: Optional[UUID] = None
) -> Dict[str, Any]:
    """
    Analyzes listing image quality parameters via vision models, persists metrics,
    and returns a score, quality level, and actionable feedback.
    """
    system_prompt = "You are an AI Image Quality Analysis Engine for SemesterSwap."
    user_prompt = """Analyze the quality of this uploaded product image for a college marketplace.
Evaluate:
1. Clarity: Is it sharp and clean, or blurry/noisy?
2. Lighting: Is it well-lit, or too dark/bright?
3. Composition: Is the product fully visible and centered in the frame?
4. Resolution: Does it have enough pixels to view details?

Format your response as a JSON object containing:
- "quality_score": float (score from 0.0 to 100.0)
- "quality_level": str ("EXCELLENT", "GOOD", "POOR")
- "feedback": list of strings (actionable feedback, e.g. "Take image from a closer distance", "Increase room lighting")

Return ONLY the JSON object. Do not include markdown code block indicators like ```json.
"""

    text = ""
    provider = "Gemini"
    success = False

    # Attempt Claude Vision
    if settings.ANTHROPIC_API_KEY:
        try:
            logger.info("Attempting image quality analysis using Claude Vision...")
            text, _, _ = call_claude_vision_api(image_bytes, mime_type, user_prompt)
            success = True
            provider = "Claude"
        except Exception as e:
            logger.warning(f"Claude vision analysis failed in quality service: {e}")

    # Fallback to Gemini
    if not success:
        logger.info("Using Gemini Flash for image quality vision analysis...")
        model = get_gemini_model()
        image_part = {
            "mime_type": mime_type,
            "data": image_bytes
        }
        response = model.generate_content([image_part, user_prompt])
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
        quality_score = float(data.get("quality_score", 80.0))
        quality_level = str(data.get("quality_level", "GOOD")).upper()
        feedback = list(data.get("feedback", []))
    except Exception as e:
        logger.error(f"Failed to parse image quality JSON: {e}. Raw: {text}")
        quality_score = 70.0
        quality_level = "GOOD"
        feedback = ["Please ensure your item is well-centered and clearly visible."]

    # Write to database
    analysis_record = ImageQualityAnalysis(
        product_id=product_id,
        quality_score=quality_score,
        quality_level=quality_level,
        feedback=feedback
    )
    db.add(analysis_record)
    db.commit()
    db.refresh(analysis_record)

    return {
        "id": analysis_record.id,
        "product_id": analysis_record.product_id,
        "quality_score": quality_score,
        "quality_level": quality_level,
        "feedback": feedback,
        "provider": provider
    }
