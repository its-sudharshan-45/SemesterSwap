import uuid
from backend.app.models import User

def test_get_current_user_profile(client, generate_jwt, db_session):
    """
    Test GET /api/v1/users/me to verify it returns the authenticated user's profile details.
    """
    auth_id = str(uuid.uuid4())
    email = "24cs402@kpriet.ac.in"
    token = generate_jwt(auth_id=auth_id, email=email, full_name="Alice Smith", avatar_url="http://image.png")

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == email
    assert data["full_name"] == "Alice Smith"
    assert data["admission_year"] == 2024
    assert data["roll_number"] == 402
    assert data["profile_image"] == "http://image.png"

def test_update_allowed_profile_fields(client, generate_jwt, db_session):
    """
    Test PUT /api/v1/users/me to verify updating full_name and profile_image succeeds.
    """
    auth_id = str(uuid.uuid4())
    email = "24me305@kpriet.ac.in"
    token = generate_jwt(auth_id=auth_id, email=email, full_name="Bob Jones", avatar_url="http://bob.png")

    # Create profile
    headers = {"Authorization": f"Bearer {token}"}
    client.get("/api/v1/users/me", headers=headers)

    # Perform update
    update_data = {
        "full_name": "Robert Jones",
        "profile_image": "http://robert.png"
    }
    response = client.put("/api/v1/users/me", json=update_data, headers=headers)
    assert response.status_code == 200
    
    data = response.json()
    assert data["full_name"] == "Robert Jones"
    assert data["profile_image"] == "http://robert.png"
    
    # Verify DB update
    user_db = db_session.query(User).filter(User.email == email).first()
    assert user_db.full_name == "Robert Jones"
    assert user_db.profile_image == "http://robert.png"

def test_update_ignores_readonly_fields(client, generate_jwt, db_session):
    """
    Test PUT /api/v1/users/me with payload containing read-only fields
    (admission_year, roll_number, email, auth_id, rating, total_transactions).
    Verify that the API ignores them and they remain unchanged.
    """
    auth_id_str = str(uuid.uuid4())
    email = "24ec201@kpriet.ac.in"
    token = generate_jwt(auth_id=auth_id_str, email=email, full_name="Charlie Brown", avatar_url="http://charlie.png")

    # Create profile
    headers = {"Authorization": f"Bearer {token}"}
    client.get("/api/v1/users/me", headers=headers)

    # Try to change read-only fields
    payload = {
        "full_name": "Charlie Updated",
        "email": "hacker@kpriet.ac.in",
        "admission_year": 2026,
        "roll_number": 999,
        "rating": 5.0,
        "total_transactions": 100,
        "auth_id": str(uuid.uuid4())
    }
    response = client.put("/api/v1/users/me", json=payload, headers=headers)
    assert response.status_code == 200
    
    data = response.json()
    assert data["full_name"] == "Charlie Updated" # Allowed update
    assert data["email"] == email # Unchanged
    assert data["admission_year"] == 2024 # Unchanged
    assert data["roll_number"] == 201 # Unchanged
    assert data["rating"] == 0.0 # Unchanged
    assert data["total_transactions"] == 0 # Unchanged
    assert data["auth_id"] == auth_id_str # Unchanged

    # Query directly from DB to verify
    user_db = db_session.query(User).filter(User.email == email).first()
    assert user_db.full_name == "Charlie Updated"
    assert user_db.email == email
    assert user_db.admission_year == 2024
    assert user_db.roll_number == 201
    assert user_db.rating == 0.0
    assert user_db.total_transactions == 0
    assert str(user_db.auth_id) == auth_id_str
