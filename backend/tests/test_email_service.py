import uuid
from unittest.mock import patch, MagicMock
import pytest
from datetime import datetime, timezone, timedelta
from backend.app.models import User, Listing, PurchaseRequest, Conversation, Message, EmailNotification, EmailNotificationType
from backend.app.config import settings


# Mock Response matching Resend API response structure
class MockResendResponse:
    def __init__(self, json_data, status_code=200):
        self._json_data = json_data
        self.status_code = status_code
        self.text = "Mock Resend Response Text"
        self.request = MagicMock()

    def json(self):
        return self._json_data


def create_test_user_helper(db_session, generate_jwt, client, email="test_student@kpriet.ac.in", name="Test Student"):
    auth_id = str(uuid.uuid4())
    token = generate_jwt(auth_id=auth_id, email=email, full_name=name)
    headers = {"Authorization": f"Bearer {token}"}
    client.get("/api/v1/users/me", headers=headers)
    user = db_session.query(User).filter(User.email == email).first()
    return user, headers


@patch("backend.app.services.email_service.httpx.Client")
def test_meeting_request_email_sent_success(mock_http_client, client, generate_jwt, db_session):
    """
    Verify that creating a meeting request successfully enqueues and logs a SENT email notification.
    """
    settings.RESEND_API_KEY = "re_test_key"
    
    # Create seller and buyer
    seller, seller_headers = create_test_user_helper(db_session, generate_jwt, client, email="seller@kpriet.ac.in", name="Seller Student")
    buyer, buyer_headers = create_test_user_helper(db_session, generate_jwt, client, email="buyer@kpriet.ac.in", name="Buyer Student")

    # Set both as approved
    seller.verification_status = "APPROVED"
    buyer.verification_status = "APPROVED"
    db_session.commit()

    # Create listing
    listing = Listing(
        id=uuid.uuid4(),
        seller_id=seller.id,
        title="Engineering Chemistry Textbook",
        description="Chemistry book by Jain & Jain",
        category="Textbooks",
        condition="Good",
        price=450.0,
        images=["chemistry.jpg"]
    )
    db_session.add(listing)
    db_session.commit()

    # Mock Resend API response
    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockResendResponse({
        "id": "resend_msg_12345"
    }, status_code=200)

    # Submit swap request payload
    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:30 AM",
        "meeting_location": "Library Entrance",
        "message": "Hey, I need it for the semester."
    }

    # API call
    response = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    assert response.status_code == 201

    # Verify EmailNotification record exists in DB
    email_log = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == seller.id,
        EmailNotification.notification_type == "MEETING_REQUEST"
    ).first()

    assert email_log is not None
    assert email_log.recipient_email == "seller@kpriet.ac.in"
    assert email_log.status == "SENT"
    assert email_log.provider_message_id == "resend_msg_12345"
    assert email_log.retry_count == 1
    assert email_log.last_attempt_at is not None


@patch("backend.app.services.email_service.httpx.Client")
def test_meeting_response_emails_sent(mock_http_client, client, generate_jwt, db_session):
    """
    Verify that accepting a meeting request triggers accepted email, and rejecting triggers rejected email.
    """
    settings.RESEND_API_KEY = "re_test_key"
    seller, seller_headers = create_test_user_helper(db_session, generate_jwt, client, email="seller2@kpriet.ac.in", name="Seller 2")
    buyer, buyer_headers = create_test_user_helper(db_session, generate_jwt, client, email="buyer2@kpriet.ac.in", name="Buyer 2")

    # Seed approved status
    seller.verification_status = "APPROVED"
    buyer.verification_status = "APPROVED"
    db_session.commit()

    listing = Listing(
        id=uuid.uuid4(),
        seller_id=seller.id,
        title="Lab Coat",
        description="White lab coat",
        category="Lab Equipment",
        condition="New",
        price=200.0,
        images=["labcoat.jpg"]
    )
    db_session.add(listing)
    db_session.commit()

    # Create manual purchase request in pending
    pr = PurchaseRequest(
        id=uuid.uuid4(),
        listing_id=listing.id,
        buyer_id=buyer.id,
        seller_id=seller.id,
        status="PENDING"
    )
    db_session.add(pr)
    db_session.flush()

    from backend.app.models import Meeting, TransactionConfirmation
    meeting = Meeting(
        request_id=pr.id,
        location="Main Gate",
        date="2026-06-25",
        time="2:00 PM",
        payment_method="CASH",
        status="PROPOSED"
    )
    db_session.add(meeting)
    db_session.flush()

    confirmation = TransactionConfirmation(meeting_id=meeting.id)
    db_session.add(confirmation)
    db_session.commit()

    # Mock Resend API response
    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockResendResponse({"id": "resend_msg_accept"}, status_code=200)

    # 1. Accept Request
    accept_response = client.post(f"/api/v1/orders/{pr.id}/accept", headers=seller_headers)
    assert accept_response.status_code == 200

    accept_log = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == buyer.id,
        EmailNotification.notification_type == "MEETING_ACCEPTED"
    ).first()
    assert accept_log is not None
    assert accept_log.status == "SENT"
    assert accept_log.provider_message_id == "resend_msg_accept"

    # Reset pr to pending for rejection test
    pr.status = "PENDING"
    meeting.status = "PROPOSED"
    listing.status = "available"
    db_session.commit()

    mock_client_instance.post.return_value = MockResendResponse({"id": "resend_msg_reject"}, status_code=200)

    # 2. Reject Request
    reject_response = client.post(f"/api/v1/orders/{pr.id}/reject", headers=seller_headers)
    assert reject_response.status_code == 200

    reject_log = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == buyer.id,
        EmailNotification.notification_type == "MEETING_REJECTED"
    ).first()
    assert reject_log is not None
    assert reject_log.status == "SENT"
    assert reject_log.provider_message_id == "resend_msg_reject"


