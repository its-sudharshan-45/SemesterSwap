import json
import uuid
from unittest.mock import patch, MagicMock
# pyrefly: ignore [missing-import]
import pytest
from backend.app.models import User, AIUsageLog, Listing, ListingView, SearchHistory, RecommendationLog
from backend.app.ai_router import user_requests
from backend.app.config import settings

# Mock classes for Gemini API response
class MockUsageMetadata:
    def __init__(self, prompt=15, completion=25):
        self.prompt_token_count = prompt
        self.candidates_token_count = completion

class MockGeminiResponse:
    def __init__(self, text, prompt=15, completion=25):
        self.text = text
        self.usage_metadata = MockUsageMetadata(prompt, completion)

# Mock class for Anthropic Claude API response
class MockClaudeResponse:
    def __init__(self, json_data, status_code=200):
        self._json_data = json_data
        self.status_code = status_code
        self.text = json.dumps(json_data)

    def json(self):
        return self._json_data


def create_test_user(db_session, generate_jwt, client, email="ai_student@kpriet.ac.in", name="AI Student"):
    auth_id = str(uuid.uuid4())
    token = generate_jwt(auth_id=auth_id, email=email, full_name=name)
    headers = {"Authorization": f"Bearer {token}"}
    client.get("/api/v1/users/me", headers=headers)
    user = db_session.query(User).filter(User.email == email).first()
    return user, headers


