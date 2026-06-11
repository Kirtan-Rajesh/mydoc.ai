"""mydoc.ai API — FastAPI entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings
from app.db import engine, init_db
from app.rate_limit import rate_limit_middleware
from app.routers import auth, chat, documents, medications, subscriptions, users

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

if settings.SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(dsn=settings.SENTRY_DSN, environment=settings.ENVIRONMENT)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s (%s)", settings.APP_NAME, settings.APP_VERSION, settings.ENVIRONMENT)
    if settings.ENVIRONMENT == "production" and settings.SECRET_KEY.startswith("dev-secret"):
        raise RuntimeError("Refusing to start in production with the default SECRET_KEY")
    await init_db()
    yield
    await engine.dispose()
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered healthcare document management platform",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,  # bearer tokens, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.middleware("http")(rate_limit_middleware)


@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "version": settings.APP_VERSION, "env": settings.ENVIRONMENT}


v1 = settings.API_V1
app.include_router(auth.router, prefix=f"{v1}/auth", tags=["Auth"])
app.include_router(users.router, prefix=f"{v1}/users", tags=["Users"])
app.include_router(documents.router, prefix=f"{v1}/documents", tags=["Documents"])
app.include_router(chat.router, prefix=f"{v1}/chat", tags=["Chat"])
app.include_router(medications.router, prefix=f"{v1}/medications", tags=["Medications"])
app.include_router(subscriptions.router, prefix=f"{v1}/subscriptions", tags=["Subscriptions"])
