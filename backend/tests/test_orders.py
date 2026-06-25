import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest
from backend.app.models import User, Listing, PurchaseRequest, Meeting, TransactionConfirmation, Notification

def create_test_user(db_session, generate_jwt, client, email="24cs101@kpriet.ac.in", name="Test User"):
    auth_id = str(uuid.uuid4())
    token = generate_jwt(auth_id=auth_id, email=email, full_name=name)
    headers = {"Authorization": f"Bearer {token}"}
    client.get("/api/v1/users/me", headers=headers)
    user = db_session.query(User).filter(User.email == email).first()
    return user, headers

def create_test_listing(db_session, seller_id, title="Test Item", status="available", price=100.0):
    listing = Listing(
        seller_id=seller_id,
        title=title,
        description="A beautiful test item",
        category="Textbooks",
        condition="New",
        price=price,
        images=["img.jpg"],
        status=status
    )
    db_session.add(listing)
    db_session.commit()
    return listing

def test_create_meeting_request_valid(client, generate_jwt, db_session):
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer@kpriet.ac.in", "Buyer User")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller User")
    listing = create_test_listing(db_session, seller.id)

    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:00 AM - 12:00 PM",
        "meeting_location": "Library Entrance",
        "message": "Hi, I would love to buy this textbook!"
    }
    
    response = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["buyer_id"] == str(buyer.id)
    assert data["seller_id"] == str(seller.id)
    assert data["product_id"] == str(listing.id)
    assert Decimal(str(data["amount"])) == Decimal("100.00")
    assert data["order_status"] == "CREATED"  # PENDING compatibility alias
    assert data["payment_status"] == "PENDING"
    assert data["meeting"]["location"] == "Library Entrance"
    assert data["meeting"]["date"] == "2026-06-25"
    assert data["meeting"]["time"] == "10:00 AM - 12:00 PM"
    assert data["meeting"]["payment_method"] == "UPI"

    # Check listing status is updated to REQUEST_PENDING
    db_session.refresh(listing)
    assert listing.status == "REQUEST_PENDING"

def test_create_request_self_purchase(client, generate_jwt, db_session):
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller User")
    listing = create_test_listing(db_session, seller.id)

    payload = {
        "product_id": str(listing.id),
        "payment_method": "CASH",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:00 AM - 12:00 PM",
        "meeting_location": "Library Entrance"
    }
    
    response = client.post("/api/v1/orders/create", json=payload, headers=seller_headers)
    assert response.status_code == 400
    assert "cannot purchase your own" in response.json()["detail"]

def test_double_requests_prevented(client, generate_jwt, db_session):
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer@kpriet.ac.in", "Buyer")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller")
    listing = create_test_listing(db_session, seller.id)

    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:00 AM - 12:00 PM",
        "meeting_location": "Library Entrance"
    }

    # First request
    res1 = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    assert res1.status_code == 201

    # Second concurrent request from same buyer
    res2 = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    assert res2.status_code == 400
    assert "already have a pending request" in res2.json()["detail"]

def test_meeting_acceptance_flow(client, generate_jwt, db_session):
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer@kpriet.ac.in", "Buyer")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller")
    listing = create_test_listing(db_session, seller.id)

    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:00 AM - 12:00 PM",
        "meeting_location": "Library Entrance"
    }
    
    res = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    order_id = res.json()["id"]

    # Seller accepts meeting proposal
    res_acc = client.post(f"/api/v1/orders/{order_id}/accept", headers=seller_headers)
    assert res_acc.status_code == 200
    assert res_acc.json()["order_status"] == "SELLER_ACCEPTED"

    # Check listing status is locked as reserved
    db_session.refresh(listing)
    assert listing.status == "reserved"

def test_meeting_rejection_flow(client, generate_jwt, db_session):
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer@kpriet.ac.in", "Buyer")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller")
    listing = create_test_listing(db_session, seller.id)

    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:00 AM - 12:00 PM",
        "meeting_location": "Library Entrance"
    }
    
    res = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    order_id = res.json()["id"]

    # Seller declines meeting request
    res_rej = client.post(f"/api/v1/orders/{order_id}/reject", headers=seller_headers)
    assert res_rej.status_code == 200
    assert res_rej.json()["order_status"] == "CANCELLED"

    # Verify listing returned to available
    db_session.refresh(listing)
    assert listing.status == "available"

def test_unauthorized_access(client, generate_jwt, db_session):
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer@kpriet.ac.in", "Buyer")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller")
    attacker, attacker_headers = create_test_user(db_session, generate_jwt, client, "attacker@kpriet.ac.in", "Attacker")
    listing = create_test_listing(db_session, seller.id)

    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:00 AM - 12:00 PM",
        "meeting_location": "Library Entrance"
    }
    res = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    order_id = res.json()["id"]

    # Attacker tries to view details
    res_view = client.get(f"/api/v1/orders/{order_id}", headers=attacker_headers)
    assert res_view.status_code == 403

    # Attacker tries to accept
    res_acc = client.post(f"/api/v1/orders/{order_id}/accept", headers=attacker_headers)
    assert res_acc.status_code == 403

