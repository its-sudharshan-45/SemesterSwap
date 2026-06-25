import pytest
from sqlalchemy.exc import IntegrityError
from backend.app.models import Review, User, College, Department, PurchaseRequest
from backend.app.services.trust import calculate_trust_score
from datetime import datetime, timedelta, timezone
import uuid

def test_database_level_rating_validation(db_session):
    """
    Test that the database-level rating constraint (CHECK rating >= 1 AND rating <= 5)
    raises an error if an invalid rating is attempted to be persisted.
    """
    college = db_session.query(College).first()
    dept = db_session.query(Department).first()
    
    buyer = User(
        auth_id=uuid.uuid4(),
        college_id=college.id,
        department_id=dept.id,
        full_name="Buyer Student",
        email="buyer@kpriet.ac.in",
        admission_year=2024,
        roll_number=101
    )
    seller = User(
        auth_id=uuid.uuid4(),
        college_id=college.id,
        department_id=dept.id,
        full_name="Seller Student",
        email="seller@kpriet.ac.in",
        admission_year=2024,
        roll_number=102
    )
    db_session.add_all([buyer, seller])
    db_session.commit()
    
    from backend.app.models import Listing
    product = Listing(
        seller_id=seller.id,
        title="Test Book",
        description="A book",
        category="Textbooks",
        condition="Good",
        price=100.0,
        status="sold"
    )
    db_session.add(product)
    db_session.commit()
    
    order = PurchaseRequest(
        buyer_id=buyer.id,
        seller_id=seller.id,
        listing_id=product.id,
        status="COMPLETED"
    )
    db_session.add(order)
    db_session.commit()
    
    # 1. Invalid rating < 1 (e.g. 0)
    review_low = Review(
        order_id=order.id,
        reviewer_id=buyer.id,
        reviewee_id=seller.id,
        rating=0,
        comment="Too low"
    )
    db_session.add(review_low)
    with pytest.raises(Exception):
        db_session.commit()
    db_session.rollback()

    # 2. Invalid rating > 5 (e.g. 6)
    review_high = Review(
        order_id=order.id,
        reviewer_id=buyer.id,
        reviewee_id=seller.id,
        rating=6,
        comment="Too high"
    )
    db_session.add(review_high)
    with pytest.raises(Exception):
        db_session.commit()
    db_session.rollback()


def test_mock_verification_endpoints_production_security(client, generate_jwt, db_session):
    """
    Test that mock college verification endpoints block access with a 403 status code
    when setting ENV="production", but succeed in other environments.
    """
    from backend.app.config import settings
    original_env = settings.ENV
    settings.ENV = "production"
    
    try:
        college = db_session.query(College).first()
        dept = db_session.query(Department).first()
        auth_id = uuid.uuid4()
        user = User(
            auth_id=auth_id,
            college_id=college.id,
            department_id=dept.id,
            full_name="Target Student",
            email="target@kpriet.ac.in",
            admission_year=2024,
            roll_number=303
        )
        db_session.add(user)
        db_session.commit()
        
        token = generate_jwt(auth_id=str(auth_id), email="target@kpriet.ac.in")
        headers = {"Authorization": f"Bearer {token}"}
        
        # 1. Call mock approve in production
        response = client.post(f"/api/v1/users/{user.id}/verify/approve", headers=headers)
        assert response.status_code == 403
        assert "disabled in production" in response.json()["detail"]
        
        # 2. Call mock reject in production
        response = client.post(f"/api/v1/users/{user.id}/verify/reject", headers=headers)
        assert response.status_code == 403
        assert "disabled in production" in response.json()["detail"]
        
        # 3. Call in non-production
        settings.ENV = "development"
        response = client.post(f"/api/v1/users/{user.id}/verify/approve", headers=headers)
        assert response.status_code == 200
        assert response.json()["verification_status"] == "APPROVED"
        
    finally:
        settings.ENV = original_env


def test_user_privacy_exposes_only_public_information(client, generate_jwt, db_session):
    """
    Test that reviews returned via trust-profile and received review endpoints do not
    leak internal/sensitive info such as email address or auth_id.
    """
    college = db_session.query(College).first()
    dept = db_session.query(Department).first()
    
    buyer_auth_id = uuid.uuid4()
    buyer = User(
        auth_id=buyer_auth_id,
        college_id=college.id,
        department_id=dept.id,
        full_name="Buyer Student",
        email="buyer@kpriet.ac.in",
        admission_year=2024,
        roll_number=101
    )
    seller_auth_id = uuid.uuid4()
    seller = User(
        auth_id=seller_auth_id,
        college_id=college.id,
        department_id=dept.id,
        full_name="Seller Student",
        email="seller_sensitive_private_email@kpriet.ac.in",
        admission_year=2024,
        roll_number=102,
        rating=5.0
    )
    db_session.add_all([buyer, seller])
    db_session.commit()
    
    from backend.app.models import Listing
    product = Listing(
        seller_id=seller.id,
        title="Test Book",
        description="A book",
        category="Textbooks",
        condition="Good",
        price=100.0,
        status="sold"
    )
    db_session.add(product)
    db_session.commit()
    
    order = PurchaseRequest(
        buyer_id=buyer.id,
        seller_id=seller.id,
        listing_id=product.id,
        status="COMPLETED"
    )
    db_session.add(order)
    db_session.commit()
    
    review = Review(
        order_id=order.id,
        reviewer_id=buyer.id,
        reviewee_id=seller.id,
        rating=5,
        comment="Excellent seller!"
    )
    db_session.add(review)
    db_session.commit()
    
    token = generate_jwt(auth_id=str(buyer_auth_id), email="buyer@kpriet.ac.in")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get trust profile
    response = client.get(f"/api/v1/users/{seller.id}/trust-profile", headers=headers)
    assert response.status_code == 200
    data = response.json()
    
    # Trust Profile fields verification
    assert data["full_name"] == "Seller Student"
    assert data["rating"] == 5.0
    assert data["completed_transactions"] == 1
    assert data["products_sold"] == 1
    assert data["verification_status"] == "APPROVED"
    assert data["trust_score"] > 0
    assert "email" not in data
    assert "auth_id" not in data
    
    # Reviews nested user representation verification
    assert len(data["reviews"]) == 1
    rev = data["reviews"][0]
    assert rev["comment"] == "Excellent seller!"
    assert "email" not in rev["reviewer"]
    assert "auth_id" not in rev["reviewer"]
    assert "roll_number" not in rev["reviewer"]
    
    # Reviews received API verification
    seller_token = generate_jwt(auth_id=str(seller_auth_id), email="seller_sensitive_private_email@kpriet.ac.in")
    seller_headers = {"Authorization": f"Bearer {seller_token}"}
    
    response_rev = client.get("/api/v1/reviews/received", headers=seller_headers)
    assert response_rev.status_code == 200
    reviews_received = response_rev.json()
    assert len(reviews_received) == 1
    rev_rec = reviews_received[0]
    assert "email" not in rev_rec["reviewer"]
    assert "auth_id" not in rev_rec["reviewer"]
    assert "roll_number" not in rev_rec["reviewer"]


