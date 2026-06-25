import uuid
from backend.app.models import User, College

def test_google_login_verified_domain(client, generate_jwt, db_session):
    """
    Test that signing in with a verified college email domain (e.g. @kpriet.ac.in)
    creates a profile and permits access.
    """
    auth_id = str(uuid.uuid4())
    email = "24ad119@kpriet.ac.in"
    token = generate_jwt(auth_id=auth_id, email=email, full_name="John Doe", avatar_url="http://image.url")

    # Call the GET /api/v1/users/me endpoint with the JWT
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/users/me", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == email
    assert data["full_name"] == "John Doe"
    assert data["admission_year"] == 2024
    assert data["roll_number"] == 119
    assert data["profile_image"] == "http://image.url"
    
    # Assert college and department info are resolved correctly
    assert data["college"] is not None
    assert data["college"]["email_domain"] == "kpriet.ac.in"
    assert data["department"] is not None
    assert data["department"]["code"] == "ad"

    # Verify user was created in DB
    user_db = db_session.query(User).filter(User.email == email).first()
    assert user_db is not None
    assert str(user_db.auth_id) == auth_id

def test_google_login_unauthorized_domain(client, generate_jwt, db_session):
    """
    Test that signing in with a domain not matching any approved colleges
    raises a 403 Forbidden error and blocks access.
    """
    auth_id = str(uuid.uuid4())
    email = "24ad119@unapproved.edu"
    token = generate_jwt(auth_id=auth_id, email=email)

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/users/me", headers=headers)
    
    assert response.status_code == 403
    assert "Only verified college students can access SemesterSwap." in response.json()["detail"]

    # Verify no user profile was created in DB
    user_db = db_session.query(User).filter(User.email == email).first()
    assert user_db is None

def test_unauthenticated_request_fails(client):
    """
    Test that requests without credentials or with invalid signatures return 401.
    """
    # Missing headers
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401

    # Invalid token signature/format
    headers = {"Authorization": "Bearer invalid.token.payload"}
    response = client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 401
    assert "Invalid authentication credentials" in response.json()["detail"]

def test_asymmetric_token_verification(client, db_session):
    """
    Test that signing in with a token signed with ES256 and verified
    using mocked JWKS endpoint works correctly.
    """
    from unittest.mock import patch
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    from jose import jwk, jwt
    import uuid

    # 1. Generate an EC key pair
    private_key_obj = ec.generate_private_key(ec.SECP256R1())
    public_key_obj = private_key_obj.public_key()
    
    # 2. Get public key in PEM and convert to JWK
    pem_public = public_key_obj.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()
    jose_public_key = jwk.construct(pem_public, algorithm="ES256")
    jwk_dict = jose_public_key.to_dict()
    # Add kid and extra keys
    kid = "test-kid-123"
    jwk_dict["kid"] = kid
    jwk_dict["alg"] = "ES256"
    jwk_dict["use"] = "sig"
    jwk_dict["kty"] = "EC"
    
    # 3. Sign a token with the private key
    pem_private = private_key_obj.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode()
    
    auth_id = str(uuid.uuid4())
    email = "24ad119@kpriet.ac.in"
    payload = {
        "sub": auth_id,
        "email": email,
        "role": "authenticated",
        "user_metadata": {
            "full_name": "Asymmetric Student",
            "avatar_url": "http://image.url"
        }
    }
    # Headers must contain kid and alg
    headers_jwt = {"kid": kid, "alg": "ES256"}
    token = jwt.encode(payload, pem_private, algorithm="ES256", headers=headers_jwt)
    
    # 4. Patch settings and fetch_jwks to return our mock JWK
    with patch("backend.app.auth.settings.SUPABASE_URL", "https://mock.supabase.co"), \
         patch("backend.app.auth.fetch_jwks") as mock_fetch:
        
        mock_fetch.return_value = [jwk_dict]
        
        # 5. Call API
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/users/me", headers=headers)
        
        # 6. Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == email
        assert data["full_name"] == "Asymmetric Student"
        assert data["admission_year"] == 2024
        assert data["roll_number"] == 119
        
        # Verify call parameters
        mock_fetch.assert_called_once_with("https://mock.supabase.co/auth/v1/.well-known/jwks.json")

