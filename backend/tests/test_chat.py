import uuid
import pytest
from backend.app.models import User, Listing, Conversation, Message, BlockedUser

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

def test_conversation_creation_flow(client, generate_jwt, db_session):
    """
    Verify buyers can create conversations, duplicate conversations open the existing chat,
    and blocks prevent conversation creation.
    """
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer@kpriet.ac.in", "Buyer")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller")
    listing = create_test_listing(db_session, seller.id)

    payload = {
        "listing_id": str(listing.id),
        "seller_id": str(seller.id)
    }

    # 1. Successful conversation creation
    response = client.post("/api/v1/conversations", json=payload, headers=buyer_headers)
    assert response.status_code == 201
    data = response.json()
    conv_id = data["id"]
    assert data["buyer_id"] == str(buyer.id)
    assert data["seller_id"] == str(seller.id)
    assert data["listing_id"] == str(listing.id)

    # 2. Duplicate creation check: should return the same conversation
    response_dup = client.post("/api/v1/conversations", json=payload, headers=buyer_headers)
    assert response_dup.status_code == 200
    assert response_dup.json()["id"] == conv_id

    # 3. Blocking validation: Block buyer, seller tries to fetch details -> fails
    block = BlockedUser(blocker_id=seller.id, blocked_id=buyer.id)
    db_session.add(block)
    db_session.commit()

    # Conversation fetch by buyer should fail now due to active block
    response_block = client.get(f"/api/v1/conversations/{conv_id}", headers=buyer_headers)
    assert response_block.status_code == 403

def test_message_sending_and_read_receipts(client, generate_jwt, db_session):
    """
    Verify sending messages, receipt marks when history is loaded, and block checks.
    """
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer@kpriet.ac.in", "Buyer")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller")
    listing = create_test_listing(db_session, seller.id)

    # Create conversation directly in DB
    conv = Conversation(listing_id=listing.id, buyer_id=buyer.id, seller_id=seller.id)
    db_session.add(conv)
    db_session.commit()

    # 1. Send message from buyer
    msg_payload = {"content": "Is the book available?"}
    response = client.post(f"/api/v1/conversations/{conv.id}/messages", json=msg_payload, headers=buyer_headers)
    assert response.status_code == 201
    msg_data = response.json()
    assert msg_data["content"] == "Is the book available?"
    assert msg_data["is_read"] is False
    assert msg_data["sender_id"] == str(buyer.id)

    # 2. Query conversation list for buyer
    response_list = client.get("/api/v1/conversations", headers=buyer_headers)
    assert response_list.status_code == 200
    assert len(response_list.json()) == 1
    assert response_list.json()[0]["last_message"]["content"] == "Is the book available?"

    # 3. Read message history as seller (should mark messages as read)
    response_history = client.get(f"/api/v1/conversations/{conv.id}/messages", headers=seller_headers)
    assert response_history.status_code == 200
    assert len(response_history.json()) == 1
    assert response_history.json()[0]["is_read"] is True  # Marked read automatically

    # Verify directly from DB
    db_msg = db_session.query(Message).filter(Message.id == uuid.UUID(msg_data["id"])).first()
    assert db_msg.is_read is True

    # 4. Try sending message from blocked user -> 403
    block = BlockedUser(blocker_id=buyer.id, blocked_id=seller.id)
    db_session.add(block)
    db_session.commit()

    response_fail = client.post(f"/api/v1/conversations/{conv.id}/messages", json={"content": "Hello"}, headers=seller_headers)
    assert response_fail.status_code == 403
