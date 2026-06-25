from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, jwk, JWTError
from sqlalchemy.orm import Session
from uuid import UUID
import time
import urllib.request
import json
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models import User

security = HTTPBearer()

# In-memory cache for JWKS keys to avoid requesting keys on every API call
JWKS_CACHE = {}
JWKS_CACHE_EXPIRY = 3600  # Cache for 1 hour

def fetch_jwks(jwks_url: str):
    """
    Fetches the JSON Web Key Set (JWKS) from the given URL and caches it in memory.
    """
    now = time.time()
    if jwks_url in JWKS_CACHE:
        cache_entry = JWKS_CACHE[jwks_url]
        if now - cache_entry["timestamp"] < JWKS_CACHE_EXPIRY:
            return cache_entry["keys"]
            
    try:
        req = urllib.request.Request(
            jwks_url,
            headers={"User-Agent": "SemesterSwap-Backend"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            jwks_data = json.loads(response.read().decode())
            keys = jwks_data.get("keys", [])
            JWKS_CACHE[jwks_url] = {
                "timestamp": now,
                "keys": keys
            }
            return keys
    except Exception as e:
        # Fall back to expired cache if fetching fails
        if jwks_url in JWKS_CACHE:
            import logging
            logger = logging.getLogger("uvicorn.error")
            logger.warning(f"Failed to fetch fresh JWKS from {jwks_url}, using cached keys: {e}")
            return JWKS_CACHE[jwks_url]["keys"]
        raise e

def decode_token(token: str) -> dict:
    """
    Decodes the JWT token.
    Supports symmetric validation (HS256) and asymmetric validation (ES256, RS256) via JWKS.
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception as e:
        raise JWTError(f"Invalid token header: {str(e)}")
        
    alg = unverified_header.get("alg")
    if not alg:
        raise JWTError("Token header is missing 'alg' parameter.")
        
    if alg == "HS256":
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
    elif alg in ("ES256", "RS256"):
        supabase_url = settings.SUPABASE_URL or settings.VITE_SUPABASE_URL
        if not supabase_url:
            raise JWTError("Supabase URL is not configured for asymmetric token verification.")
            
        jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        
        try:
            keys = fetch_jwks(jwks_url)
        except Exception as e:
            raise JWTError(f"Failed to fetch JWKS from {jwks_url}: {str(e)}")
            
        kid = unverified_header.get("kid")
        if not kid:
            raise JWTError("Token header is missing 'kid' parameter for asymmetric verification.")
            
        key_data = next((k for k in keys if k.get("kid") == kid), None)
        if not key_data:
            raise JWTError(f"Key ID '{kid}' not found in JWKS.")
            
        try:
            public_key = jwk.construct(key_data)
        except Exception as e:
            raise JWTError(f"Failed to construct public key from JWK: {str(e)}")
            
        return jwt.decode(
            token,
            public_key,
            algorithms=[alg],
            options={"verify_aud": False}
        )
    else:
        raise JWTError(f"Algorithm '{alg}' is not supported.")

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Decodes the JWT token from the Authorization header and retrieves the user profile.
    Supports both HS256 local dev/test tokens and ES256/RS256 production Supabase Auth tokens.
    """
    token = credentials.credentials
    try:
        payload = decode_token(token)
        
        # Enforce college email verification
        if payload.get("email_verified") is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your college email must be verified."
            )
        
        auth_id_str = payload.get("sub")
        if not auth_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload is missing 'sub' (auth_id) claim."
            )
        
        try:
            auth_id = UUID(auth_id_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload 'sub' is not a valid UUID."
            )
            
        # Fetch the user profile by auth_id
        user = db.query(User).filter(User.auth_id == auth_id).first()
        if not user:
            # Check if email is in the payload to automatically create profile on backend
            # if trigger wasn't run (e.g. SQLite local development/testing)
            email = payload.get("email")
            if email:
                from backend.app.parser import parse_student_email
                from backend.app.models import College, Department
                
                # Check email domain
                email_domain = email.split("@")[1].lower() if "@" in email else ""
                college = db.query(College).filter(College.email_domain == email_domain).first()
                if college:
                    # Parse email
                    admission_year, dept_code, roll_num = parse_student_email(email)
                    dept = db.query(Department).filter(Department.code == dept_code).first() if dept_code else None
                    
                    full_name = payload.get("user_metadata", {}).get("full_name") or payload.get("name") or email.split("@")[0]
                    profile_image = payload.get("user_metadata", {}).get("avatar_url")
                    
                    user = User(
                        auth_id=auth_id,
                        college_id=college.id,
                        department_id=dept.id if dept else None,
                        full_name=full_name,
                        email=email,
                        admission_year=admission_year,
                        roll_number=roll_num,
                        profile_image=profile_image,
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                else:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Only verified college students can access SemesterSwap."
                    )
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User profile not found."
                )
            
        return user
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}"
        )