@patch("backend.app.services.email_service.httpx.Client")
def test_chat_email_cooldown_protection(mock_http_client, client, generate_jwt, db_session):
    """
    Verify chat email cooldown:
    - First message: triggers email log.
    - Second message within 5 minutes: skips email log.
    - Message after 5 minutes: triggers new email log.
    """
    settings.RESEND_API_KEY = "re_test_key"
    sender, sender_headers = create_test_user_helper(db_session, generate_jwt, client, email="sender_chat@kpriet.ac.in")
    recipient, recipient_headers = create_test_user_helper(db_session, generate_jwt, client, email="recipient_chat@kpriet.ac.in")

    sender.verification_status = "APPROVED"
    recipient.verification_status = "APPROVED"
    db_session.commit()

    listing = Listing(
        id=uuid.uuid4(),
        seller_id=recipient.id,
        title="Physics Notes",
        description="First semester physics notes",
        category="Notes",
        condition="Good",
        price=50.0,
        images=["notes.jpg"]
    )
    db_session.add(listing)
    db_session.commit()

    # Initiate conversation
    conv = Conversation(
        product_id=listing.id,
        buyer_id=sender.id,
        seller_id=recipient.id
    )
    db_session.add(conv)
    db_session.commit()

    # Mock Resend response
    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockResendResponse({"id": "chat_resend_1"}, status_code=200)

    # 1. Send first message
    response1 = client.post(f"/api/v1/conversations/{conv.id}/messages", json={"content": "Hello!"}, headers=sender_headers)
    assert response1.status_code == 201

    logs1 = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == recipient.id,
        EmailNotification.notification_type == "CHAT_MESSAGE"
    ).all()
    assert len(logs1) == 1
    assert logs1[0].status == "SENT"
    assert logs1[0].provider_message_id == "chat_resend_1"

    # 2. Send second message immediately (within 5 min cooldown window)
    mock_client_instance.post.return_value = MockResendResponse({"id": "chat_resend_2"}, status_code=200)
    response2 = client.post(f"/api/v1/conversations/{conv.id}/messages", json={"content": "Are you there?"}, headers=sender_headers)
    assert response2.status_code == 201

    # Email notification count should still be 1 (second was skipped due to cooldown)
    logs2 = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == recipient.id,
        EmailNotification.notification_type == "CHAT_MESSAGE"
    ).all()
    assert len(logs2) == 1

    # 3. Artificially backdate the first log to trigger cooldown expiration (> 5 minutes ago)
    logs1[0].created_at = datetime.now(timezone.utc) - timedelta(minutes=6)
    db_session.commit()

    # Send third message (should send email since cooldown is expired)
    response3 = client.post(f"/api/v1/conversations/{conv.id}/messages", json={"content": "Please reply!"}, headers=sender_headers)
    assert response3.status_code == 201

    logs3 = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == recipient.id,
        EmailNotification.notification_type == "CHAT_MESSAGE"
    ).order_by(EmailNotification.created_at.desc()).all()
    assert len(logs3) == 2
    assert logs3[0].provider_message_id == "chat_resend_2"
    assert logs3[0].status == "SENT"


