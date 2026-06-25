import os
# pyrefly: ignore [missing-import]
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from jose import jwt

# Configure environment variables for testing
os.environ["DATABASE_URL"] = "sqlite:///semester_swap_test.db"
os.environ["SUPABASE_JWT_SECRET"] = "test-jwt-secret-minimum-32-characters-for-safety"
os.environ["EMAIL_PROVIDER"] = "RESEND"

from backend.app.config import settings  # noqa: E402
from backend.app.database import Base, get_db  # noqa: E402
from backend.app.main import app  # noqa: E402
from backend.app.models import User, College, Department, EmailNotification  # noqa: E402

# Create engine for testing SQLite database
engine = create_engine(
    "sqlite:///semester_swap_test.db",
    connect_args={"check_same_thread": False},
    use_insertmanyvalues=False
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    """
    Creates a clean SQLite database, seeds it, and provides a session for each test.
    """
    # Create schema
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    try:
        # Truncate all tables in reverse dependency order to ensure clean slate
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()

        # Seed test colleges
        kpriet = College(name="KPRIET", email_domain="kpriet.ac.in")
        db.add(kpriet)
        
        # Seed test departments
        db.add_all([
            Department(code="ad", name="Artificial Intelligence & Data Science"),
            Department(code="cs", name="Computer Science Engineering"),
            Department(code="ec", name="Electronics & Communication Engineering"),
            Department(code="me", name="Mechanical Engineering")
        ])
        db.commit()
        
        # Seed test meeting locations
        from backend.app.models import MeetingLocation
        db.add_all([
            MeetingLocation(name="Library Entrance", description="Main entrance of the campus library", is_active=True),
            MeetingLocation(name="CSE Block Entrance", description="Entrance of the Computer Science block", is_active=True),
            MeetingLocation(name="Main Gate", description="Main campus entrance gate", is_active=True),
            MeetingLocation(name="Campus Cafeteria", description="Central campus food court lobby", is_active=True),
            MeetingLocation(name="Student Activity Center", description="Lobby of the SAC building", is_active=True)
        ])
        db.commit()
        
        yield db
    finally:
        db.close()
        # Drop all tables after the test (best effort)
        try:
            Base.metadata.drop_all(bind=engine)
        except Exception:
            pass
        # Delete file if exists (best effort)
        try:
            import os
            if os.path.exists("semester_swap_test.db"):
                os.remove("semester_swap_test.db")
        except Exception:
            pass

@pytest.fixture(scope="function")
def client(db_session):
    """
    Creates a FastAPI TestClient overriding the get_db dependency to use the test session.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture(scope="session")
def generate_jwt():
    """
    Helper fixture to generate a signed Supabase JWT for testing.
    """
    def _generate(auth_id: str, email: str, full_name: str = "Test Student", avatar_url: str | None = None):
        payload = {
            "sub": auth_id,
            "email": email,
            "role": "authenticated",
            "user_metadata": {
                "full_name": full_name,
                "avatar_url": avatar_url
            }
        }
        return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
    return _generate
