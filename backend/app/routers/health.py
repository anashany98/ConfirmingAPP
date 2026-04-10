from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import os
import sys
from ..database import get_db

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check(db: Session = Depends(get_db)):
    """Basic health check - returns service status."""
    return {
        "status": "healthy",
        "service": "confirming-api",
        "version": "1.0.0"
    }


@router.get("/detailed")
async def detailed_health_check(db: Session = Depends(get_db)):
    """Detailed health check with component status."""
    
    # Check database
    db_status = "healthy"
    db_message = "Connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = "unhealthy"
        db_message = str(e)
    
    # Check environment variables
    secret_key_set = "SECRET_KEY" in os.environ
    
    # Check Python version
    python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "components": {
            "database": {
                "status": db_status,
                "message": db_message
            },
            "security": {
                "secret_key_configured": secret_key_set
            },
            "python": {
                "version": python_version
            }
        }
    }


@router.get("/ready")
async def readiness_check(db: Session = Depends(get_db)):
    """Readiness check - used by Kubernetes for orchestration."""
    try:
        # Check DB connection
        db.execute(text("SELECT 1"))
        
        # Check required env vars
        if not os.getenv("SECRET_KEY"):
            return {"ready": False, "reason": "SECRET_KEY not configured"}
        
        return {"ready": True}
    except Exception as e:
        return {"ready": False, "reason": str(e)}


@router.get("/live")
async def liveness_check():
    """Liveness check - tells if the service should be restarted."""
    return {"alive": True}