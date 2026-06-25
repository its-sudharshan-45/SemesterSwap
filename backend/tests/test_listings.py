import uuid
# pyrefly: ignore [missing-import]
import pytest
from backend.app.models import Listing, User

def create_test_user(db_session, generate_jwt, client, email="24cs101@kpriet.ac.in", name="Test User"):
    auth_id = str(uuid.uuid4())
    token = generate_jwt(auth_id=auth_id, email=email, full_name=name)
    headers = {"Authorization": f"Bearer {token}"}
    # Call me endpoint to ensure profile is auto-created in database
    client.get("/api/v1/users/me", headers=headers)
    user = db_session.query(User).filter(User.email == email).first()
    return user, headers

def test_create_listing_success(client, generate_jwt, db_session):
    """
    Verify verified students can successfully create product listings.
    """
    user, headers = create_test_user(db_session, generate_jwt, client)
    
    payload = {
        "title": "Engineering Physics Textbook",
        "description": "First-year engineering physics textbook by Gaur and Gupta. Perfect condition.",
        "category": "Textbooks",
        "condition": "Like New",
        "price": 450.00,
        "images": ["http://storage/path/image1.jpg"]
    }
    
    response = client.post("/api/v1/listings", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["price"] == 450.0
    assert data["seller_id"] == str(user.id)
    assert data["status"] == "available"
    assert data["images"] == payload["images"]
    assert data["seller"]["email"] == user.email

def test_create_listing_invalid_inputs(client, generate_jwt, db_session):
    """
    Verify validation fails on wrong categories, negative prices, empty/excessive images.
    """
    user, headers = create_test_user(db_session, generate_jwt, client)
    
    # 1. Invalid price
    payload = {
        "title": "Lab Coat",
        "description": "Large white lab coat",
        "category": "Lab Equipment",
        "condition": "Good",
        "price": -10.0,
        "images": ["http://storage/path/image1.jpg"]
    }
    response = client.post("/api/v1/listings", json=payload, headers=headers)
    assert response.status_code == 422

    # 2. Invalid category
    payload["price"] = 200.0
    payload["category"] = "InvalidCategory"
    response = client.post("/api/v1/listings", json=payload, headers=headers)
    assert response.status_code == 422

    # 3. Invalid condition
    payload["category"] = "Lab Equipment"
    payload["condition"] = "Very Old"
    response = client.post("/api/v1/listings", json=payload, headers=headers)
    assert response.status_code == 422

    # 4. Zero images
    payload["condition"] = "Good"
    payload["images"] = []
    response = client.post("/api/v1/listings", json=payload, headers=headers)
    assert response.status_code == 422

    # 5. Over 5 images
    payload["images"] = ["img1", "img2", "img3", "img4", "img5", "img6"]
    response = client.post("/api/v1/listings", json=payload, headers=headers)
    assert response.status_code == 422

def test_create_listing_unauthenticated(client):
    """
    Verify guest/unauthenticated users cannot create listings.
    """
    payload = {
        "title": "Unauthenticated Text",
        "description": "Should fail",
        "category": "Textbooks",
        "condition": "New",
        "price": 100.0,
        "images": ["http://storage/path/img.jpg"]
    }
    response = client.post("/api/v1/listings", json=payload)
    assert response.status_code == 401

def test_get_listings_and_filtering(client, generate_jwt, db_session):
    """
    Verify search query, category, condition, price, and status filters.
    """
    user, headers = create_test_user(db_session, generate_jwt, client)
    
    # Create test listings
    l1 = Listing(
        seller_id=user.id,
        title="Scientific Calculator fx-991EX",
        description="Casio scientific calculator. Essential for ECE/ME departments.",
        category="Calculators",
        condition="Good",
        price=1200.0,
        images=["img_calc.jpg"],
        status="available"
    )
    l2 = Listing(
        seller_id=user.id,
        title="Organic Chemistry Textbook",
        description="Morrison Boyd chemistry. Nice book.",
        category="Textbooks",
        condition="New",
        price=800.0,
        images=["img_chem.jpg"],
        status="available"
    )
    l3 = Listing(
        seller_id=user.id,
        title="Lab Safety Goggles",
        description="For chemistry lab. Plastic.",
        category="Lab Equipment",
        condition="Acceptable",
        price=150.0,
        images=["img_goggles.jpg"],
        status="sold"
    )
    db_session.add_all([l1, l2, l3])
    db_session.commit()

    # 1. Get available listings (default status=available)
    response = client.get("/api/v1/listings")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert {d["title"] for d in data} == {"Scientific Calculator fx-991EX", "Organic Chemistry Textbook"}

    # 2. Get sold listings
    response = client.get("/api/v1/listings?status=sold")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Lab Safety Goggles"

    # 3. Filter by category
    response = client.get("/api/v1/listings?category=Textbooks")
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Organic Chemistry Textbook"

    # 4. Filter by price range
    response = client.get("/api/v1/listings?min_price=1000")
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Scientific Calculator fx-991EX"

    # 5. Search by query 'casio' or 'Morrison'
    response = client.get("/api/v1/listings?q=Morrison")
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Organic Chemistry Textbook"

    # 6. Detailed get
    response = client.get(f"/api/v1/listings/{l1.id}")
    assert response.status_code == 200
    assert response.json()["title"] == "Scientific Calculator fx-991EX"

def test_update_listing_authorization(client, generate_jwt, db_session):
    """
    Verify only the listing owner can modify or mark it as sold.
    """
    owner, owner_headers = create_test_user(db_session, generate_jwt, client, "owner@kpriet.ac.in", "Owner")
    stranger, stranger_headers = create_test_user(db_session, generate_jwt, client, "stranger@kpriet.ac.in", "Stranger")
    
    listing = Listing(
        seller_id=owner.id,
        title="Original Title",
        description="Original description",
        category="Others",
        condition="New",
        price=100.0,
        images=["img.jpg"],
        status="available"
    )
    db_session.add(listing)
    db_session.commit()

    update_payload = {"title": "Updated Title", "price": 120.0}

    # 1. Stranger updates -> 403
    response = client.put(f"/api/v1/listings/{listing.id}", json=update_payload, headers=stranger_headers)
    assert response.status_code == 403

    # 2. Owner updates -> 200
    response = client.put(f"/api/v1/listings/{listing.id}", json=update_payload, headers=owner_headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Title"
    assert response.json()["price"] == 120.0

    # 3. Stranger marks as sold -> 403
    response = client.patch(f"/api/v1/listings/{listing.id}/sold", headers=stranger_headers)
    assert response.status_code == 403

    # 4. Owner marks as sold -> 200
    response = client.patch(f"/api/v1/listings/{listing.id}/sold", headers=owner_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "sold"

def test_delete_listing_authorization(client, generate_jwt, db_session):
    """
    Verify only the listing owner can delete it.
    """
    owner, owner_headers = create_test_user(db_session, generate_jwt, client, "owner@kpriet.ac.in", "Owner")
    stranger, stranger_headers = create_test_user(db_session, generate_jwt, client, "stranger@kpriet.ac.in", "Stranger")
    
    listing = Listing(
        seller_id=owner.id,
        title="To Be Deleted",
        description="Delete me",
        category="Others",
        condition="New",
        price=100.0,
        images=["img.jpg"],
        status="available"
    )
    db_session.add(listing)
    db_session.commit()

    # 1. Stranger deletes -> 403
    response = client.delete(f"/api/v1/listings/{listing.id}", headers=stranger_headers)
    assert response.status_code == 403
    assert db_session.query(Listing).filter(Listing.id == listing.id).first() is not None

    # 2. Owner deletes -> 204
    response = client.delete(f"/api/v1/listings/{listing.id}", headers=owner_headers)
    assert response.status_code == 204
    assert db_session.query(Listing).filter(Listing.id == listing.id).first() is None


def test_search_case_insensitive_and_substring(client, generate_jwt, db_session):
    """
    Verify that marketplace search is case-insensitive and supports substring matching.
    """
    user, headers = create_test_user(db_session, generate_jwt, client)
    
    # Create test listings
    l1 = Listing(
        seller_id=user.id,
        title="Apple Watch Series 9",
        description="Like new Apple Watch.",
        category="Electronics",
        condition="Like New",
        price=25000.0,
        images=["img_watch.jpg"],
        status="available"
    )
    l2 = Listing(
        seller_id=user.id,
        title="Smart Watch Ultra",
        description="Super smart watch.",
        category="Electronics",
        condition="New",
        price=30000.0,
        images=["img_watch2.jpg"],
        status="available"
    )
    l3 = Listing(
        seller_id=user.id,
        title="Titan Watch",
        description="Classic watch.",
        category="Others",
        condition="Good",
        price=5000.0,
        images=["img_watch3.jpg"],
        status="available"
    )
    l4 = Listing(
        seller_id=user.id,
        title="Watch Strap Bundle",
        description="Multicolor straps.",
        category="Accessories",
        condition="Acceptable",
        price=500.0,
        images=["img_strap.jpg"],
        status="available"
    )
    l5 = Listing(
        seller_id=user.id,
        title="Men's Sports Watch",
        description="Rugged watch.",
        category="Others",
        condition="Good",
        price=1500.0,
        images=["img_sports.jpg"],
        status="available"
    )
    db_session.add_all([l1, l2, l3, l4, l5])
    db_session.commit()

    # Search with lowercase "watch"
    response = client.get("/api/v1/listings?q=watch")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5

    # Search with uppercase "WATCH"
    response = client.get("/api/v1/listings?q=WATCH")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5

    # Search with mixed case "wAtCh"
    response = client.get("/api/v1/listings?q=wAtCh")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5

    # Search with trailing space "watch  "
    response = client.get("/api/v1/listings?q=watch%20%20")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5

    # Search with specific substring "sports"
    response = client.get("/api/v1/listings?q=sports")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Men's Sports Watch"