@patch("backend.app.services.email_service.httpx.Client")
def test_email_verification_status_check(mock_http_client, client, generate_jwt, db_session):
    """
    Verify that unverified users (status != APPROVED) do NOT receive email alerts.
    """
    settings.RESEND_API_KEY = "re_test_key"
    seller, seller_headers = create_test_user_helper(db_session, generate_jwt, client, email="unverified_seller@kpriet.ac.in")
    buyer, buyer_headers = create_test_user_helper(db_session, generate_jwt, client, email="verified_buyer@kpriet.ac.in")

    # Seller is NOT approved, buyer is approved
    seller.verification_status = "PENDING"
    buyer.verification_status = "APPROVED"
    db_session.commit()

    listing = Listing(
        id=uuid.uuid4(),
        seller_id=seller.id,
        title="Lab Coat",
        description="Chemistry lab coat",
        category="Lab Equipment",
        condition="New",
        price=200.0,
        images=["labcoat.jpg"]
    )
    db_session.add(listing)
    db_session.commit()

    # Proposal
    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:30 AM",
        "meeting_location": "Library Entrance",
        "message": "Let's meet!"
    }

    # API call
    response = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    assert response.status_code == 201

    # Verify no EmailNotification was enqueued for the seller (unverified)
    email_logs = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == seller.id
    ).all()
    assert len(email_logs) == 0


@patch("backend.app.services.email_service.httpx.Client")
def test_resend_api_failure_logs_correctly(mock_http_client, client, generate_jwt, db_session):
    """
    Verify that a Resend API failure:
    - Does NOT crash the main user endpoint (returns 201)
    - Correctly records a FAILED log inside the database
    """
    settings.RESEND_API_KEY = "re_test_key"
    seller, seller_headers = create_test_user_helper(db_session, generate_jwt, client, email="fail_seller@kpriet.ac.in")
    buyer, buyer_headers = create_test_user_helper(db_session, generate_jwt, client, email="fail_buyer@kpriet.ac.in")

    seller.verification_status = "APPROVED"
    buyer.verification_status = "APPROVED"
    db_session.commit()

    listing = Listing(
        id=uuid.uuid4(),
        seller_id=seller.id,
        title="Calculator",
        description="Scientific calculator",
        category="Calculators",
        condition="New",
        price=600.0,
        images=["calc.jpg"]
    )
    db_session.add(listing)
    db_session.commit()

    # Mock Resend API response to return a 500 error code
    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockResendResponse({
        "error": "Internal Server Error"
    }, status_code=500)

    # Submit swap request
    payload = {
        "product_id": str(listing.id),
        "payment_method": "UPI",
        "meeting_date": "2026-06-25",
        "meeting_time": "10:30 AM",
        "meeting_location": "Library Entrance"
    }

    # API call should succeed despite email dispatch failure
    response = client.post("/api/v1/orders/create", json=payload, headers=buyer_headers)
    assert response.status_code == 201

    # Verify EmailNotification record exists and has status = FAILED
    email_log = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == seller.id,
        EmailNotification.notification_type == "MEETING_REQUEST"
    ).first()

    assert email_log is not None
    assert email_log.status == "FAILED"
    assert "error status 500" in email_log.error_message.lower()


@patch("backend.app.services.email_service.httpx.Client")
def test_meeting_rescheduled_email_sent(mock_http_client, client, generate_jwt, db_session):
    """
    Verify that rescheduling a meeting as a seller triggers a MEETING_RESCHEDULED email notification to the buyer.
    """
    settings.RESEND_API_KEY = "re_test_key"
    seller, seller_headers = create_test_user_helper(db_session, generate_jwt, client, email="resched_seller@kpriet.ac.in", name="Seller Student")
    buyer, buyer_headers = create_test_user_helper(db_session, generate_jwt, client, email="resched_buyer@kpriet.ac.in", name="Buyer Student")

    # Seed approved status
    seller.verification_status = "APPROVED"
    buyer.verification_status = "APPROVED"
    db_session.commit()

    # Create listing
    listing = Listing(
        id=uuid.uuid4(),
        seller_id=seller.id,
        title="Physics Book",
        description="University Physics book",
        category="Textbooks",
        condition="Good",
        price=300.0,
        images=["physics.jpg"]
    )
    db_session.add(listing)
    db_session.commit()

    # Create manual purchase request in scheduled status
    pr = PurchaseRequest(
        id=uuid.uuid4(),
        listing_id=listing.id,
        buyer_id=buyer.id,
        seller_id=seller.id,
        status="ACCEPTED"
    )
    db_session.add(pr)
    db_session.flush()

    from backend.app.models import Meeting, TransactionConfirmation
    meeting = Meeting(
        request_id=pr.id,
        location="Main Gate",
        date="2026-06-25",
        time="2:00 PM",
        payment_method="CASH",
        status="SCHEDULED"
    )
    db_session.add(meeting)
    db_session.flush()

    confirmation = TransactionConfirmation(meeting_id=meeting.id)
    db_session.add(confirmation)
    db_session.commit()

    # Mock Resend API response
    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockResendResponse({"id": "resend_msg_resched"}, status_code=200)

    # Seller calls reschedule API
    payload = {
        "meeting_location": "Library Entrance",
        "meeting_date": "2026-06-26",
        "meeting_time": "3:00 PM"
    }
    response = client.post(f"/api/v1/orders/{pr.id}/reschedule", json=payload, headers=seller_headers)
    assert response.status_code == 200

    # Verify EmailNotification record exists in DB for the buyer
    email_log = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == buyer.id,
        EmailNotification.notification_type == "MEETING_RESCHEDULED"
    ).first()

    assert email_log is not None
    assert email_log.recipient_email == "resched_buyer@kpriet.ac.in"
    assert email_log.status == "SENT"
    assert email_log.provider_message_id == "resend_msg_resched"


