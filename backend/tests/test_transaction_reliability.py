import pytest
from sqlalchemy.exc import IntegrityError
from backend.app.models import (
    User, Listing, PurchaseRequest, Meeting, 
    TransactionConfirmation, Notification, TransactionAuditLog,
    AuditAction, NotificationType, College, Department, MeetingLocation
)
from backend.app.validators.transaction_state_validator import (
    validate_status_transition, InvalidStateTransitionException
)
import uuid
from datetime import datetime, timezone, timedelta

def create_test_user(db_session, generate_jwt, client, email="user@kpriet.ac.in", name="Test User"):
    auth_id = str(uuid.uuid4())
    token = generate_jwt(auth_id=auth_id, email=email, full_name=name)
    headers = {"Authorization": f"Bearer {token}"}
    client.get("/api/v1/users/me", headers=headers)
    user = db_session.query(User).filter(User.email == email).first()
    return user, headers

def test_database_integrity_constraints(db_session):
    # Retrieve pre-seeded college and department
    college = db_session.query(College).first()
    dept = db_session.query(Department).first()

    # Create two users
    user_a = User(
        auth_id=uuid.uuid4(),
        college_id=college.id,
        department_id=dept.id,
        full_name="User A",
        email="usera@kpriet.ac.in"
    )
    user_b = User(
        auth_id=uuid.uuid4(),
        college_id=college.id,
        department_id=dept.id,
        full_name="User B",
        email="userb@kpriet.ac.in"
    )
    db_session.add_all([user_a, user_b])
    db_session.commit()

    # Create listing
    listing = Listing(
        seller_id=user_a.id,
        title="Dynamic Book",
        description="Book description",
        category="Textbooks",
        condition="New",
        price=50.0,
        status="available"
    )
    db_session.add(listing)
    db_session.commit()

    # Constraint 1: Self-purchase block (buyer_id != seller_id)
    invalid_req = PurchaseRequest(
        listing_id=listing.id,
        buyer_id=user_a.id,  # Same as listing seller_id
        seller_id=user_a.id,
        status="PENDING"
    )
    db_session.add(invalid_req)
    with pytest.raises((IntegrityError, Exception)):
        db_session.commit()
    db_session.rollback()

    # Constraint 2: Payment method check constraint (payment_method IN ('CASH', 'UPI'))
    valid_req = PurchaseRequest(
        listing_id=listing.id,
        buyer_id=user_b.id,
        seller_id=user_a.id,
        status="PENDING"
    )
    db_session.add(valid_req)
    db_session.commit()

    # Create meeting with invalid payment method
    invalid_meeting = Meeting(
        request_id=valid_req.id,
        location="Library Entrance",
        date="2026-06-25",
        time="10:00 AM - 11:00 AM",
        payment_method="CARD",  # Invalid! Only CASH and UPI allowed
        status="PROPOSED"
    )
    db_session.add(invalid_meeting)
    with pytest.raises((IntegrityError, Exception)):
        db_session.commit()
    db_session.rollback()

    # Constraint 3: Unique confirmation per meeting
    valid_meeting = Meeting(
        request_id=valid_req.id,
        location="Library Entrance",
        date="2026-06-25",
        time="10:00 AM - 11:00 AM",
        payment_method="UPI",
        status="PROPOSED"
    )
    db_session.add(valid_meeting)
    db_session.commit()

    conf_1 = TransactionConfirmation(
        meeting_id=valid_meeting.id,
        buyer_confirmed=True,
        seller_confirmed=False
    )
    db_session.add(conf_1)
    db_session.commit()

    conf_2 = TransactionConfirmation(
        meeting_id=valid_meeting.id,
        buyer_confirmed=False,
        seller_confirmed=True
    )
    db_session.add(conf_2)
    with pytest.raises((IntegrityError, Exception)):
        db_session.commit()
    db_session.rollback()


def test_transaction_state_transitions():
    # Valid transitions from PENDING
    assert validate_status_transition("PENDING", "ACCEPTED") is None
    assert validate_status_transition("PENDING", "REJECTED") is None
    assert validate_status_transition("PENDING", "CANCELLED") is None
    assert validate_status_transition("PENDING", "EXPIRED") is None

    # Valid transitions from ACCEPTED
    assert validate_status_transition("ACCEPTED", "COMPLETED") is None
    assert validate_status_transition("ACCEPTED", "CANCELLED") is None

    # Invalid transitions
    with pytest.raises(InvalidStateTransitionException):
        validate_status_transition("PENDING", "COMPLETED")
    
    with pytest.raises(InvalidStateTransitionException):
        validate_status_transition("ACCEPTED", "PENDING")

    with pytest.raises(InvalidStateTransitionException):
        validate_status_transition("COMPLETED", "CANCELLED")

    with pytest.raises(InvalidStateTransitionException):
        validate_status_transition("CANCELLED", "ACCEPTED")


