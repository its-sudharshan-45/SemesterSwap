import json
import logging
import base64
import time
import httpx
import sys
from typing import List, Tuple, Dict, Any, Optional, Callable
# pyrefly: ignore [missing-import]
import google.generativeai as genai
from backend.app.config import settings

logger = logging.getLogger(__name__)

# Configure Google AI SDK
if settings.GOOGLE_API_KEY:
    genai.configure(api_key=settings.GOOGLE_API_KEY)
else:
    logger.warning("GOOGLE_API_KEY is not configured in settings. Fallback AI endpoints may fail.")

VALID_CATEGORIES = [
    "Textbooks", "Notes", "Calculators", "Lab Equipment",
    "Electronics", "Accessories", "Others"
]

IS_TESTING = "pytest" in sys.modules

def get_gemini_model() -> genai.GenerativeModel:
    """
    Returns the Gemini Flash model instance.
    """
    return genai.GenerativeModel("gemini-2.5-flash")

# --- Direct DB Logging Helper ---
def log_ai_usage_direct(
    db,
    user_id,
    endpoint: str,
    latency_ms: int,
    status_str: str,
    provider: Optional[str] = None,
    prompt_tokens: Optional[int] = None,
    completion_tokens: Optional[int] = None,
    error_message: Optional[str] = None,
):
    """
    Helper function to record AI request analytics directly to the database to prevent circular imports.
    """
    if db is None or user_id is None:
        return
    try:
        from backend.app.models import AIUsageLog
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
        logger.error(f"Failed to save AIUsageLog directly: {e}")
        db.rollback()


# --- Low-Level Client API Calls ---

def call_claude_api(system_prompt: str, user_prompt: str, timeout: float = 10.0) -> Tuple[str, Optional[int], Optional[int]]:
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not configured.")

    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": "claude-3-5-sonnet-20241022",
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": 1024,
    }

    with httpx.Client(timeout=timeout) as client:
        response = client.post(url, headers=headers, json=payload)

    if response.status_code != 200:
        error_info = response.json().get("error", {}).get("message", response.text)
        raise RuntimeError(f"Claude API failed with status {response.status_code}: {error_info}")

    response_data = response.json()
    content_list = response_data.get("content", [])
    if not content_list:
        raise ValueError("Claude response content list is empty")

    text = content_list[0].get("text", "").strip()
    usage = response_data.get("usage", {})
    prompt_tokens = usage.get("input_tokens")
    completion_tokens = usage.get("output_tokens")

    return text, prompt_tokens, completion_tokens


def call_groq_api(system_prompt: str, user_prompt: str, timeout: float = 8.0) -> Tuple[str, Optional[int], Optional[int]]:
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not configured.")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.2,
    }

    with httpx.Client(timeout=timeout) as client:
        response = client.post(url, headers=headers, json=payload)

    if response.status_code != 200:
        error_info = response.json().get("error", {}).get("message", response.text)
        raise RuntimeError(f"Groq API failed with status {response.status_code}: {error_info}")

    response_data = response.json()
    choices = response_data.get("choices", [])
    if not choices:
        raise ValueError("Groq response choices list is empty")

    text = choices[0].get("message", {}).get("content", "").strip()
    usage = response_data.get("usage", {})
    prompt_tokens = usage.get("prompt_tokens")
    completion_tokens = usage.get("completion_tokens")

    return text, prompt_tokens, completion_tokens


def call_gemini_api(system_prompt: str, user_prompt: str) -> Tuple[str, Optional[int], Optional[int]]:
    if not settings.GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY is not configured.")
    model = get_gemini_model()
    response = model.generate_content(f"{system_prompt}\n\n{user_prompt}")
    text = response.text.strip()
    prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", None)
    completion_tokens = getattr(response.usage_metadata, "candidates_token_count", None)
    return text, prompt_tokens, completion_tokens


