from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from ..database import get_db
from ..models import Batch, Invoice, BatchStatus
from ..schemas import Batch as BatchSchema, InvoiceCreate, BatchBase
from ..services.export_service import generate_bankinter_excel
from datetime import datetime, date

router = APIRouter(prefix="/batches", tags=["batches"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    # 1. Basic Counters
    total_batches = db.query(Batch).count()
    total_amount = db.query(func.sum(Invoice.importe)).scalar() or 0.0
    issues_count = db.query(Invoice).filter(Invoice.status != "VALID").count()
    
    # 2. Status Distribution (for Pie Chart)
    # We want: VALID vs ISSUES (Warning/Error)
    valid_count = db.query(Invoice).filter(Invoice.status == "VALID").count()
    # issues_count already calculated above
    
    status_distribution = [
        {"name": "Válidas", "value": valid_count, "color": "#22c55e"}, # green-500
        {"name": "Incidencias", "value": issues_count, "color": "#f97316"}, # orange-500
    ]

    # 3. Monthly Volume (Last 6 months) (for Bar Chart)
    # This is a bit complex in pure SQL abstractly, let's pull all batches and aggregate in python 
    # (assuming we don't have millions of batches yet, otherwise use SQL grouping)
    # For a confirming app, volume is usually manageable.
    
    from datetime import timedelta
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    
    # Get invoices with their batch creation date? Or just batch totals?
    # Better to sum invoice amounts by batch date.
    # Query: Join Invoice -> Batch, filter Batch.created_at > six_months_ago
    
    results = db.query(
        Batch.created_at, 
        func.sum(Invoice.importe)
    ).join(Invoice).filter(
        Batch.created_at >= six_months_ago
    ).group_by(Batch.created_at).all()
    
    # Aggregate by Month-Year in Python
    monthly_map = {}
    current = datetime.utcnow()
    
    # Initialize last 6 months with 0
    for i in range(5, -1, -1):
        d = current - timedelta(days=i*30) # approx
        key = d.strftime("%Y-%m")
        label = d.strftime("%b") # Jan, Feb..
        monthly_map[key] = {"name": label, "full_date": key, "amount": 0.0}
        
    for created_at, amount in results:
        if not created_at: continue
        key = created_at.strftime("%Y-%m")
        if key in monthly_map and amount:
            monthly_map[key]["amount"] += amount
            
    # Sort and convert to list
    monthly_volume = sorted(monthly_map.values(), key=lambda x: x["full_date"])
    
    return {
        "processed_batches": total_batches,
        "total_amount": total_amount,
        "issues_count": issues_count,
        "status_distribution": status_distribution,
        "monthly_volume": monthly_volume
    }

class BatchInput(BatchBase):
    invoices: List[InvoiceCreate]
    payment_date: Optional[date] = None

@router.post("/", response_model=BatchSchema)
def create_batch(batch_in: BatchInput, db: Session = Depends(get_db)):
    # Check if a global due date was provided
    global_due_date = None
    if batch_in.payment_date:
        global_due_date = datetime.combine(batch_in.payment_date, datetime.min.time())

    # Create Batch
    db_batch = Batch(
        name=batch_in.name,
        file_hash=batch_in.file_hash,
        payment_date=global_due_date,
        status=BatchStatus.GENERATED,
        created_at=datetime.utcnow()
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)

    # Create Invoices
    for inv_data in batch_in.invoices:
        # Convert InvoiceCreate to DB model
        data = inv_data.dict()
        
        # Override due date if global provided
        if global_due_date:
            data['fecha_vencimiento'] = global_due_date

        db_inv = Invoice(
            **data,
            batch_id=db_batch.id,
            # Assume passed invoices are valid if they are being batched, or status passed
            status="VALID" # Force valid or trust frontend? Trust frontend data but override status if needed
        )
        db.add(db_inv)
    
    db.commit()
    db.refresh(db_batch)
    return db_batch

from ..schemas import PaginatedBatches

@router.get("/", response_model=PaginatedBatches)
def list_batches(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    total = db.query(Batch).count()
    batches = db.query(Batch).order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()
    
    # Compute totals
    for b in batches:
        b.total_amount = sum(inv.importe for inv in b.invoices if inv.importe)

    return {"items": batches, "total": total}

@router.get("/{batch_id}/export")
def export_batch(batch_id: int, db: Session = Depends(get_db)):
    import traceback
    try:
        import traceback
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        # Generate Excel
        try:
            file_content = generate_bankinter_excel(batch.invoices, db)
        except Exception as e:
            with open("export_error.log", "a") as f:
                f.write(f"\n[ERROR GENERATING EXCEL]: {str(e)}\n{traceback.format_exc()}\n")
            raise HTTPException(status_code=500, detail=f"Error generando Excel: {str(e)}")
        
        # Filename: [CurrentDate]_CONFIRMING_[DueDate]
        today_str = datetime.now().strftime('%d-%m-%Y')
        due_date_str = batch.payment_date.strftime('%d-%m-%Y') if batch.payment_date else "SinVencimiento"
        filename = f"{today_str}_CONFIRMING_{due_date_str}.xlsx"
        
        # Check for export path in settings
        from ..models import Settings
        settings_obj = db.query(Settings).first()
        
        with open("debug_export.log", "a") as log:
            log.write(f"\n--- EXPORT REQUEST {datetime.now()} ---\n")
            log.write(f"Settings found: {settings_obj is not None}\n")
            if settings_obj:
                log.write(f"Export Path in DB: '{settings_obj.export_path}'\n")

        if settings_obj and settings_obj.export_path and settings_obj.export_path.strip():
            import os
            try:
                # Ensure directory exists
                target_dir = settings_obj.export_path.strip()
                with open("debug_export.log", "a") as log:
                    log.write(f"Target Dir: '{target_dir}'\n")
                
                os.makedirs(target_dir, exist_ok=True)
                full_path = os.path.join(target_dir, filename)
                
                with open("debug_export.log", "a") as log:
                    log.write(f"Writing to: '{full_path}'\n")
                
                with open(full_path, "wb") as f:
                    f.write(file_content) # file_content is bytes
                    
                with open("debug_export.log", "a") as log:
                    log.write("SUCCESS: File written.\n")
                
                # No need to seek for bytes
            except Exception as e:
                with open("debug_export.log", "a") as log:
                    log.write(f"ERROR: {str(e)}\n{traceback.format_exc()}\n")
                
                # Also log to main error log
                with open("export_error.log", "a") as f:
                    f.write(f"\n[ERROR SAVING LOCAL]: {str(e)}\n{traceback.format_exc()}\n")
        else:
             with open("debug_export.log", "a") as log:
                log.write("SKIP: No export path configured.\n")
        
        # Update status
        batch.status = BatchStatus.SENT
        db.commit()
        
        return Response(
            content=file_content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        with open("export_error.log", "a") as f:
            f.write(f"\n[CRITICAL EXPORT ERROR]: {str(e)}\n{traceback.format_exc()}\n")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.delete("/{batch_id}", status_code=204)
def delete_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Cascade delete invoices manually if needed (safest)
    if batch.invoices:
        for invoice in batch.invoices:
            db.delete(invoice)
            
    db.delete(batch)
    db.commit()
    return None