def test_double_confirmation_completion_flow(client, generate_jwt, db_session):
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer@kpriet.ac.in", "Buyer")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller@kpriet.ac.in", "Seller")
    listing = create_test_listing(db_session, seller.id)

    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:00 AM - 12:00 PM",
        "meeting_location": "Library Entrance"
    }
    
    # 1. Create Request
    res = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    order_id = res.json()["id"]

    # 2. Seller accepts meeting
    client.post(f"/api/v1/orders/{order_id}/accept", headers=seller_headers)

    # 3. Buyer confirms item received
    res_buyer_conf = client.post(f"/api/v1/orders/{order_id}/complete", headers=buyer_headers)
    assert res_buyer_conf.status_code == 200
    assert res_buyer_conf.json()["meeting"]["confirmation"]["buyer_confirmed"] is True
    assert res_buyer_conf.json()["meeting"]["confirmation"]["seller_confirmed"] is False
    assert res_buyer_conf.json()["order_status"] == "SELLER_ACCEPTED"  # Status remains ACCEPTED until both confirm

    # 4. Seller confirms payment received
    res_seller_conf = client.post(f"/api/v1/orders/{order_id}/complete", headers=seller_headers)
    assert res_seller_conf.status_code == 200
    assert res_seller_conf.json()["meeting"]["confirmation"]["buyer_confirmed"] is True
    assert res_seller_conf.json()["meeting"]["confirmation"]["seller_confirmed"] is True
    assert res_seller_conf.json()["order_status"] == "COMPLETED"

    # 5. Check product marked sold
    db_session.refresh(listing)
    assert listing.status == "sold"


def test_purchase_request_expiration(client, generate_jwt, db_session):
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer_exp@kpriet.ac.in", "Buyer Exp")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller_exp@kpriet.ac.in", "Seller Exp")
    listing = create_test_listing(db_session, seller.id)

    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:00 AM - 12:00 PM",
        "meeting_location": "Library Entrance"
    }

    res = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    assert res.status_code == 201
    order_id = res.json()["id"]

    req = db_session.query(PurchaseRequest).filter(PurchaseRequest.id == uuid.UUID(order_id)).first()
    req.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    cleanup_res = client.post("/api/v1/orders/cleanup-expired")
    assert cleanup_res.status_code == 200
    assert cleanup_res.json()["expired_count"] == 1

    db_session.refresh(req)
    assert req.status == "EXPIRED"
    assert req.meeting.status == "CANCELLED"
    assert req.meeting.cancel_reason == "System Automatic Expiration"

    db_session.refresh(listing)
    assert listing.status == "available"


def test_concurrency_double_acceptance_conflict(client, generate_jwt, db_session):
    buyer_a, buyer_a_headers = create_test_user(db_session, generate_jwt, client, "buyer_a@kpriet.ac.in", "Buyer A")
    buyer_b, buyer_b_headers = create_test_user(db_session, generate_jwt, client, "buyer_b@kpriet.ac.in", "Buyer B")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller_con@kpriet.ac.in", "Seller")
    listing = create_test_listing(db_session, seller.id)

    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:00 AM - 12:00 PM",
        "meeting_location": "Library Entrance"
    }

    res_a = client.post("/api/v1/orders/create", json=payload, headers=buyer_a_headers)
    assert res_a.status_code == 201
    order_a_id = res_a.json()["id"]

    res_b = client.post("/api/v1/orders/create", json=payload, headers=buyer_b_headers)
    assert res_b.status_code == 201
    order_b_id = res_b.json()["id"]

    res_acc_a = client.post(f"/api/v1/orders/{order_a_id}/accept", headers=seller_headers)
    assert res_acc_a.status_code == 200

    res_acc_b = client.post(f"/api/v1/orders/{order_b_id}/accept", headers=seller_headers)
    assert res_acc_b.status_code == 409
    assert "already been reserved or sold" in res_acc_b.json()["detail"]


def test_cancellation_flow(client, generate_jwt, db_session):
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer_cancel@kpriet.ac.in", "Buyer Cancel")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller_cancel@kpriet.ac.in", "Seller Cancel")
    listing = create_test_listing(db_session, seller.id)

    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:00 AM - 12:00 PM",
        "meeting_location": "Library Entrance"
    }

    res = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    order_id = res.json()["id"]

    cancel_payload = {
        "reason": "Found it cheaper elsewhere"
    }
    cancel_res = client.post(f"/api/v1/orders/{order_id}/cancel", json=cancel_payload, headers=buyer_headers)
    assert cancel_res.status_code == 200
    
    data = cancel_res.json()
    assert data["order_status"] == "CANCELLED"
    assert data["cancelled_by"] == str(buyer.id)
    assert data["cancel_reason"] == "Found it cheaper elsewhere"
    assert data["cancelled_at"] is not None

    assert data["meeting"]["status"] == "CANCELLED"
    assert data["meeting"]["cancelled_by"] == str(buyer.id)
    assert data["meeting"]["cancel_reason"] == "Found it cheaper elsewhere"
    assert data["meeting"]["cancelled_at"] is not None

    db_session.refresh(listing)
    assert listing.status == "available"


def test_no_show_handling(client, generate_jwt, db_session):
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer_ns@kpriet.ac.in", "Buyer NS")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller_ns@kpriet.ac.in", "Seller NS")
    listing = create_test_listing(db_session, seller.id)

    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-19",
        "meeting_time": "10:00 AM - 12:00 PM",
        "meeting_location": "Library Entrance"
    }

    res = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    order_id = res.json()["id"]

    client.post(f"/api/v1/orders/{order_id}/accept", headers=seller_headers)

    req = db_session.query(PurchaseRequest).filter(PurchaseRequest.id == uuid.UUID(order_id)).first()
    req.meeting.date = "2026-06-15"
    db_session.commit()

    client.post("/api/v1/orders/cleanup-expired")

    db_session.refresh(req)
    assert req.meeting.status == "NO_SHOW"