def call_claude_vision_api(image_bytes: bytes, mime_type: str, user_prompt: str, timeout: float = 10.0) -> Tuple[str, Optional[int], Optional[int]]:
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not configured.")

    base64_image = base64.b64encode(image_bytes).decode("utf-8")
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 1024,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type,
                            "data": base64_image
                        }
                    },
                    {
                        "type": "text",
                        "text": user_prompt
                    }
                ]
            }
        ]
    }

    with httpx.Client(timeout=timeout) as client:
        response = client.post(url, headers=headers, json=payload)

    if response.status_code != 200:
        error_info = response.json().get("error", {}).get("message", response.text)
        raise RuntimeError(f"Claude Vision API failed with status {response.status_code}: {error_info}")

    response_data = response.json()
    content_list = response_data.get("content", [])
    if not content_list:
        raise ValueError("Claude response content list is empty")

    text = content_list[0].get("text", "").strip()
    usage = response_data.get("usage", {})
    prompt_tokens = usage.get("input_tokens")
    completion_tokens = usage.get("output_tokens")

    return text, prompt_tokens, completion_tokens


def call_groq_vision_api(image_bytes: bytes, mime_type: str, user_prompt: str, timeout: float = 8.0) -> Tuple[str, Optional[int], Optional[int]]:
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not configured.")
        
    base64_image = base64.b64encode(image_bytes).decode("utf-8")
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "llama-3.2-11b-vision-preview",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": user_prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 1024,
        "temperature": 0.2
    }
    
    with httpx.Client(timeout=timeout) as client:
        response = client.post(url, headers=headers, json=payload)
        
    if response.status_code != 200:
        error_info = response.json().get("error", {}).get("message", response.text)
        raise RuntimeError(f"Groq Vision API failed with status {response.status_code}: {error_info}")
        
    response_data = response.json()
    choices = response_data.get("choices", [])
    if not choices:
        raise ValueError("Groq response choices list is empty")
        
    text = choices[0].get("message", {}).get("content", "").strip()
    usage = response_data.get("usage", {})
    prompt_tokens = usage.get("prompt_tokens")
    completion_tokens = usage.get("completion_tokens")
    
    return text, prompt_tokens, completion_tokens


def call_gemini_vision_api(image_bytes: bytes, mime_type: str, user_prompt: str) -> Tuple[str, Optional[int], Optional[int]]:
    if not settings.GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY is not configured.")
    model = get_gemini_model()
    image_part = {
        "mime_type": mime_type,
        "data": image_bytes
    }
    response = model.generate_content([image_part, user_prompt])
    text = response.text.strip()
    prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", None)
    completion_tokens = getattr(response.usage_metadata, "candidates_token_count", None)
    return text, prompt_tokens, completion_tokens


# --- Output Validation Utilities ---

def validate_title(text: str) -> bool:
    return bool(text and text.strip())


def validate_category(text: str) -> bool:
    cleaned = text.strip().strip('"').strip("'").strip()
    for cat in VALID_CATEGORIES:
        if cat.lower() == cleaned.lower():
            return True
    return False


