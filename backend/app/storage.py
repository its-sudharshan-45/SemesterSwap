import httpx
from typing import List
from backend.app.config import settings

async def upload_to_supabase_storage(path: str, contents: bytes, content_type: str, user_token: str) -> str:
    """
    Uploads file contents to the 'listing-images' bucket in Supabase.
    Forwards the user's access token to execute with the user's RLS policies.
    """
    supabase_url = settings.SUPABASE_URL or settings.VITE_SUPABASE_URL
    if not supabase_url:
        raise Exception("Supabase URL is not configured.")

    # Format the endpoint url: /storage/v1/object/{bucket}/{path}
    url = f"{supabase_url.rstrip('/')}/storage/v1/object/listing-images/{path}"

    headers = {
        "Authorization": f"Bearer {user_token}",
        "Content-Type": content_type
    }

    async with httpx.AsyncClient() as client:
        # Supabase storage upload API is a POST request to storage/v1/object/{bucket}/{path}
        response = await client.post(url, content=contents, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Failed to upload image to Supabase Storage: {response.text}")

        # Return the public URL for the uploaded image
        return f"{supabase_url.rstrip('/')}/storage/v1/object/public/listing-images/{path}"

async def delete_from_supabase_storage(paths: List[str], user_token: str):
    """
    Deletes files from the 'listing-images' bucket in Supabase.
    Forwards the user's access token to execute with the user's RLS policies.
    """
    supabase_url = settings.SUPABASE_URL or settings.VITE_SUPABASE_URL
    if not supabase_url:
        raise Exception("Supabase URL is not configured.")

    # Supabase storage delete API is a DELETE request to storage/v1/object/{bucket}
    url = f"{supabase_url.rstrip('/')}/storage/v1/object/listing-images"

    headers = {
        "Authorization": f"Bearer {user_token}",
        "Content-Type": "application/json"
    }

    payload = {
        "prefixes": paths
    }

    async with httpx.AsyncClient() as client:
        response = await client.request("DELETE", url, json=payload, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Failed to delete images from Supabase Storage: {response.text}")