@patch("backend.app.services.email_service.httpx.Client")
def test_meeting_rescheduled_by_buyer_email_sent(mock_http_client, client, generate_jwt, db_session):
    """
    Verify that rescheduling a meeting as a buyer triggers a MEETING_RESCHEDULED email notification to the seller.
    """
    settings.RESEND_API_KEY = "re_test_key"
    seller, seller_headers = create_test_user_helper(db_session, generate_jwt, client, email="resched_seller_b@kpriet.ac.in", name="Seller Student")
    buyer, buyer_headers = create_test_user_helper(db_session, generate_jwt, client, email="resched_buyer_b@kpriet.ac.in", name="Buyer Student")

    # Seed approved status
    seller.verification_status = "APPROVED"
    buyer.verification_status = "APPROVED"
    db_session.commit()

    # Create listing
    listing = Listing(
        id=uuid.uuid4(),
        seller_id=seller.id,
        title="Physics Book",
        description="University Physics book",
        category="Textbooks",
        condition="Good",
        price=300.0,
        images=["physics.jpg"]
    )
    db_session.add(listing)
    db_session.commit()

    # Create manual purchase request in scheduled status
    pr = PurchaseRequest(
        id=uuid.uuid4(),
        listing_id=listing.id,
        buyer_id=buyer.id,
        seller_id=seller.id,
        status="ACCEPTED"
    )
    db_session.add(pr)
    db_session.flush()

    from backend.app.models import Meeting, TransactionConfirmation
    meeting = Meeting(
        request_id=pr.id,
        location="Main Gate",
        date="2026-06-25",
        time="2:00 PM",
        payment_method="CASH",
        status="SCHEDULED"
    )
    db_session.add(meeting)
    db_session.flush()

    confirmation = TransactionConfirmation(meeting_id=meeting.id)
    db_session.add(confirmation)
    db_session.commit()

    # Mock Resend API response
    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockResendResponse({"id": "resend_msg_resched_buyer"}, status_code=200)

    # Buyer calls reschedule API
    payload = {
        "meeting_location": "Library Entrance",
        "meeting_date": "2026-06-26",
        "meeting_time": "3:00 PM"
    }
    response = client.post(f"/api/v1/orders/{pr.id}/reschedule", json=payload, headers=buyer_headers)
    assert response.status_code == 200

    # Verify EmailNotification record exists in DB for the seller
    email_log = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == seller.id,
        EmailNotification.notification_type == "MEETING_RESCHEDULED"
    ).first()

    assert email_log is not None
    assert email_log.recipient_email == "resched_seller_b@kpriet.ac.in"
    assert email_log.status == "SENT"
    assert email_log.provider_message_id == "resend_msg_resched_buyer"