def test_trust_score_calculation():
    """
    Test the trust score calculator with various student engagement metrics
    to verify standard algorithm weightings are correctly applied.
    """
    # 1. Unverified new user
    score1 = calculate_trust_score(
        created_at=datetime.now(timezone.utc),
        verification_status="PENDING",
        rating=0.0,
        total_reviews=0,
        completed_transactions=0,
        products_sold=0
    )
    assert score1 == 0

    # 2. Verified new user
    # Verification: 30
    # Rating: 12 (default for verified with no reviews)
    # Total = 42
    score2 = calculate_trust_score(
        created_at=datetime.now(timezone.utc),
        verification_status="APPROVED",
        rating=0.0,
        total_reviews=0,
        completed_transactions=0,
        products_sold=0
    )
    assert score2 == 42

    # 3. Highly active unverified user
    # Verification: 0
    # Rating: 5.0 (total_reviews > 0) -> 20 points
    # Completed transactions: 5 -> 20 points
    # Account age: 50 days -> 10 points
    # Products sold: 5 -> 10 points
    # Total = 60
    score3 = calculate_trust_score(
        created_at=datetime.now(timezone.utc) - timedelta(days=50),
        verification_status="PENDING",
        rating=5.0,
        total_reviews=1,
        completed_transactions=5,
        products_sold=5
    )
    assert score3 == 60

    # 4. Verified, seasoned active student
    # Verification: 30
    # Rating: 4.5 (total_reviews > 0) -> 18 points
    # Completed transactions: 5 -> 20 points
    # Account age: 100 days -> 20 points
    # Products sold: 5 -> 10 points
    # Total = 30 + 18 + 20 + 20 + 10 = 98
    score4 = calculate_trust_score(
        created_at=datetime.now(timezone.utc) - timedelta(days=100),
        verification_status="APPROVED",
        rating=4.5,
        total_reviews=2,
        completed_transactions=5,
        products_sold=5
    )
    assert score4 == 98

    # 5. Capping verification (max 100)
    score5 = calculate_trust_score(
        created_at=datetime.now(timezone.utc) - timedelta(days=150),
        verification_status="APPROVED",
        rating=5.0,
        total_reviews=10,
        completed_transactions=10,
        products_sold=10
    )
    assert score5 == 100


def test_create_review_api_endpoint(client, generate_jwt, db_session):
    """
    Test that submitting a review via the POST /api/v1/reviews endpoint works.
    """
    college = db_session.query(College).first()
    dept = db_session.query(Department).first()
    
    buyer_auth_id = uuid.uuid4()
    buyer = User(
        auth_id=buyer_auth_id,
        college_id=college.id,
        department_id=dept.id,
        full_name="Buyer Student",
        email="buyer@kpriet.ac.in",
        admission_year=2024,
        roll_number=101
    )
    seller_auth_id = uuid.uuid4()
    seller = User(
        auth_id=seller_auth_id,
        college_id=college.id,
        department_id=dept.id,
        full_name="Seller Student",
        email="seller@kpriet.ac.in",
        admission_year=2024,
        roll_number=102,
        rating=5.0
    )
    db_session.add_all([buyer, seller])
    db_session.commit()
    
    from backend.app.models import Listing
    product = Listing(
        seller_id=seller.id,
        title="Test Book",
        description="A book",
        category="Textbooks",
        condition="Good",
        price=100.0,
        status="sold"
    )
    db_session.add(product)
    db_session.commit()
    
    order = PurchaseRequest(
        buyer_id=buyer.id,
        seller_id=seller.id,
        listing_id=product.id,
        status="COMPLETED"
    )
    db_session.add(order)
    db_session.commit()
    
    token = generate_jwt(auth_id=str(buyer_auth_id), email="buyer@kpriet.ac.in")
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {
        "order_id": str(order.id),
        "rating": 5,
        "comment": "Super swap!"
    }
    
    response = client.post("/api/v1/reviews", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["rating"] == 5
    assert data["comment"] == "Super swap!"
    assert data["reviewer_id"] == str(buyer.id)
    assert data["reviewee_id"] == str(seller.id)