@patch("backend.app.ai.httpx.Client")
def test_generate_description_claude_success(mock_http_client, client, generate_jwt, db_session):
    """
    Verify description generation succeeds using Claude when primary key is active.
    """
    settings.ANTHROPIC_API_KEY = "sk-test-anthropic-key"
    user, headers = create_test_user(db_session, generate_jwt, client)

    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockClaudeResponse({
        "content": [{"type": "text", "text": "Claude description generated textbook."}],
        "usage": {"input_tokens": 10, "output_tokens": 20}
    }, status_code=200)

    payload = {
        "product_title": "Operating Systems Book",
        "condition": "Good",
        "additional_info": "Few pencil markings"
    }

    response = client.post("/api/v1/ai/generate-description", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "description" in data
    assert "Claude description" in data["description"]

    log = db_session.query(AIUsageLog).filter(AIUsageLog.user_id == user.id).first()
    assert log is not None
    assert log.endpoint == "/generate-description"
    assert log.status == "success"
    assert log.prompt_tokens == 10
    assert log.completion_tokens == 20


@patch("backend.app.ai.httpx.Client")
@patch("google.generativeai.GenerativeModel.generate_content")
def test_generate_description_claude_fails_fallback_gemini(mock_gemini, mock_http_client, client, generate_jwt, db_session):
    """
    Verify description generation falls back to Gemini when Claude fails.
    """
    settings.ANTHROPIC_API_KEY = "sk-test-anthropic-key"
    settings.GROQ_API_KEY = None
    user, headers = create_test_user(db_session, generate_jwt, client, email="fallback@kpriet.ac.in")

    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockClaudeResponse({
        "error": {"message": "Your credit balance is too low"}
    }, status_code=400)

    mock_gemini.return_value = MockGeminiResponse(
        "Gemini description fallback textbook."
    )

    payload = {
        "product_title": "Operating Systems Book",
        "condition": "Good"
    }

    response = client.post("/api/v1/ai/generate-description", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "description" in data
    assert "Gemini description fallback" in data["description"]

    log = db_session.query(AIUsageLog).filter(AIUsageLog.user_id == user.id).first()
    assert log is not None
    assert log.endpoint == "/generate-description"
    assert log.status == "success"
    assert log.prompt_tokens == 15
    assert log.completion_tokens == 25


@patch("google.generativeai.GenerativeModel.generate_content")
def test_generate_description_gemini_direct_when_no_claude_key(mock_gemini, client, generate_jwt, db_session):
    """
    Verify description generation goes directly to Gemini when Claude API Key is not set.
    """
    settings.ANTHROPIC_API_KEY = None
    settings.GROQ_API_KEY = None
    user, headers = create_test_user(db_session, generate_jwt, client, email="noclau@kpriet.ac.in")

    mock_gemini.return_value = MockGeminiResponse("Direct Gemini textbook.")

    payload = {
        "product_title": "Operating Systems Book",
        "condition": "Good"
    }

    response = client.post("/api/v1/ai/generate-description", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["description"] == "Direct Gemini textbook."


@patch("backend.app.ai.httpx.Client")
def test_improve_title_claude_success(mock_http_client, client, generate_jwt, db_session):
    """
    Verify title improvement using Claude.
    """
    settings.ANTHROPIC_API_KEY = "sk-test-anthropic-key"
    user, headers = create_test_user(db_session, generate_jwt, client, email="title@kpriet.ac.in")

    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockClaudeResponse({
        "content": [{"type": "text", "text": "Operating Systems Textbook - Good Condition"}],
        "usage": {"input_tokens": 8, "output_tokens": 12}
    }, status_code=200)

    payload = {
        "title": "OS Book",
        "condition": "Good"
    }

    response = client.post("/api/v1/ai/improve-title", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["improved_title"] == "Operating Systems Textbook - Good Condition"


@patch("backend.app.ai.httpx.Client")
def test_suggest_category_claude_success(mock_http_client, client, generate_jwt, db_session):
    """
    Verify category suggestions map to correct taxonomies.
    """
    settings.ANTHROPIC_API_KEY = "sk-test-anthropic-key"
    user, headers = create_test_user(db_session, generate_jwt, client, email="cat@kpriet.ac.in")

    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockClaudeResponse({
        "content": [{"type": "text", "text": "Calculators"}],
        "usage": {"input_tokens": 5, "output_tokens": 5}
    }, status_code=200)

    payload = {
        "title": "HP Scientific Calculator"
    }

    response = client.post("/api/v1/ai/suggest-category", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["category"] == "Calculators"


@patch("backend.app.ai.httpx.Client")
def test_review_listing_claude_success(mock_http_client, client, generate_jwt, db_session):
    """
    Verify listing checker gives correct score and suggestions using Claude.
    """
    settings.ANTHROPIC_API_KEY = "sk-test-anthropic-key"
    user, headers = create_test_user(db_session, generate_jwt, client, email="review@kpriet.ac.in")

    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockClaudeResponse({
        "content": [{"type": "text", "text": '{"score": 90, "suggestions": ["Mention condition markings"]}'}],
        "usage": {"input_tokens": 15, "output_tokens": 20}
    }, status_code=200)

    payload = {
        "title": "OS Book",
        "description": "Good book",
        "category": "Textbooks",
        "condition": "Good",
        "price": 300.0
    }

    response = client.post("/api/v1/ai/review-listing", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["score"] == 90
    assert "markings" in data["suggestions"][0]


@patch("backend.app.ai.httpx.Client")
def test_ai_rate_limiting(mock_http_client, client, generate_jwt, db_session):
    """
    Verify in-memory rate limiting rejects users exceeding 5 requests per minute.
    """
    user_requests.clear()
    settings.ANTHROPIC_API_KEY = "sk-test-anthropic-key"
    user, headers = create_test_user(db_session, generate_jwt, client, email="rate_limit@kpriet.ac.in")

    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockClaudeResponse({
        "content": [{"type": "text", "text": "Success response"}],
        "usage": {"input_tokens": 10, "output_tokens": 10}
    }, status_code=200)

    payload = {
        "title": "Calculator",
        "condition": "New"
    }

    # Send 5 requests (succeed)
    for _ in range(5):
        response = client.post("/api/v1/ai/improve-title", json=payload, headers=headers)
        assert response.status_code == 200

    # 6th request fails with HTTP 429
    response = client.post("/api/v1/ai/improve-title", json=payload, headers=headers)
    assert response.status_code == 429
    assert "Rate limit exceeded" in response.json()["detail"]


def test_ai_unauthenticated_fails(client):
    """
    Verify guest/unauthenticated users are rejected.
    """
    payload = {
        "title": "Some Product",
        "condition": "New"
    }
    response = client.post("/api/v1/ai/improve-title", json=payload)
    assert response.status_code == 401


def test_estimate_price_statistics_direct():
    from backend.app.ai import estimate_price_statistics
    # Test price normalization, outlier IQR filter, and scaling
    listings = [
        (100.0, "New"),        # normalized: 100.0
        (100.0, "New"),        # normalized: 100.0
        (100.0, "New"),        # normalized: 100.0
        (90.0, "Like New"),    # normalized: 100.0
        (80.0, "Good"),        # normalized: 100.0
        (65.0, "Acceptable"),  # normalized: 100.0
        (1000.0, "New")        # normalized: 1000.0 (outlier, IQR filter)
    ]
    avg_p, min_p, max_p = estimate_price_statistics(listings, "Good")
    assert avg_p == 80.0
    assert min_p == 68.0
    assert max_p == 92.0


def test_price_analysis_historical_success(client, generate_jwt, db_session):
    user, headers = create_test_user(db_session, generate_jwt, client, email="price_hist@kpriet.ac.in")
    
    # Create 5 historical listings in category "Calculators" with condition "New" and price 1000
    for i in range(5):
        lst = Listing(
            id=uuid.uuid4(),
            seller_id=user.id,
            title="Scientific Calculator",
            description="Casio calculator",
            category="Calculators",
            condition="New",
            price=1000.0,
            images=["image.jpg"]
        )
        db_session.add(lst)
    db_session.commit()
    
    payload = {
        "category": "Calculators",
        "title": "Scientific Calculator",
        "condition": "Good",
        "original_price": 1200.0,
        "age_months": 3
    }
    
    response = client.post("/api/v1/ai/price-analysis", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["method"] == "historical_statistics"
    assert data["confidence_level"] == "Medium"
    assert data["average_price"] == 800.0
    assert data["min_price"] == 680.0
    assert data["max_price"] == 920.0


@patch("backend.app.ai.httpx.Client")
def test_price_analysis_llm_fallback(mock_http_client, client, generate_jwt, db_session):
    settings.ANTHROPIC_API_KEY = "sk-test-anthropic-key"
    user, headers = create_test_user(db_session, generate_jwt, client, email="price_llm@kpriet.ac.in")
    
    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockClaudeResponse({
        "content": [{"type": "text", "text": '{"average_price": 500.0, "min_price": 400.0, "max_price": 600.0, "confidence_level": "Medium", "explanation": "LLM estimation done"}'}],
        "usage": {"input_tokens": 10, "output_tokens": 20}
    }, status_code=200)
    
    payload = {
        "category": "Textbooks",
        "title": "Unique Textbook",
        "condition": "Good"
    }
    
    response = client.post("/api/v1/ai/price-analysis", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["method"] == "llm_fallback"
    assert data["average_price"] == 500.0
    assert data["min_price"] == 400.0
    assert data["max_price"] == 600.0


@patch("backend.app.ai.httpx.Client")
def test_image_analysis_success(mock_http_client, client, generate_jwt, db_session):
    settings.ANTHROPIC_API_KEY = "sk-test-anthropic-key"
    user, headers = create_test_user(db_session, generate_jwt, client, email="image_vis@kpriet.ac.in")
    
    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockClaudeResponse({
        "content": [{"type": "text", "text": '{"product_type": "Calculator", "title_brand": "Casio", "estimated_condition": "Good", "confidence": 92.0, "suggestions": ["Clean dust"], "warnings": []}'}],
        "usage": {"input_tokens": 10, "output_tokens": 20}
    }, status_code=200)
    
    files = {"file": ("test.png", b"fakeimagebytes", "image/png")}
    response = client.post("/api/v1/ai/image-analysis", files=files, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending"
    task_id = data["task_id"]
    
    # Poll the task endpoint to verify the finished result
    poll_response = client.get(f"/api/v1/ai/image-analysis/task/{task_id}", headers=headers)
    assert poll_response.status_code == 200
    poll_data = poll_response.json()
    assert poll_data["status"] == "success"
    assert poll_data["result"]["product_type"] == "Calculator"
    assert poll_data["result"]["title_brand"] == "Casio"
    assert poll_data["result"]["estimated_condition"] == "Good"


def test_price_and_image_analysis_rate_limiting(client, generate_jwt, db_session):
    user, headers = create_test_user(db_session, generate_jwt, client, email="daily_limits@kpriet.ac.in")
    
    for _ in range(20):
        log = AIUsageLog(
            user_id=user.id,
            endpoint="/price-analysis",
            latency_ms=100,
            status="success"
        )
        db_session.add(log)
    db_session.commit()
    
    payload = {
        "category": "Calculators",
        "title": "Calculator",
        "condition": "New"
    }
    response = client.post("/api/v1/ai/price-analysis", json=payload, headers=headers)
    assert response.status_code == 429
    assert "Daily limit" in response.json()["detail"]


def test_analytics_logging(client, generate_jwt, db_session):
    user, headers = create_test_user(db_session, generate_jwt, client, email="analytics@kpriet.ac.in")
    
    lst = Listing(
        id=uuid.uuid4(),
        seller_id=user.id,
        title="Notes",
        description="Math notes",
        category="Notes",
        condition="New",
        price=100.0,
        images=["image.jpg"]
    )
    db_session.add(lst)
    db_session.commit()
    
    response = client.post("/api/v1/analytics/view", json={"listing_id": str(lst.id)}, headers=headers)
    assert response.status_code == 201
    
    response = client.post("/api/v1/analytics/search", json={"query": "Calculus Notes"}, headers=headers)
    assert response.status_code == 201


def test_recommendations_personalization(client, generate_jwt, db_session):
    user1, headers1 = create_test_user(db_session, generate_jwt, client, email="user1@kpriet.ac.in", name="User One")
    user2, headers2 = create_test_user(db_session, generate_jwt, client, email="user2@kpriet.ac.in", name="User Two")
    
    lst1 = Listing(
        id=uuid.uuid4(),
        seller_id=user2.id,
        title="Maths textbook for second semester",
        description="Detailed maths book",
        category="Textbooks",
        condition="Good",
        price=500.0,
        images=["image.jpg"]
    )
    lst2 = Listing(
        id=uuid.uuid4(),
        seller_id=user2.id,
        title="Casio scientific calculator",
        description="Scientific calculator",
        category="Calculators",
        condition="New",
        price=800.0,
        images=["image.jpg"]
    )
    db_session.add_all([lst1, lst2])
    db_session.commit()
    
    client.post("/api/v1/analytics/search", json={"query": "Maths textbook"}, headers=headers1)
    
    response = client.get("/api/v1/ai/recommendations", headers=headers1)
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) > 0
    assert data[0]["id"] == str(lst1.id)
    
    logs = db_session.query(RecommendationLog).filter(RecommendationLog.user_id == user1.id).all()
    assert len(logs) > 0

