import io
import uuid
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from backend.app.auth import get_current_user, security
from backend.app.models import User
from backend.app.storage import upload_to_supabase_storage, delete_from_supabase_storage
from PIL import Image

router = APIRouter(prefix="/api/v1/uploads", tags=["uploads"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

@router.post("/listing-image", status_code=status.HTTP_201_CREATED)
async def upload_listing_image(
    listing_id: UUID = Query(..., description="The UUID of the listing this image belongs to"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Validates, compresses, and uploads a listing image to Supabase Storage.
    Returns the public URL and storage path.
    """
    # 1. Validate MIME type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPEG, PNG, and WEBP images are supported."
        )

    # 2. Read contents and validate size
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the maximum limit of 5MB."
        )

    # 3. Compress and optimize image using Pillow
    content_type = file.content_type or "image/jpeg"
    try:
        image_stream = io.BytesIO(contents)
        img = Image.open(image_stream)

        # Handle rotation from EXIF if present
        try:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # Convert RGBA/P formats to RGB if we want to compress as JPEG
        if img.mode in ("RGBA", "P") and content_type == "image/jpeg":
            img = img.convert("RGB")

        # Resize to a maximum boundary of 1600x1600 px if larger
        img.thumbnail((1600, 1600))

        # Save to buffer with quality compression (80%)
        output_buffer = io.BytesIO()
        img_format = img.format if img.format else "JPEG"
        img.save(output_buffer, format=img_format, quality=80, optimize=True)
        contents = output_buffer.getvalue()
    except Exception as e:
        # If image parsing/compression fails, fall back to uploading the raw file
        pass

    # 4. Generate unique file path
    ext = file.filename.split(".")[-1].lower() if file.filename and "." in file.filename else "jpg"
    # Ensure file extension is safe
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    
    unique_filename = f"{uuid.uuid4()}.{ext}"
    path = f"{current_user.auth_id}/{listing_id}/{unique_filename}"

    # 5. Upload to Supabase Storage
    try:
        public_url = await upload_to_supabase_storage(
            path=path,
            contents=contents,
            content_type=content_type,
            user_token=credentials.credentials
        )
        return {
            "url": public_url,
            "path": path
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


@router.delete("/listing-image", status_code=status.HTTP_200_OK)
async def delete_listing_image(
    path: str = Query(..., description="The storage path key to delete, e.g. user-id/listing-id/file.jpg"),
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Deletes a listing image from Supabase Storage.
    Verifies that the user trying to delete owns the folder containing the image.
    """
    # Split the path by '/' to check ownership
    parts = path.strip("/").split("/")
    if not parts or parts[0] != str(current_user.auth_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this image."
        )

    try:
        await delete_from_supabase_storage([path], credentials.credentials)
        return {
            "status": "success",
            "message": "Image deleted successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete image: {str(e)}"
        )


@router.post("/profile-image", status_code=status.HTTP_201_CREATED)
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Validates, compresses, and uploads a student profile image to Supabase Storage.
    Returns the public URL and storage path.
    """
    # 1. Validate MIME type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPEG, PNG, and WEBP images are supported."
        )

    # 2. Read contents and validate size
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the maximum limit of 5MB."
        )

    # 3. Compress and optimize image using Pillow
    content_type = file.content_type or "image/jpeg"
    try:
        image_stream = io.BytesIO(contents)
        img = Image.open(image_stream)

        # Handle rotation from EXIF if present
        try:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # Convert RGBA/P formats to RGB if we want to compress as JPEG
        if img.mode in ("RGBA", "P") and content_type == "image/jpeg":
            img = img.convert("RGB")

        # Resize to a maximum boundary of 800x800 px for profile pictures
        img.thumbnail((800, 800))

        # Save to buffer with quality compression (85%)
        output_buffer = io.BytesIO()
        img_format = img.format if img.format else "JPEG"
        img.save(output_buffer, format=img_format, quality=85, optimize=True)
        contents = output_buffer.getvalue()
    except Exception as e:
        pass

    # 4. Generate unique file path
    ext = file.filename.split(".")[-1].lower() if file.filename and "." in file.filename else "jpg"
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    
    unique_filename = f"profile-{uuid.uuid4()}.{ext}"
    path = f"{current_user.auth_id}/profile/{unique_filename}"

    # 5. Upload to Supabase Storage
    try:
        public_url = await upload_to_supabase_storage(
            path=path,
            contents=contents,
            content_type=content_type,
            user_token=credentials.credentials
        )
        return {
            "url": public_url,
            "path": path
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )

