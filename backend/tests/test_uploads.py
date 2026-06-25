import io
import uuid
# pyrefly: ignore [missing-import]
import pytest
from unittest.mock import patch, AsyncMock
from backend.app.models import User

def create_test_user(db_session, generate_jwt, client, email="24cs101@kpriet.ac.in", name="Test User"):
    auth_id = str(uuid.uuid4())
    token = generate_jwt(auth_id=auth_id, email=email, full_name=name)
    headers = {"Authorization": f"Bearer {token}"}
    client.get("/api/v1/users/me", headers=headers)
    user = db_session.query(User).filter(User.email == email).first()
    return user, headers

@patch("backend.app.uploads.upload_to_supabase_storage", new_callable=AsyncMock)
def test_upload_image_success(mock_upload, client, generate_jwt, db_session):
    """
    Verify upload endpoint processes images correctly, applying Pillow resize/compression and returning URL.
    """
    user, headers = create_test_user(db_session, generate_jwt, client)
    mock_upload.return_value = "http://supabase.storage/listing-images/user/listing/img.jpg"

    listing_id = uuid.uuid4()
    
    # 1. Create a dummy simple red 100x100 PNG image using Pillow
    from PIL import Image
    img = Image.new("RGB", (100, 100), color="red")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_byte_arr = img_byte_arr.getvalue()

    files = {"file": ("test.png", img_byte_arr, "image/png")}

    response = client.post(
        f"/api/v1/uploads/listing-image?listing_id={listing_id}",
        files=files,
        headers=headers
    )

    assert response.status_code == 201
    data = response.json()
    assert "url" in data
    assert "path" in data
    assert str(user.auth_id) in data["path"]
    assert str(listing_id) in data["path"]
    
    # Verify our upload function mock was called with path and token
    mock_upload.assert_called_once()
    args, kwargs = mock_upload.call_args
    assert str(user.auth_id) in kwargs["path"]
    assert str(listing_id) in kwargs["path"]

def test_upload_image_invalid_type(client, generate_jwt, db_session):
    """
    Verify non-image formats are rejected.
    """
    user, headers = create_test_user(db_session, generate_jwt, client)
    listing_id = uuid.uuid4()
    
    files = {"file": ("test.txt", b"plain text file contents", "text/plain")}
    
    response = client.post(
        f"/api/v1/uploads/listing-image?listing_id={listing_id}",
        files=files,
        headers=headers
    )
    
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]

def test_upload_image_exceeds_size(client, generate_jwt, db_session):
    """
    Verify files > 5MB are rejected.
    """
    user, headers = create_test_user(db_session, generate_jwt, client)
    listing_id = uuid.uuid4()
    
    # Generate 5.1MB byte array
    huge_data = b"x" * (5 * 1024 * 1024 + 1024)
    files = {"file": ("test.jpg", huge_data, "image/jpeg")}
    
    response = client.post(
        f"/api/v1/uploads/listing-image?listing_id={listing_id}",
        files=files,
        headers=headers
    )
    
    assert response.status_code == 400
    assert "File size exceeds" in response.json()["detail"]

@patch("backend.app.uploads.delete_from_supabase_storage", new_callable=AsyncMock)
def test_delete_image_authorization(mock_delete, client, generate_jwt, db_session):
    """
    Verify deletion requires ownership of the path matching the user's auth_id.
    """
    user, headers = create_test_user(db_session, generate_jwt, client)
    mock_delete.return_value = None

    listing_id = uuid.uuid4()
    
    # 1. Valid delete path (starts with current user's auth_id)
    valid_path = f"{user.auth_id}/{listing_id}/image.jpg"
    response = client.delete(
        f"/api/v1/uploads/listing-image?path={valid_path}",
        headers=headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    mock_delete.assert_called_once_with([valid_path], headers["Authorization"].split(" ")[1])

    # 2. Invalid delete path (starts with a different auth_id)
    mock_delete.reset_mock()
    other_auth_id = str(uuid.uuid4())
    invalid_path = f"{other_auth_id}/{listing_id}/image.jpg"
    response = client.delete(
        f"/api/v1/uploads/listing-image?path={invalid_path}",
        headers=headers
    )
    assert response.status_code == 403
    assert "not authorized" in response.json()["detail"]
    mock_delete.assert_not_called()


@patch("backend.app.uploads.upload_to_supabase_storage", new_callable=AsyncMock)
def test_upload_profile_image_success(mock_upload, client, generate_jwt, db_session):
    """
    Verify profile image upload endpoint processes profile pictures,
    applies Pillow resize/compression, and returns profile-specific URL.
    """
    user, headers = create_test_user(db_session, generate_jwt, client)
    mock_upload.return_value = "http://supabase.storage/profile-images/user/profile/img.jpg"

    # Create a dummy PNG image using Pillow
    from PIL import Image
    img = Image.new("RGB", (200, 200), color="blue")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_byte_arr = img_byte_arr.getvalue()

    files = {"file": ("avatar.png", img_byte_arr, "image/png")}

    response = client.post(
        "/api/v1/uploads/profile-image",
        files=files,
        headers=headers
    )

    assert response.status_code == 201
    data = response.json()
    assert "url" in data
    assert "path" in data
    assert f"{user.auth_id}/profile/profile-" in data["path"]
    
    mock_upload.assert_called_once()
    args, kwargs = mock_upload.call_args
    assert f"{user.auth_id}/profile/profile-" in kwargs["path"]


def test_upload_profile_image_invalid_type(client, generate_jwt, db_session):
    """
    Verify profile image endpoint rejects non-image files.
    """
    user, headers = create_test_user(db_session, generate_jwt, client)
    files = {"file": ("test.pdf", b"pdf file dummy data", "application/pdf")}
    
    response = client.post(
        "/api/v1/uploads/profile-image",
        files=files,
        headers=headers
    )
    
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]


def test_upload_profile_image_exceeds_size(client, generate_jwt, db_session):
    """
    Verify profile image endpoint rejects files exceeding 5MB.
    """
    user, headers = create_test_user(db_session, generate_jwt, client)
    huge_data = b"y" * (5 * 1024 * 1024 + 1024)
    files = {"file": ("huge_avatar.jpg", huge_data, "image/jpeg")}
    
    response = client.post(
        "/api/v1/uploads/profile-image",
        files=files,
        headers=headers
    )
    
    assert response.status_code == 400
    assert "File size exceeds" in response.json()["detail"]
