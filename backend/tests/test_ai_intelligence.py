import uuid
import json
import pytest
from unittest.mock import patch, MagicMock
from backend.app.models import User, Listing, ListingView, SearchHistory
from backend.app.config import settings

def create_test_user(db_session, generate_jwt, client, email="ai_intel_student@kpriet.ac.in", name="AI Intel Student"):
    auth_id = str(uuid.uuid4())
    token = generate_jwt(auth_id=auth_id, email=email, full_name=name)
    headers = {"Authorization": f"Bearer {token}"}
    client.get("/api/v1/users/me", headers=headers)
    user = db_session.query(User).filter(User.email == email).first()
    return user, headers


@patch("backend.app.ai_router.get_price_recommendation")
def test_price_prediction_success(mock_get_rec, client, generate_jwt, db_session):
    """
    Test POST /api/v1/ai/price-prediction endpoint.
    """
    user, headers = create_test_user(db_session, generate_jwt, client, email="price_pred@kpriet.ac.in")

    mock_rec_id = uuid.uuid4()
    mock_get_rec.return_value = {
        "id": str(mock_rec_id),
        "product_id": None,
        "average_price": 450.0,
        "min_price": 350.0,
        "max_price": 550.0,
        "confidence_level": "High",
        "confidence_score": 0.92,
        "method": "historical_statistics",
        "explanation": "Calculated via historical trends."
    }

    payload = {
        "title": "Clean Scientific Calculator",
        "category": "Calculators",
        "condition": "Like New",
        "original_price": 1000.0,
        "age_months": 6
    }

    response = client.post("/api/v1/ai/price-prediction", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(mock_rec_id)
    assert data["average_price"] == 450.0
    assert data["min_price"] == 350.0
    assert data["max_price"] == 550.0
    assert data["confidence_level"] == "High"
    assert data["confidence_score"] == 0.92
    assert "historical" in data["explanation"] or "Calculated" in data["explanation"]


@patch("backend.app.ai_router.detect_fraud")
def test_analyze_listing_fraud_success(mock_detect_fraud, client, generate_jwt, db_session):
    """
    Test POST /api/v1/ai/analyze-listing endpoint.
    """
    user, headers = create_test_user(db_session, generate_jwt, client, email="fraud_check@kpriet.ac.in")

    mock_fraud_id = uuid.uuid4()
    mock_detect_fraud.return_value = {
        "id": mock_fraud_id,
        "product_id": None,
        "risk_score": 15.0,
        "risk_level": "LOW",
        "analysis_reason": "No suspicious patterns detected.",
        "recommendations": []
    }

    payload = {
        "title": "Genuine Casio Calculator",
        "description": "Hardly used scientific calculator, perfect for engineering student swaps.",
        "category": "Calculators",
        "condition": "Like New",
        "price": 400.0
    }

    response = client.post("/api/v1/ai/analyze-listing", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(mock_fraud_id)
    assert data["risk_score"] == 15.0
    assert data["risk_level"] == "LOW"


@patch("backend.app.ai_router.smart_search")
def test_smart_search_success(mock_smart_search, client, generate_jwt, db_session):
    """
    Test POST /api/v1/ai/search semantic search query mapping and listings filtering.
    """
    user, headers = create_test_user(db_session, generate_jwt, client, email="smart_search@kpriet.ac.in")

    mock_listing_id = uuid.uuid4()
    mock_smart_search.return_value = {
        "explanation": "Searched category Calculators for scientific tools.",
        "results": [
            {
                "listing": {
                    "id": str(mock_listing_id),
                    "seller_id": str(user.id),
                    "title": "Programmable Engineering Calculator",
                    "description": "Casio fx-991EX calculator in pristine condition.",
                    "category": "Calculators",
                    "condition": "Like New",
                    "price": 450.0,
                    "status": "available",
                    "images": ["image.jpg"],
                    "created_at": "2026-06-20T00:00:00",
                    "updated_at": "2026-06-20T00:00:00",
                },
                "relevance_score": 0.85,
                "explanation": "Exact match for scientific calculator."
            }
        ]
    }

    payload = {
        "query": "I need a scientific calculator around 400 INR"
    }

    response = client.post("/api/v1/ai/search", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "explanation" in data
    assert len(data["results"]) > 0
    assert data["results"][0]["listing"]["title"] == "Programmable Engineering Calculator"
    assert data["results"][0]["relevance_score"] == 0.85


def test_seller_insights_success(client, generate_jwt, db_session):
    """
    Test GET /api/v1/ai/seller-insights/{product_id} details.
    """
    user, headers = create_test_user(db_session, generate_jwt, client, email="seller_insights@kpriet.ac.in")

    lst = Listing(
        id=uuid.uuid4(),
        seller_id=user.id,
        title="ECE textbooks semester 3",
        description="Textbooks for electronic circuit analysis.",
        category="Textbooks",
        condition="Good",
        price=300.0,
        images=["image.jpg"]
    )
    db_session.add(lst)
    db_session.commit()

    # Add a view to trigger positive insight view counts
    view = ListingView(user_id=user.id, listing_id=lst.id)
    db_session.add(view)
    db_session.commit()

    response = client.get(f"/api/v1/ai/seller-insights/{lst.id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["product_id"] == str(lst.id)
    assert data["views"] >= 1
    assert "selling_probability" in data
    assert len(data["suggestions"]) > 0


@patch("backend.app.ai_router.analyze_image_quality")
def test_image_quality_success(mock_analyze_quality, client, generate_jwt, db_session):
    """
    Test POST /api/v1/ai/image-quality API.
    """
    user, headers = create_test_user(db_session, generate_jwt, client, email="img_qual@kpriet.ac.in")

    mock_quality_id = uuid.uuid4()
    mock_analyze_quality.return_value = {
        "id": mock_quality_id,
        "product_id": None,
        "quality_score": 85.0,
        "quality_level": "High",
        "feedback": ["Clean lighting and high definition."]
    }

    files = {"file": ("test.jpg", b"mockimagebinarydata", "image/jpeg")}
    response = client.post("/api/v1/ai/image-quality", files=files, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(mock_quality_id)
    assert data["quality_score"] == 85.0
    assert data["quality_level"] == "High"
    assert len(data["feedback"]) > 0


def test_recommendation_sections_success(client, generate_jwt, db_session):
    """
    Test GET /api/v1/ai/recommendations/sections endpoint returns all four recommendation segments.
    """
    user, headers = create_test_user(db_session, generate_jwt, client, email="recs_sec@kpriet.ac.in")

    # Add some active listings to populate sections
    lst = Listing(
        id=uuid.uuid4(),
        seller_id=user.id,
        title="Physics lab manual",
        description="Official laboratory guide with print markings.",
        category="Lab Equipment",
        condition="Good",
        price=150.0,
        images=["image.jpg"]
    )
    db_session.add(lst)
    db_session.commit()

    response = client.get("/api/v1/ai/recommendations/sections", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "recommended_for_you" in data
    assert "similar_products" in data
    assert "trending_in_college" in data
    assert "based_on_searches" in data