@patch("backend.app.services.email_service.httpx.Client")
def test_meeting_cancelled_by_buyer_email_sent(mock_http_client, client, generate_jwt, db_session):
    """
    Verify that when a buyer withdraws/cancels a swap request, the seller receives a MEETING_CANCELLED email notification.
    """
    settings.RESEND_API_KEY = "re_test_key"
    seller, seller_headers = create_test_user_helper(db_session, generate_jwt, client, email="cancel_seller@kpriet.ac.in", name="Seller Student")
    buyer, buyer_headers = create_test_user_helper(db_session, generate_jwt, client, email="cancel_buyer@kpriet.ac.in", name="Buyer Student")

    # Seed approved status
    seller.verification_status = "APPROVED"
    buyer.verification_status = "APPROVED"
    db_session.commit()

    # Create listing
    listing = Listing(
        id=uuid.uuid4(),
        seller_id=seller.id,
        title="Physics Book",
        description="University Physics book",
        category="Textbooks",
        condition="Good",
        price=300.0,
        images=["physics.jpg"]
    )
    db_session.add(listing)
    db_session.commit()

    # Create manual purchase request in pending
    pr = PurchaseRequest(
        id=uuid.uuid4(),
        listing_id=listing.id,
        buyer_id=buyer.id,
        seller_id=seller.id,
        status="PENDING"
    )
    db_session.add(pr)
    db_session.flush()

    from backend.app.models import Meeting, TransactionConfirmation
    meeting = Meeting(
        request_id=pr.id,
        location="Main Gate",
        date="2026-06-25",
        time="2:00 PM",
        payment_method="CASH",
        status="PROPOSED"
    )
    db_session.add(meeting)
    db_session.flush()

    confirmation = TransactionConfirmation(meeting_id=meeting.id)
    db_session.add(confirmation)
    db_session.commit()

    # Mock Resend API response
    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockResendResponse({"id": "resend_msg_cancel"}, status_code=200)

    # 1. Buyer calls cancel (withdraws) via reject (legacy reject endpoint)
    response = client.post(f"/api/v1/orders/{pr.id}/reject", headers=buyer_headers)
    assert response.status_code == 200

    # Verify EmailNotification record exists in DB for the seller
    email_log = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == seller.id,
        EmailNotification.notification_type == "MEETING_CANCELLED"
    ).first()

    assert email_log is not None
    assert email_log.recipient_email == "cancel_seller@kpriet.ac.in"
    assert email_log.status == "SENT"
    assert email_log.provider_message_id == "resend_msg_cancel"


@patch("backend.app.services.email_service.httpx.Client")
def test_transaction_completed_email_sent(mock_http_client, client, generate_jwt, db_session):
    """
    Verify that completing a transaction (buyer and seller confirm) triggers a TRANSACTION_COMPLETED greeting email to the buyer.
    """
    settings.RESEND_API_KEY = "re_test_key"
    seller, seller_headers = create_test_user_helper(db_session, generate_jwt, client, email="complete_seller@kpriet.ac.in", name="Seller Student")
    buyer, buyer_headers = create_test_user_helper(db_session, generate_jwt, client, email="complete_buyer@kpriet.ac.in", name="Buyer Student")

    seller.verification_status = "APPROVED"
    buyer.verification_status = "APPROVED"
    db_session.commit()

    listing = Listing(
        id=uuid.uuid4(),
        seller_id=seller.id,
        title="Chemistry Book",
        description="University Chemistry book",
        category="Textbooks",
        condition="Good",
        price=300.0,
        images=["chemistry.jpg"]
    )
    db_session.add(listing)
    db_session.commit()

    pr = PurchaseRequest(
        id=uuid.uuid4(),
        listing_id=listing.id,
        buyer_id=buyer.id,
        seller_id=seller.id,
        status="ACCEPTED"
    )
    db_session.add(pr)
    db_session.flush()

    from backend.app.models import Meeting, TransactionConfirmation
    meeting = Meeting(
        request_id=pr.id,
        location="Main Gate",
        date="2026-06-25",
        time="2:00 PM",
        payment_method="CASH",
        status="SCHEDULED"
    )
    db_session.add(meeting)
    db_session.flush()

    confirmation = TransactionConfirmation(meeting_id=meeting.id, buyer_confirmed=False, seller_confirmed=False)
    db_session.add(confirmation)
    db_session.commit()

    # Mock Resend API response
    mock_client_instance = mock_http_client.return_value.__enter__.return_value
    mock_client_instance.post.return_value = MockResendResponse({"id": "resend_msg_completed"}, status_code=200)

    # 1. Buyer confirms product received
    response = client.post(f"/api/v1/orders/{pr.id}/complete", headers=buyer_headers)
    assert response.status_code == 200
    # At this point, order status is still not COMPLETED (only buyer confirmed)
    email_log = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == buyer.id,
        EmailNotification.notification_type == "TRANSACTION_COMPLETED"
    ).first()
    assert email_log is None

    # 2. Seller confirms payment received
    response2 = client.post(f"/api/v1/orders/{pr.id}/complete", headers=seller_headers)
    assert response2.status_code == 200

    # Verify EmailNotification record exists in DB for the buyer
    email_log = db_session.query(EmailNotification).filter(
        EmailNotification.user_id == buyer.id,
        EmailNotification.notification_type == "TRANSACTION_COMPLETED"
    ).first()

    assert email_log is not None
    assert email_log.recipient_email == "complete_buyer@kpriet.ac.in"
    assert email_log.status == "SENT"
    assert email_log.provider_message_id == "resend_msg_completed"




