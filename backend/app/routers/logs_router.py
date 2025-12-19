from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ImportLog
from typing import List
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(
    prefix="/logs",
    tags=["logs"]
)

class ImportLogSchema(BaseModel):
    id: int
    timestamp: datetime
    filename: str
    status: str
    details: str | None
    total_invoices: int
    
    class Config:
        from_attributes = True

@router.get("/imports", response_model=List[ImportLogSchema])
def get_import_logs(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return db.query(ImportLog).order_by(ImportLog.timestamp.desc()).offset(skip).limit(limit).all()
