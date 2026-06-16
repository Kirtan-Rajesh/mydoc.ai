"""Application configuration.

Every setting has a development default so the app boots with zero
configuration (SQLite + local file storage + offline echo LLM).
Production overrides everything via environment variables.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    # App
    APP_NAME: str = "mydoc.ai"
    APP_VERSION: str = "2.0.0"
    ENVIRONMENT: str = "development"  # development | staging | production
    DEBUG: bool = True

    # API
    API_V1: str = "/api/v1"
    CORS_ORIGINS: list[str] = ["*"]

    # Database — SQLite for dev, Postgres (asyncpg) in prod, e.g.
    # postgresql+asyncpg://user:pass@host:5432/mydoc
    DATABASE_URL: str = "sqlite+aiosqlite:///./mydoc.db"
    DATABASE_ECHO: bool = False

    # Auth
    SECRET_KEY: str = "dev-secret-change-in-production-0000"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days (mobile-first)
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5

    # SMS provider: console (dev: OTP logged + returned) | msg91 | twilio
    SMS_PROVIDER: str = "console"
    MSG91_AUTH_KEY: str = ""
    MSG91_TEMPLATE_ID: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE: str = ""

    # LLM — provider is swappable via env. "auto" picks gemini when a key
    # is present, otherwise the offline echo provider.
    LLM_PROVIDER: str = "auto"  # auto | gemini | echo
    GEMINI_API_KEY: str = ""
    CHAT_MODEL: str = "gemini-3.1-flash-lite"
    VISION_MODEL: str = "gemini-3.1-flash-lite"
    EMBED_MODEL: str = "gemini-embedding-001"
    EMBED_DIM: int = 768

    # Storage: local (dev) | gcs | s3
    STORAGE_BACKEND: str = "local"
    UPLOAD_DIR: str = "./uploads"
    GCS_BUCKET_NAME: str = ""
    S3_BUCKET_NAME: str = ""
    AWS_REGION: str = ""
    # For S3-compatible providers (Supabase Storage, Cloudflare R2, MinIO):
    # e.g. https://<project-ref>.storage.supabase.co/storage/v1/s3
    S3_ENDPOINT_URL: str = ""
    # Explicit S3 credentials; when empty, boto3's default chain is used
    # (instance roles on AWS, AWS_ACCESS_KEY_ID env vars, etc.).
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""

    # Set true when Postgres requires TLS (e.g. AWS RDS default).
    DB_SSL: bool = False

    # Limits
    MAX_UPLOAD_SIZE_MB: int = 20
    ALLOWED_MIME_TYPES: list[str] = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
    ]
    FREE_PLAN_DOC_LIMIT: int = 25
    FREE_PLAN_DAILY_CHAT_LIMIT: int = 20

    # Rate limiting (in-memory; per instance)
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 120
    RATE_LIMIT_WINDOW_SECS: int = 60

    # RAG
    CHUNK_SIZE_CHARS: int = 1500
    CHUNK_OVERLAP_CHARS: int = 200
    RAG_TOP_K: int = 6

    # Web search (Tavily — https://tavily.com, free tier: 1 000 searches/month)
    TAVILY_API_KEY: str = ""
    WEB_SEARCH_ENABLED: bool = True  # set False to disable even when key is present

    # Observability
    SENTRY_DSN: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
