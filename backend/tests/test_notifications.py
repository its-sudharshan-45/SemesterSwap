import uuid
import pytest
from backend.app.models import User, Listing, Wishlist, Notification, Conversation

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

def test_notification_delivery_on_chat_events(client, generate_jwt, db_session):
    """
    Verify creating a conversation triggers notification entries for the counterpart.
    """
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer@kpriet.ac.in", "Buyer")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller")
    listing = create_test_listing(db_session, seller.id)

    # 1. Buyer starts conversation
    payload = {"listing_id": str(listing.id), "seller_id": str(seller.id)}
    response_conv = client.post("/api/v1/conversations", json=payload, headers=buyer_headers)
    assert response_conv.status_code == 201

    # Seller should receive a "Listing Interest" notification
    response_notif = client.get("/api/v1/notifications", headers=seller_headers)
    assert response_notif.status_code == 200
    seller_notifs = response_notif.json()
    assert len(seller_notifs) == 1
    assert seller_notifs[0]["type"] == "interest"
    assert "contacted you" in seller_notifs[0]["message"]

    # Mark interest notification as read
    notif_id = seller_notifs[0]["id"]
    response_read = client.patch(f"/api/v1/notifications/{notif_id}/read", headers=seller_headers)
    assert response_read.status_code == 200
    assert response_read.json()["is_read"] is True


def test_wishlist_status_notifications(client, generate_jwt, db_session):
    """
    Verify wishlisters are automatically notified when saved items are marked as sold.
    """
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer@kpriet.ac.in", "Buyer")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller")
    listing = create_test_listing(db_session, seller.id)

    # Buyer adds to wishlist
    wish = Wishlist(user_id=buyer.id, listing_id=listing.id)
    db_session.add(wish)
    db_session.commit()

    # Seller marks as sold
    response_sold = client.patch(f"/api/v1/listings/{listing.id}/sold", headers=seller_headers)
    assert response_sold.status_code == 200

    # Buyer should have received a notification about item being sold
    response_notif = client.get("/api/v1/notifications", headers=buyer_headers)
    assert response_notif.status_code == 200
    buyer_notifs = response_notif.json()
    assert len(buyer_notifs) == 1
    assert buyer_notifs[0]["type"] == "status"
    assert "marked as sold" in buyer_notifs[0]["message"]


def test_bulk_mark_notifications_as_read(client, generate_jwt, db_session):
    """
    Verify POST /api/v1/notifications/read-all marks all unread notifications for the user as read.
    """
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer@kpriet.ac.in", "Buyer")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller")
    
    # Create two unread notifications for the seller
    notif1 = Notification(user_id=seller.id, type="interest", title="Interest 1", message="Msg 1", is_read=False)
    notif2 = Notification(user_id=seller.id, type="status", title="Status 1", message="Msg 2", is_read=False)
    db_session.add_all([notif1, notif2])
    db_session.commit()

    # Verify they are unread initially
    response = client.get("/api/v1/notifications", headers=seller_headers)
    assert response.status_code == 200
    assert len(response.json()) == 2
    assert all(not n["is_read"] for n in response.json())

    # Call bulk read endpoint
    response_bulk = client.post("/api/v1/notifications/read-all", headers=seller_headers)
    assert response_bulk.status_code == 200
    assert response_bulk.json()["status"] == "success"

    # Verify all are read now
    response_after = client.get("/api/v1/notifications", headers=seller_headers)
    assert response_after.status_code == 200
    assert len(response_after.json()) == 2
    assert all(n["is_read"] for n in response_after.json())
