import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PORT: int = 8000
    ENV: str = "development"
    DATABASE_URL: str = "sqlite:///./semester_swap.db"
    SUPABASE_JWT_SECRET: str = ""
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    VITE_SUPABASE_URL: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "SemesterSwap <noreply@yourdomain.com>"
    EMAIL_OVERRIDE: Optional[str] = None
    EMAIL_PROVIDER: str = "RESEND"
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True
    FRONTEND_URL: str = "http://localhost:5173"



    # Load configuration from .env file if it exists, searching from root directory
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
