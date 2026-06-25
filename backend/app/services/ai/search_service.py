from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Dict, List, Any
import json
import logging
from backend.app.models import Listing
from backend.app.config import settings
from backend.app.ai import call_claude_api, get_gemini_model

logger = logging.getLogger(__name__)

def smart_search(db: Session, query: str) -> Dict[str, Any]:
    """
    Parses a natural language search query using AI, executes structured SQL filtering,
    and returns ranked listings with relevance explanations.
    """
    system_prompt = "You are an AI Search Parser for SemesterSwap. Your job is to extract search filters from natural language queries."
    user_prompt = f"""Parse the following natural language search query for marketplace items:
"{query}"

Choose EXACTLY one category from this list if a category is specified (or null if not specified):
Textbooks, Notes, Calculators, Lab Equipment, Electronics, Accessories, Others

Format your response as a JSON object containing:
- "budget": float or null (extracted maximum price limit in INR)
- "category": str or null (the matching category from the list above)
- "brand": str or null (e.g. Casio, Apple, HP)
- "condition": str or null (one of: New, Like New, Good, Acceptable)
- "keywords": list of strings (key search terms to query, e.g. ["laptop", "physics"])
- "specs": list of strings (desired specifications or features, e.g. ["lightweight", "good battery"])

Return ONLY the JSON object. Do not include markdown code block indicators like ```json.
"""

    text = ""
    success = False

    # Attempt Claude
    if settings.ANTHROPIC_API_KEY:
        try:
            logger.info("Attempting search query parsing using Claude...")
            text, _, _ = call_claude_api(system_prompt, user_prompt)
            success = True
        except Exception as e:
            logger.warning(f"Claude search parsing failed: {e}")

    # Fallback to Gemini
    if not success:
        logger.info("Using Gemini Flash for search query parsing...")
        model = get_gemini_model()
        response = model.generate_content(f"{system_prompt}\n\n{user_prompt}")
        text = response.text.strip()

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
        budget = data.get("budget")
        category = data.get("category")
        brand = data.get("brand")
        condition = data.get("condition")
        keywords = list(data.get("keywords", []))
        specs = list(data.get("specs", []))
    except Exception as e:
        logger.error(f"Failed to parse search JSON: {e}. Raw: {text}")
        budget = None
        category = None
        brand = None
        condition = None
        keywords = [w.lower() for w in query.split() if len(w) >= 3]
        specs = []

    # Query DB with active listings
    q = db.query(Listing).filter(Listing.status == "available")
    
    if category:
        q = q.filter(Listing.category == category)
        
    if budget is not None:
        q = q.filter(Listing.price <= float(budget))
        
    if condition:
        q = q.filter(Listing.condition == condition)

    all_listings = q.all()
    results = []

    # Score and rank listings in memory
    for lst in all_listings:
        score = 0
        matches = []
        
        # Brand match (30 pts)
        if brand and brand.lower() in lst.title.lower():
            score += 30
            matches.append(f"Brand '{brand}' matched")
            
        title_lower = lst.title.lower()
        desc_lower = lst.description.lower()
        
        # Keyword matches
        kw_matches = 0
        for kw in keywords:
            if kw.lower() in title_lower:
                score += 15
                kw_matches += 1
            if kw.lower() in desc_lower:
                score += 5
                kw_matches += 1
        if kw_matches > 0:
            matches.append(f"Matched keywords")
                
        # Specs matches
        spec_matches = 0
        for spec in specs:
            if spec.lower() in title_lower or spec.lower() in desc_lower:
                score += 10
                spec_matches += 1
        if spec_matches > 0:
            matches.append(f"Matched specifications")
            
        if not category and any(kw.lower() in lst.category.lower() for kw in keywords):
            score += 10
            
        # Require at least one match to filter out completely irrelevant products
        if keywords and kw_matches == 0 and spec_matches == 0 and (not brand or brand.lower() not in title_lower):
            continue

        results.append((score, matches, lst))

    # Sort descending
    results.sort(key=lambda x: x[0], reverse=True)

    # Explanation construction
    explanation_parts = []
    if category:
        explanation_parts.append(f"Category: {category}")
    if budget:
        explanation_parts.append(f"Price <= ₹{budget}")
    if brand:
        explanation_parts.append(f"Brand: {brand}")
    if specs:
        explanation_parts.append(f"Specs: {', '.join(specs)}")
    if keywords:
        explanation_parts.append(f"Keywords: {', '.join(keywords)}")
    explanation = "Found items matching " + "; ".join(explanation_parts) if explanation_parts else "all campus listings"

    output_listings = []
    for score, matches, lst in results:
        output_listings.append({
            "listing": lst,
            "relevance_score": min(score + 10, 100),
            "explanation": ", ".join(matches) if matches else "Matches search criteria"
        })

    return {
        "explanation": explanation,
        "results": output_listings
    }