def test_authorization_and_job_execution(client, generate_jwt, db_session):
    # Create normal student users
    student, student_headers = create_test_user(db_session, generate_jwt, client, "student@kpriet.ac.in", "Student User")

    # 1. Verify that admin web routes return 404 Not Found since they are completely deleted
    res = client.get("/api/v1/admin/audit-logs", headers=student_headers)
    assert res.status_code == 404

    res = client.post("/api/v1/admin/jobs/run-expiration", headers=student_headers)
    assert res.status_code == 404

    res = client.post("/api/v1/admin/jobs/process-no-shows", headers=student_headers)
    assert res.status_code == 404

    res = client.post("/api/v1/admin/jobs/send-reminders", headers=student_headers)
    assert res.status_code == 404

    # Locations modification routes are deleted too and should return 405/404
    payload = {"name": "Test Garden", "description": "Beautiful place"}
    res = client.post("/api/v1/locations", json=payload, headers=student_headers)
    assert res.status_code == 405

    res = client.put("/api/v1/locations/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", json=payload, headers=student_headers)
    assert res.status_code == 404

    res = client.delete("/api/v1/locations/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", headers=student_headers)
    assert res.status_code == 404

    # 2. Verify student can read locations dynamically from DB via GET /api/v1/locations
    # At start, seeder created 5 default meeting locations
    res = client.get("/api/v1/locations", headers=student_headers)
    assert res.status_code == 200
    locations_list = res.json()
    assert len(locations_list) == 5

    res = client.get("/api/v1/orders/locations", headers=student_headers)
    assert res.status_code == 200
    names_list = res.json()
    assert len(names_list) == 5
    assert "Library Entrance" in names_list

    # 3. Test administrative operations via CLI script
    from unittest.mock import patch
    from backend.app.cli import main as cli_main

    class SessionMock:
        def __init__(self, session):
            self._session = session
        def __enter__(self):
            return self._session
        def __exit__(self, exc_type, exc_val, exc_tb):
            pass
        def close(self):
            pass
        def __getattr__(self, item):
            return getattr(self._session, item)

    mock_session = SessionMock(db_session)
    with patch("backend.app.cli.SessionLocal", lambda: mock_session):
        # 3a. Add a new location
        with patch("sys.argv", ["cli.py", "locations", "add", "CLI Park", "-d", "CLI-created park"]):
            cli_main()

        # Verify added in DB
        new_loc = db_session.query(MeetingLocation).filter(MeetingLocation.name == "CLI Park").first()
        assert new_loc is not None
        assert new_loc.is_active is True
        assert new_loc.description == "CLI-created park"

        # 3b. List locations (check execution output doesn't crash)
        with patch("sys.argv", ["cli.py", "locations", "list"]):
            cli_main()

        # 3c. Delete location
        with patch("sys.argv", ["cli.py", "locations", "delete", "CLI Park"]):
            cli_main()

        db_session.refresh(new_loc)
        assert not new_loc.is_active
        assert new_loc.deleted_at is not None

        # 3d. Run background jobs via CLI
        with patch("sys.argv", ["cli.py", "run-jobs"]):
            cli_main()

        # 3e. View audit logs CLI
        with patch("sys.argv", ["cli.py", "audit-logs"]):
            cli_main()

        # 3f. Dispute override
        buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer_cli@kpriet.ac.in", "Buyer CLI")
        seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller_cli@kpriet.ac.in", "Seller CLI")
        
        listing = Listing(
            seller_id=seller.id,
            title="CLI Book",
            description="Book description",
            category="Textbooks",
            condition="Good",
            price=30.0,
            status="available"
        )
        db_session.add(listing)
        db_session.commit()
        
        req = PurchaseRequest(
            listing_id=listing.id,
            buyer_id=buyer.id,
            seller_id=seller.id,
            status="CANCELLED"
        )
        db_session.add(req)
        db_session.commit()
        
        meeting = Meeting(
            request_id=req.id,
            location="Library Entrance",
            date="2026-06-25",
            time="10:00 AM - 11:00 AM",
            payment_method="UPI",
            status="NO_SHOW"
        )
        db_session.add(meeting)
        db_session.commit()
        
        conf = TransactionConfirmation(
            meeting_id=meeting.id,
            buyer_confirmed=False,
            seller_confirmed=False
        )
        db_session.add(conf)
        db_session.commit()

        # Execute dispute override
        with patch("sys.argv", ["cli.py", "override-no-show", str(req.id)]):
            cli_main()

        db_session.refresh(req)
        db_session.refresh(meeting)
        assert req.status == "ACCEPTED"
        assert meeting.status == "SCHEDULED"
        assert meeting.no_show_marked_at is None
        assert conf.buyer_confirmed is False
        assert conf.seller_confirmed is False



