from sqlalchemy.orm import Session
from uuid import UUID
import json
import logging
from typing import Optional, Dict, Any
from backend.app.models import AIGeneratedContent
from backend.app.config import settings
from backend.app.ai import execute_with_failover, validate_description, clean_json_text

logger = logging.getLogger(__name__)

def generate_description(
    db: Session,
    title: str,
    category: str,
    condition: str,
    brand: Optional[str] = None,
    specifications: Optional[str] = None,
    product_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None
) -> Dict[str, Any]:
    """
    Generates optimized title, description, highlights, and selling points using AI.
    Saves details to the database and returns them. Supports failover.
    """
    system_prompt = "You are an AI Listing Assistant for SemesterSwap, a student-exclusive college marketplace."
    user_prompt = f"""Generate a professional, detailed, and highly attractive product listing representation for the following item:
- Title: {title}
- Category: {category}
- Condition: {condition}
- Brand: {brand if brand else 'Not specified'}
- Specifications/Extra details: {specifications if specifications else 'Not specified'}

Format your response as a JSON object containing:
- "improved_title": str (professional, search-optimized title improvement)
- "description": str (clear, honest, student-friendly description text, under 150 words)
- "highlights": list of strings (up to 3 key product features or details, e.g. "Includes original charger", "No highlights or markings")
- "selling_points": list of strings (up to 2 selling arguments, e.g. "Essential for 3rd semester ECE core course", "Highly discounted resale price")

Return ONLY the JSON object. Do not include markdown code block indicators like ```json.
"""

    text, prompt_tokens, completion_tokens, provider = execute_with_failover(
        system_prompt,
        user_prompt,
        db=db,
        user_id=user_id,
        endpoint="/generate-description",
        validator=validate_description
    )
    cleaned = clean_json_text(text)
    try:
        data = json.loads(cleaned)
        improved_title = data.get("improved_title", title)
        generated_desc = data.get("description", "")
        highlights = list(data.get("highlights", []))
        selling_points = list(data.get("selling_points", []))
    except Exception as e:
        logger.error(f"Failed to parse generated description JSON: {e}. Raw: {text}")
        improved_title = f"{title} - {condition}"
        generated_desc = text if text and not text.strip().startswith("{") else f"Listed in category '{category}' in {condition} condition."
        highlights = ["Authentic product swap"]
        selling_points = ["Great student deal"]

    # Save generated content to database
    prompt = f"title={title}|cat={category}|cond={condition}|brand={brand}|specs={specifications}"
    content = AIGeneratedContent(
        product_id=product_id,
        prompt=prompt,
        generated_title=improved_title,
        generated_description=generated_desc
    )
    db.add(content)
    db.commit()
    db.refresh(content)

    return {
        "id": content.id,
        "product_id": content.product_id,
        "improved_title": improved_title,
        "description": generated_desc,
        "highlights": highlights,
        "selling_points": selling_points,
        "provider": provider,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens
    }
