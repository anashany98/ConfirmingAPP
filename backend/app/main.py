from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .routers import auth_router, import_router, batch_router, settings_router, providers_router, logs_router, search_router, reports_router
from .database import engine, Base, get_db
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ConfirmingAPP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://192.168.1.242:8095",
        "http://localhost:8095",
        "http://127.0.0.1:8095",
        "https://confirming.egeadev.cloud",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth_router.router)
app.include_router(import_router.router)
app.include_router(batch_router.router)
app.include_router(logs_router.router)
app.include_router(providers_router.router)
app.include_router(settings_router.router)
app.include_router(search_router.router)
app.include_router(reports_router.router)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
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