def test_audit_logs_and_notifications_coverage(client, generate_jwt, db_session):
    buyer, buyer_headers = create_test_user(db_session, generate_jwt, client, "buyer_aud@kpriet.ac.in", "Buyer Aud")
    seller, seller_headers = create_test_user(db_session, generate_jwt, client, "seller_aud@kpriet.ac.in", "Seller Aud")

    # 1. Create a listing
    listing = Listing(
        seller_id=seller.id,
        title="Maths Book",
        description="Maths book description",
        category="Textbooks",
        condition="Good",
        price=30.0,
        status="available"
    )
    db_session.add(listing)
    db_session.commit()

    # 2. Buyer creates purchase request
    req_payload = {
        "product_id": str(listing.id),
        "payment_method": "CASH",
        "meeting_date": "2026-06-25",
        "meeting_time": "12:00 PM - 01:00 PM",
        "meeting_location": "Library Entrance"
    }
    res = client.post("/api/v1/orders/create", json=req_payload, headers=buyer_headers)
    assert res.status_code == 201
    req_id = res.json()["id"]

    # Verify REQUEST_CREATED audit log
    audit_log = db_session.query(TransactionAuditLog).filter(
        TransactionAuditLog.purchase_request_id == uuid.UUID(req_id),
        TransactionAuditLog.action_type == AuditAction.REQUEST_CREATED
    ).first()
    assert audit_log is not None
    assert audit_log.actor_id == buyer.id
    assert audit_log.old_status is None
    assert audit_log.new_status == "PENDING"

    # Verify notifications were created
    notifications = db_session.query(Notification).filter(Notification.user_id == seller.id).all()
    assert any(n.type == NotificationType.NEW_REQUEST for n in notifications)

    # 3. Seller accepts request
    res = client.post(f"/api/v1/orders/{req_id}/accept", headers=seller_headers)
    assert res.status_code == 200

    # Verify REQUEST_ACCEPTED audit log
    audit_log_accept = db_session.query(TransactionAuditLog).filter(
        TransactionAuditLog.purchase_request_id == uuid.UUID(req_id),
        TransactionAuditLog.action_type == AuditAction.REQUEST_ACCEPTED
    ).first()
    assert audit_log_accept is not None
    assert audit_log_accept.actor_id == seller.id
    assert audit_log_accept.old_status == "PENDING"
    assert audit_log_accept.new_status == "ACCEPTED"

    # Verify notifications
    buyer_notifs = db_session.query(Notification).filter(
        Notification.user_id == buyer.id,
        Notification.type == NotificationType.REQUEST_ACCEPTED
    ).all()
    assert len(buyer_notifs) > 0


def test_trust_scoring_logic(client, generate_jwt, db_session):
    user, headers = create_test_user(db_session, generate_jwt, client, "newuser@kpriet.ac.in", "New Student")
    user.rating = 5.0
    user.total_transactions = 2
    db_session.commit()

    # 1. Less than 3 completed swaps -> "New User"
    res = client.get(f"/api/v1/users/{user.id}/trust-profile", headers=headers)
    assert res.status_code == 200
    profile = res.json()
    assert profile["reliability_level"] == "New User"
    assert profile["reliability_score"] is None

    # 2. More than 3 swaps -> reliable user calculation
    user_rel, headers_rel = create_test_user(db_session, generate_jwt, client, "reluser@kpriet.ac.in", "Reliable Student")
    user_rel.rating = 4.0
    db_session.commit()

    # Let's seed 4 completed swaps involving this user
    other_user, _ = create_test_user(db_session, generate_jwt, client, "other@kpriet.ac.in", "Other User")
    
    listing = Listing(
        seller_id=user_rel.id,
        title="Test Book",
        description="Book description",
        category="Textbooks",
        condition="Good",
        price=10.0,
        status="sold"
    )
    db_session.add(listing)
    db_session.commit()

    for i in range(4):
        req = PurchaseRequest(
            listing_id=listing.id,
            buyer_id=other_user.id,
            seller_id=user_rel.id,
            status="COMPLETED"
        )
        db_session.add(req)
    
    # 1 cancellation
    req_cancelled = PurchaseRequest(
        listing_id=listing.id,
        buyer_id=other_user.id,
        seller_id=user_rel.id,
        status="CANCELLED",
        cancelled_by=user_rel.id
    )
    db_session.add(req_cancelled)
    
    # no shows: none seeded yet
    db_session.commit()

    # score = 50 + (4 swaps * 3) + (4.0 rating * 5) - (1 cancellation * 2) - (0 no shows * 5)
    # score = 50 + 12 + 20 - 2 = 80
    res = client.get(f"/api/v1/users/{user_rel.id}/trust-profile", headers=headers_rel)
    assert res.status_code == 200
    profile = res.json()
    assert profile["reliability_score"] == 80
    assert profile["reliability_level"] == "Reliable User"
