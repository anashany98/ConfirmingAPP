from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.excel_service import process_excel_file
from ..schemas import Invoice
from ..models import Batch, ImportLog

router = APIRouter(prefix="/import", tags=["import"])

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), force: bool = False, db: Session = Depends(get_db)):
    # Manual Debug Log
    with open("debug_manual.log", "a") as f:
        f.write(f"\n--- New Request ---\nReceived file: {file.filename}\n")

    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        with open("debug_manual.log", "a") as f: f.write("Error: Invalid extension\n")
        # Log Invalid Extension
        db.add(ImportLog(filename=file.filename, status="ERROR", details="Invalid file extension", total_invoices=0))
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid file format")
    
    try:
        content = await file.read()
        
        # Duplicate Check
        import hashlib
        file_hash = hashlib.sha256(content).hexdigest()
        
        existing = db.query(Batch).filter(Batch.file_hash == file_hash).first()
        if existing and not force:
             msg = f"Este archivo ya ha sido importado (Lote: {existing.name})"
             db.add(ImportLog(filename=file.filename, status="WARNING", details=msg, total_invoices=0))
             db.commit()
             raise HTTPException(status_code=409, detail=msg)

        with open("debug_manual.log", "a") as f: f.write(f"File read. Size: {len(content)} bytes. Hash: {file_hash}\n")
        
        data = process_excel_file(content, db)
        
        with open("debug_manual.log", "a") as f: f.write(f"Success. Found {len(data)} invoices.\n")
        
        # Log Success
        db.add(ImportLog(filename=file.filename, status="SUCCESS", details=None, total_invoices=len(data)))
        db.commit()
        
        # Assign temporary IDs for frontend keying
        for idx, item in enumerate(data):
            item['id'] = idx + 1 
            
        return {"invoices": data, "file_hash": file_hash}
        
    except HTTPException as he:
        with open("debug_manual.log", "a") as f: f.write(f"Caught HTTPException: {he.detail}\n")
        raise he
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        with open("debug_manual.log", "a") as f: f.write(f"CRITICAL ERROR: {str(e)}\n{tb}\n")
        
        # Log Critical Error
        try:
            db.add(ImportLog(filename=file.filename, status="ERROR", details=str(e)[:250] if e else "Unknown Error", total_invoices=0))
            db.commit()
        except:
            pass # Failsafe
            
        raise HTTPException(status_code=400, detail=f"Processing error: {str(e)}")
