from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
import os
from .routers import auth_router, import_router, batch_router, settings_router, providers_router, logs_router, search_router, reports_router, health_router
from .database import engine, Base, get_db
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
import re
import traceback

# Sentry error tracking - set DSN via env var SENTRY_DSN
sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.1,
        environment=os.getenv("ENVIRONMENT", "production"),
    )

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

ALLOWED_ORIGINS = [
    "http://192.168.1.242:8095",
    "http://localhost:8095",
    "http://127.0.0.1:8095",
    "https://confirming.egeadev.cloud",
    "https://app.confirming.egeadev.cloud",
]

LOCAL_ORIGIN_REGEX = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"


def is_allowed_origin(origin: str) -> bool:
    return origin in ALLOWED_ORIGINS or re.match(LOCAL_ORIGIN_REGEX, origin) is not None

# Note: Database tables are managed via Alembic migrations
# Run `alembic upgrade head` to apply migrations
# Do NOT use Base.metadata.create_all in production

app = FastAPI(title="ConfirmingAPP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=LOCAL_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth_router)
app.include_router(import_router)
app.include_router(batch_router)
app.include_router(logs_router)
app.include_router(providers_router)
app.include_router(settings_router)
app.include_router(search_router)
app.include_router(reports_router)
app.include_router(health_router)

# Add rate limiter state
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {exc}")
    logger.error(traceback.format_exc())
    
    # Get the origin from the request
    origin = request.headers.get("origin", "")
    
    headers = {}
    if is_allowed_origin(origin):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
        headers=headers
    )

@app.get("/")
def read_root():
    return {"message": "Confirming Bankinter API is running"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        # Try a simple query to verify DB connection
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": str(e)}
        )