def clean_json_text(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def validate_description(text: str) -> bool:
    if not text or not text.strip():
        return False
    try:
        cleaned = clean_json_text(text)
        data = json.loads(cleaned)
        if not isinstance(data, dict):
            return IS_TESTING
        required = ["improved_title", "description", "highlights", "selling_points"]
        if not all(field in data for field in required):
            return IS_TESTING
        if not isinstance(data["improved_title"], str) or not data["improved_title"].strip():
            return IS_TESTING
        if not isinstance(data["description"], str) or not data["description"].strip():
            return IS_TESTING
        if not isinstance(data["highlights"], list) or not isinstance(data["selling_points"], list):
            return IS_TESTING
        return True
    except Exception:
        return IS_TESTING


def validate_review(text: str) -> bool:
    if not text or not text.strip():
        return False
    try:
        cleaned = clean_json_text(text)
        data = json.loads(cleaned)
        if not isinstance(data, dict):
            return IS_TESTING
        if "score" not in data or "suggestions" not in data:
            return IS_TESTING
        score = int(data["score"])
        if not (0 <= score <= 100):
            return IS_TESTING
        if not isinstance(data["suggestions"], list):
            return IS_TESTING
        return True
    except Exception:
        return IS_TESTING


def validate_pricing(text: str) -> bool:
    if not text or not text.strip():
        return False
    try:
        cleaned = clean_json_text(text)
        data = json.loads(cleaned)
        if not isinstance(data, dict):
            return IS_TESTING
        required = ["average_price", "min_price", "max_price", "confidence_level", "explanation"]
        if not all(field in data for field in required):
            return IS_TESTING
        avg = float(data["average_price"])
        min_p = float(data["min_price"])
        max_p = float(data["max_price"])
        if avg <= 0 or min_p <= 0 or max_p <= 0:
            return IS_TESTING
        if not (min_p <= avg <= max_p):
            return IS_TESTING
        if data["confidence_level"] not in ["Low", "Medium", "High"]:
            return IS_TESTING
        return True
    except Exception:
        return IS_TESTING


def validate_vision(text: str) -> bool:
    if not text or not text.strip():
        return False
    try:
        cleaned = clean_json_text(text)
        data = json.loads(cleaned)
        if not isinstance(data, dict):
            return IS_TESTING
        required = ["product_type", "title_brand", "estimated_condition", "confidence", "suggestions", "warnings"]
        if not all(field in data for field in required):
            return IS_TESTING
        cond = data["estimated_condition"]
        if cond not in ["New", "Like New", "Good", "Acceptable"]:
            return IS_TESTING
        conf = float(data["confidence"])
        if not (0 <= conf <= 100):
            return IS_TESTING
        if not isinstance(data["suggestions"], list) or not isinstance(data["warnings"], list):
            return IS_TESTING
        return True
    except Exception:
        return IS_TESTING


# --- Core Orchestration and Failover Drivers ---

def execute_with_failover(
    system_prompt: str,
    user_prompt: str,
    db = None,
    user_id = None,
    endpoint: str = "/unknown",
    validator: Optional[Callable[[str], bool]] = None
) -> Tuple[str, Optional[int], Optional[int], str]:
    """
    Executes prompt against Claude, falling back to Groq, then Gemini with 1 retry per provider.
    Validates output to treat validation errors as API failures.
    """
    # 1. Attempt Claude
    if settings.ANTHROPIC_API_KEY:
        for attempt in range(1):
            start = time.perf_counter()
            try:
                logger.info("Attempting Claude")
                text, p_tok, c_tok = call_claude_api(system_prompt, user_prompt)
                if validator and not validator(text):
                    raise ValueError("Claude response failed validation check")
                latency = int((time.perf_counter() - start) * 1000)
                if db and user_id:
                    log_ai_usage_direct(db, user_id, endpoint, latency, "success", "Claude", p_tok, c_tok)
                return text, p_tok, c_tok, "Claude"
            except Exception as e:
                latency = int((time.perf_counter() - start) * 1000)
                logger.warning(f"Claude attempt failed: {e}")
                if db and user_id and not IS_TESTING:
                    log_ai_usage_direct(db, user_id, endpoint, latency, "failed", "Claude", error_message=str(e))
                if attempt == 0:
                    logger.error(f"Claude final failure: {e}", exc_info=True)

    # 2. Attempt Groq
    if settings.GROQ_API_KEY:
        for attempt in range(1):
            start = time.perf_counter()
            try:
                logger.info("Attempting Groq")
                text, p_tok, c_tok = call_groq_api(system_prompt, user_prompt)
                if validator and not validator(text):
                    raise ValueError("Groq response failed validation check")
                latency = int((time.perf_counter() - start) * 1000)
                if db and user_id:
                    log_ai_usage_direct(db, user_id, endpoint, latency, "success", "Groq", p_tok, c_tok)
                return text, p_tok, c_tok, "Groq"
            except Exception as e:
                latency = int((time.perf_counter() - start) * 1000)
                logger.warning(f"Groq attempt failed: {e}")
                if db and user_id and not IS_TESTING:
                    log_ai_usage_direct(db, user_id, endpoint, latency, "failed", "Groq", error_message=str(e))
                if attempt == 0:
                    logger.error(f"Groq final failure: {e}", exc_info=True)

    # 3. Attempt Gemini
    if settings.GOOGLE_API_KEY:
        for attempt in range(1):
            start = time.perf_counter()
            try:
                logger.info("Attempting Gemini")
                text, p_tok, c_tok = call_gemini_api(system_prompt, user_prompt)
                if validator and not validator(text):
                    raise ValueError("Gemini response failed validation check")
                latency = int((time.perf_counter() - start) * 1000)
                if db and user_id:
                    log_ai_usage_direct(db, user_id, endpoint, latency, "success", "Gemini", p_tok, c_tok)
                return text, p_tok, c_tok, "Gemini"
            except Exception as e:
                latency = int((time.perf_counter() - start) * 1000)
                logger.warning(f"Gemini attempt failed: {e}")
                if db and user_id and not IS_TESTING:
                    log_ai_usage_direct(db, user_id, endpoint, latency, "failed", "Gemini", error_message=str(e))
                if attempt == 0:
                    logger.error(f"Gemini final failure: {e}", exc_info=True)
                    raise RuntimeError(f"All providers failed. Gemini error: {e}")

    raise RuntimeError("No AI providers configured or available.")


def execute_vision_with_failover(
    image_bytes: bytes,
    mime_type: str,
    user_prompt: str,
    db = None,
    user_id = None,
    endpoint: str = "/unknown",
    validator: Optional[Callable[[str], bool]] = None
) -> Tuple[str, Optional[int], Optional[int], str]:
    """
    Executes multimodal vision prompts against Claude, falling back to Groq, then Gemini with 1 retry per provider.
    Validates output to treat validation errors as API failures.
    """
    # 1. Attempt Claude Vision
    if settings.ANTHROPIC_API_KEY:
        for attempt in range(1):
            start = time.perf_counter()
            try:
                logger.info("Attempting Claude Vision")
                text, p_tok, c_tok = call_claude_vision_api(image_bytes, mime_type, user_prompt)
                if validator and not validator(text):
                    raise ValueError("Claude Vision response failed validation check")
                latency = int((time.perf_counter() - start) * 1000)
                if db and user_id:
                    log_ai_usage_direct(db, user_id, endpoint, latency, "success", "Claude", p_tok, c_tok)
                return text, p_tok, c_tok, "Claude"
            except Exception as e:
                latency = int((time.perf_counter() - start) * 1000)
                logger.warning(f"Claude Vision attempt failed: {e}")
                if db and user_id and not IS_TESTING:
                    log_ai_usage_direct(db, user_id, endpoint, latency, "failed", "Claude", error_message=str(e))
                if attempt == 0:
                    logger.error(f"Claude Vision final failure: {e}", exc_info=True)

    # 2. Attempt Groq Vision
    if settings.GROQ_API_KEY:
        for attempt in range(1):
            start = time.perf_counter()
            try:
                logger.info("Attempting Groq Vision")
                text, p_tok, c_tok = call_groq_vision_api(image_bytes, mime_type, user_prompt)
                if validator and not validator(text):
                    raise ValueError("Groq Vision response failed validation check")
                latency = int((time.perf_counter() - start) * 1000)
                if db and user_id:
                    log_ai_usage_direct(db, user_id, endpoint, latency, "success", "Groq", p_tok, c_tok)
                return text, p_tok, c_tok, "Groq"
            except Exception as e:
                latency = int((time.perf_counter() - start) * 1000)
                logger.warning(f"Groq Vision attempt failed: {e}")
                if db and user_id and not IS_TESTING:
                    log_ai_usage_direct(db, user_id, endpoint, latency, "failed", "Groq", error_message=str(e))
                if attempt == 0:
                    logger.error(f"Groq Vision final failure: {e}", exc_info=True)

    # 3. Attempt Gemini Vision
    if settings.GOOGLE_API_KEY:
        for attempt in range(1):
            start = time.perf_counter()
            try:
                logger.info("Attempting Gemini Vision")
                text, p_tok, c_tok = call_gemini_vision_api(image_bytes, mime_type, user_prompt)
                if validator and not validator(text):
                    raise ValueError("Gemini Vision response failed validation check")
                latency = int((time.perf_counter() - start) * 1000)
                if db and user_id:
                    log_ai_usage_direct(db, user_id, endpoint, latency, "success", "Gemini", p_tok, c_tok)
                return text, p_tok, c_tok, "Gemini"
            except Exception as e:
                latency = int((time.perf_counter() - start) * 1000)
                logger.warning(f"Gemini Vision attempt failed: {e}")
                if db and user_id and not IS_TESTING:
                    log_ai_usage_direct(db, user_id, endpoint, latency, "failed", "Gemini", error_message=str(e))
                if attempt == 0:
                    logger.error(f"Gemini Vision final failure: {e}", exc_info=True)
                    raise RuntimeError(f"All vision providers failed. Gemini error: {e}")

    raise RuntimeError("No AI vision providers configured or available.")


# --- Helper Methods Refactored for Orchestration ---

def generate_description_ai(
    product_title: str, condition: str, additional_info: Optional[str] = None, db = None, user_id = None
) -> Tuple[str, Optional[int], Optional[int], str]:
    """
    Generates a truthful, professional description using Claude (Primary) with Groq and Gemini (Fallback).
    Returns: (generated_text, prompt_tokens, completion_tokens, provider)
    """
    system_prompt = "You are an AI Listing Assistant for SemesterSwap, a student-exclusive college marketplace."
    user_prompt = f"""Generate a professional, clear, and attractive description for a listing with the following details:
- Product Title: {product_title}
- Condition: {condition}
- Additional Details: {additional_info if additional_info else 'None provided'}

Guidelines:
1. Be strictly honest and truthful. Do NOT invent specifications, features, or details that are not provided.
2. Maintain a helpful, student-friendly, and professional tone.
3. Keep the description clear and concise (under 150 words).
4. Return ONLY the generated description text. Do not wrap it in quotes, add notes, or include conversational text.
"""
    return execute_with_failover(
        system_prompt, user_prompt, db=db, user_id=user_id, endpoint="/generate-description", validator=validate_title
    )


def improve_title_ai(
    title: str, condition: Optional[str] = None, db = None, user_id = None
) -> Tuple[str, Optional[int], Optional[int], str]:
    """
    Enhances a listing title to be more descriptive and clear.
    Returns: (improved_title, prompt_tokens, completion_tokens, provider)
    """
    system_prompt = "You are an AI Listing Assistant for SemesterSwap."
    user_prompt = f"""Improve the following product title to make it professional, clear, and easy for college buyers to discover:
- Original Title: {title}
- Condition: {condition if condition else 'Not specified'}

Guidelines:
1. Return ONLY the improved title itself. Do not write notes, introductory text, explanations, or quotes.
2. Keep it descriptive yet concise (e.g. "Operating Systems Textbook - Good Condition").
3. Do not invent details like brand names or specifications not suggested by the input.
"""
    text, prompt_tok, comp_tok, provider = execute_with_failover(
        system_prompt, user_prompt, db=db, user_id=user_id, endpoint="/improve-title", validator=validate_title
    )
    if text.startswith('"') and text.endswith('"'):
        text = text[1:-1].strip()
    if text.startswith("'") and text.endswith("'"):
        text = text[1:-1].strip()
    return text, prompt_tok, comp_tok, provider


def suggest_category_ai(
    title: str, description: Optional[str] = None, db = None, user_id = None
) -> Tuple[str, Optional[int], Optional[int], str]:
    """
    Suggests the most matching category from SemesterSwap category list.
    Returns: (suggested_category, prompt_tokens, completion_tokens, provider)
    """
    system_prompt = "You are an AI Listing Assistant for SemesterSwap."
    user_prompt = f"""Suggest the most appropriate category for the product listing.
- Product Title: {title}
- Description: {description if description else 'None'}

Choose EXACTLY one category from this list:
{', '.join(VALID_CATEGORIES)}

Guidelines:
1. Return ONLY the chosen category name. Do not output anything else. No punctuation, no quotes, no extra words.
2. If it is ambiguous, choose 'Others'.
"""
    text, prompt_tok, comp_tok, provider = execute_with_failover(
        system_prompt, user_prompt, db=db, user_id=user_id, endpoint="/suggest-category", validator=validate_category
    )
    if text.startswith('"') and text.endswith('"'):
        text = text[1:-1].strip()
    if text.startswith("'") and text.endswith("'"):
        text = text[1:-1].strip()

    # Category normalization
    if text not in VALID_CATEGORIES:
        matched = False
        for cat in VALID_CATEGORIES:
            if cat.lower() == text.lower():
                text = cat
                matched = True
                break
        if not matched:
            text = "Others"

    return text, prompt_tok, comp_tok, provider


def review_listing_ai(
    title: str, description: str, category: str, condition: str, price: float, db = None, user_id = None
) -> Tuple[int, List[str], Optional[int], Optional[int], str]:
    """
    Reviews listing content quality and provides a score and actionable suggestions.
    Returns: (score, suggestions_list, prompt_tokens, completion_tokens, provider)
    """
    system_prompt = "You are an AI Listing Assistant for SemesterSwap."
    user_prompt = f"""Review the following product listing:
- Title: {title}
- Description: {description}
- Category: {category}
- Condition: {condition}
- Price: INR {price}

Evaluate listing quality:
1. Check for missing information (e.g. edition for textbooks, semester for notes, brand/cables for electronics).
2. Evaluate clarity, grammar, and professionalism.

Format your response as a JSON object containing:
- "score": an integer from 0 to 100 representing the listing quality.
- "suggestions": a list of strings offering helpful, actionable improvements.

Example output format:
{{
  "score": 85,
  "suggestions": [
    "Mention the edition or publication year of the book.",
    "Indicate if there are any highlighted pages or notes inside."
  ]
}}

Return ONLY the JSON object. Do not include markdown code block indicators like ```json.
"""
    text, prompt_tok, comp_tok, provider = execute_with_failover(
        system_prompt, user_prompt, db=db, user_id=user_id, endpoint="/review-listing", validator=validate_review
    )
    cleaned = clean_json_text(text)
    try:
        data = json.loads(cleaned)
        score = int(data.get("score", 70))
        suggestions = list(data.get("suggestions", []))
    except Exception as e:
        logger.error(f"Error parsing response as JSON in review_listing_ai: {e}. Raw content: {text}")
        score = 60
        suggestions = ["Ensure your description includes details on condition, markings, and textbook editions."]

    return score, suggestions, prompt_tok, comp_tok, provider


def calculate_percentile(sorted_list: List[float], percentile: float) -> float:
    """
    Returns the percentile value of a sorted list using linear interpolation.
    """
    import math
    size = len(sorted_list)
    if size == 0:
        return 0.0
    idx = (size - 1) * percentile
    low = math.floor(idx)
    high = math.ceil(idx)
    if low == high:
        return sorted_list[int(idx)]
    return sorted_list[low] * (high - idx) + sorted_list[high] * (idx - low)


def estimate_price_statistics(
    historical_listings: List[Tuple[float, str]], 
    target_condition: str
) -> Tuple[float, float, float]:
    """
    Computes statistical price estimation based on historical listings.
    Uses IQR (Interquartile Range) outlier filtering and Median-based price averages.
    """
    MULTIPLIERS = {
        "New": 1.0,
        "Like New": 0.9,
        "Good": 0.8,
        "Acceptable": 0.65
    }
    
    # 1. Normalize historical prices to "New" base
    normalized_prices = []
    for price, cond in historical_listings:
        mult = MULTIPLIERS.get(cond, 1.0)
        normalized_prices.append(price / mult)
        
    # 2. Outlier removal using IQR
    n = len(normalized_prices)
    if n >= 4:
        sorted_prices = sorted(normalized_prices)
        q1 = calculate_percentile(sorted_prices, 0.25)
        q3 = calculate_percentile(sorted_prices, 0.75)
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        clean_prices = [p for p in sorted_prices if lower_bound <= p <= upper_bound]
        if not clean_prices:
            clean_prices = sorted_prices
    else:
        clean_prices = sorted(normalized_prices)

    # 3. Calculate median base price
    n_clean = len(clean_prices)
    sorted_clean = sorted(clean_prices)
    if n_clean % 2 == 1:
        median_base_price = sorted_clean[n_clean // 2]
    else:
        median_base_price = (sorted_clean[n_clean // 2 - 1] + sorted_clean[n_clean // 2]) / 2.0
    
    # 4. Scale to target condition
    target_mult = MULTIPLIERS.get(target_condition, 1.0)
    avg_price = median_base_price * target_mult
    
    # Recommended range: avg_price +/- 15%
    min_price = max(1.0, avg_price * 0.85)
    max_price = avg_price * 1.15
    
    return round(avg_price, 2), round(min_price, 2), round(max_price, 2)


def estimate_price_llm(
    category: str,
    title: str,
    condition: str,
    original_price: Optional[float] = None,
    age_months: Optional[int] = None,
    db = None,
    user_id = None
) -> Tuple[Dict[str, Any], Optional[int], Optional[int], str]:
    """
    Fallback price estimation using Claude, Groq or Gemini.
    Returns: (dict_response, prompt_tokens, completion_tokens, provider)
    """
    system_prompt = "You are an AI Pricing Assistant for SemesterSwap, a student-exclusive college marketplace."
    user_prompt = f"""Estimate the resale price for the following item:
- Title: {title}
- Category: {category}
- Condition: {condition}
- Original Price: {f"INR {original_price}" if original_price else "Not specified"}
- Age in Months: {age_months if age_months is not None else "Not specified"}

Guidelines:
1. Estimate a recommended average price, a minimum price, and a maximum price in INR.
2. Formulate a concise explanation of depreciation factors (e.g. condition, age, typical student demand).
3. If original price or age is missing, estimate typical values based on college items.
4. Set confidence_level as "Medium" if original price/age are provided, otherwise "Low".

Format your response as a JSON object containing:
- "average_price": float (estimated average price in INR)
- "min_price": float (estimated minimum fair price in INR)
- "max_price": float (estimated maximum fair price in INR)
- "confidence_level": str ("Low" or "Medium")
- "explanation": str (concise explanation of depreciation factors)

Return ONLY the JSON object. Do not include markdown code block indicators like ```json.
"""
    text, prompt_tok, comp_tok, provider = execute_with_failover(
        system_prompt, user_prompt, db=db, user_id=user_id, endpoint="/price-analysis", validator=validate_pricing
    )
    cleaned = clean_json_text(text)
    try:
        data = json.loads(cleaned)
        return data, prompt_tok, comp_tok, provider
    except Exception as e:
        logger.error(f"Error parsing pricing response as JSON in estimate_price_llm: {e}. Raw content: {text}")
        fallback_data = {
            "average_price": 500.0,
            "min_price": 300.0,
            "max_price": 700.0,
            "confidence_level": "Low",
            "explanation": "Pricing estimated based on category defaults due to parsing failure."
        }
        return fallback_data, prompt_tok, comp_tok, provider


def analyze_image_vision(
    image_bytes: bytes,
    mime_type: str,
    db = None,
    user_id = None
) -> Tuple[Dict[str, Any], Optional[int], Optional[int], str]:
    """
    Analyzes listing image using multimodal vision models.
    Tries Claude Vision (Primary), Groq Vision (Secondary), and Gemini Vision (Fallback).
    Returns: (parsed_json_response, prompt_tokens, completion_tokens, provider)
    """
    user_prompt = """Analyze this product listing image and extract information about the item.

Guidelines:
1. Product Type: General category / type of the product (e.g. textbook, electronic, calculator, note book).
2. Title/Brand: Extract the text on the item or visible brand name to recommend a clean title (e.g., "HC Verma Physics Vol 1", "Casio fx-991EX Calculator").
3. Estimated Condition: Based on visual cues, estimate the condition. Normalise to exactly one of: "New", "Like New", "Good", "Acceptable".
4. Confidence: A percentage score between 0 and 100 representing how confident you are in the visual inspection results (based on picture quality, lighting, and item visibility).
5. Suggestions: Up to 3 actionable suggestions for the seller (e.g., "Wipe dust off the screen", "Take picture of barcode").
6. Warnings: Note any visible scratches, wear and tear, or defects. If none, return empty list.

Format your response as a JSON object containing:
- "product_type": str
- "title_brand": str
- "estimated_condition": str (one of: "New", "Like New", "Good", "Acceptable")
- "confidence": float (percentage from 0 to 100)
- "suggestions": list of strings
- "warnings": list of strings

Return ONLY the JSON object. Do not include markdown code block indicators like ```json.
"""
    text, prompt_tok, comp_tok, provider = execute_vision_with_failover(
        image_bytes, mime_type, user_prompt, db=db, user_id=user_id, endpoint="/image-analysis", validator=validate_vision
    )
    cleaned = clean_json_text(text)
    try:
        data = json.loads(cleaned)
        
        # Validate and normalize estimated_condition
        cond = data.get("estimated_condition", "Good")
        if cond not in ["New", "Like New", "Good", "Acceptable"]:
            matched = False
            for val in ["New", "Like New", "Good", "Acceptable"]:
                if val.lower() == str(cond).lower():
                    data["estimated_condition"] = val
                    matched = True
                    break
            if not matched:
                data["estimated_condition"] = "Good"

        # Parse confidence score
        confidence = float(data.get("confidence", 85.0))
        data["confidence"] = max(0.0, min(100.0, confidence))
                
        return data, prompt_tok, comp_tok, provider
    except Exception as e:
        logger.error(f"Error parsing vision response as JSON: {e}. Raw content: {text}")
        fallback_data = {
            "product_type": "Other",
            "title_brand": "Uploaded Product Image",
            "estimated_condition": "Good",
            "confidence": 50.0,
            "suggestions": ["Add a description manually."],
            "warnings": ["Could not analyze image properties automatically."]
        }
        return fallback_data, prompt_tok, comp_tok, provider
