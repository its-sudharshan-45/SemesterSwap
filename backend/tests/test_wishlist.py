import uuid
import pytest
from backend.app.models import User, Listing, Wishlist

def create_test_user(db_session, generate_jwt, client, email="24cs101@kpriet.ac.in", name="Test User"):
    auth_id = str(uuid.uuid4())
    token = generate_jwt(auth_id=auth_id, email=email, full_name=name)
    headers = {"Authorization": f"Bearer {token}"}
    client.get("/api/v1/users/me", headers=headers)
    user = db_session.query(User).filter(User.email == email).first()
    return user, headers

def create_test_listing(db_session, seller_id, title="Test Item"):
    listing = Listing(
        seller_id=seller_id,
        title=title,
        description="A beautiful test item",
        category="Textbooks",
        condition="New",
        price=100.0,
        images=["img.jpg"],
        status="available"
    )
    db_session.add(listing)
    db_session.commit()
    return listing

def test_wishlist_lifecycle(client, generate_jwt, db_session):
    """
    Verify users can add/remove wishlist items and duplicate entries are handled gracefully.
    """
    user, headers = create_test_user(db_session, generate_jwt, client, "user@kpriet.ac.in", "User")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller")
    listing = create_test_listing(db_session, seller.id)

    # 1. Add to wishlist
    payload = {"listing_id": str(listing.id)}
    response = client.post("/api/v1/wishlist", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["listing_id"] == str(listing.id)
    assert data["user_id"] == str(user.id)

    # 2. Add duplicate: should return the same wishlist item (no error, handles gracefully)
    response_dup = client.post("/api/v1/wishlist", json=payload, headers=headers)
    assert response_dup.status_code == 200
    assert response_dup.json()["id"] == data["id"]

    # 3. Retrieve wishlist
    response_get = client.get("/api/v1/wishlist", headers=headers)
    assert response_get.status_code == 200
    assert len(response_get.json()) == 1
    assert response_get.json()[0]["listing"]["title"] == "Test Item"

    # 4. Remove from wishlist
    response_del = client.delete(f"/api/v1/wishlist/{listing.id}", headers=headers)
    assert response_del.status_code == 204

    # Verify empty now
    response_get_empty = client.get("/api/v1/wishlist", headers=headers)
    assert len(response_get_empty.json()) == 0
