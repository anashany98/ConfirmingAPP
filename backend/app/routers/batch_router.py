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
    # Sort and convert to list
    monthly_volume = sorted(monthly_map.values(), key=lambda x: x["full_date"])

    # 4. Cash Flow Projection (Next 4 Weeks)
    from datetime import timedelta
    today_date = date.today()
    # Normalize to start of week (Monday) or just use relative windows?
    # Let's use relative windows: Week 1, Week 2, Week 3, Week 4 from TODAY.
    
    cash_flow = []
    for i in range(4):
        start_range = today_date + timedelta(days=i*7)
        end_range = start_range + timedelta(days=6)
        
        # Query sum of invoices due in this range
        week_total = db.query(func.sum(Invoice.importe)).filter(
            Invoice.fecha_vencimiento >= start_range,
            Invoice.fecha_vencimiento <= end_range,
            # Invoice.status == "VALID" # Should we filter by status? Maybe only Valid ones.
        ).scalar() or 0.0
        
        label = f"{start_range.strftime('%d %b')} - {end_range.strftime('%d %b')}"
        cash_flow.append({
            "name": f"Semana {i+1}", 
            "range": label,
            "amount": week_total,
            "full_date": start_range.strftime("%Y-%m-%d") # for sorting if needed
        })

    return {
        "processed_batches": total_batches,
        "total_amount": total_amount,
        "issues_count": issues_count,
        "status_distribution": status_distribution,
        "monthly_volume": monthly_volume,
        "cash_flow_projection": cash_flow
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
def list_batches(
    skip: int = 0, 
    limit: int = 10, 
    search: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    payment_date_start: Optional[date] = None,
    payment_date_end: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Batch)

    # Filters
    if search:
        # Search by ID (if numeric) or Name
        if search.isdigit():
             query = query.filter(Batch.id == int(search))
        else:
             query = query.filter(Batch.name.ilike(f"%{search}%"))
    
    if start_date:
        query = query.filter(func.date(Batch.created_at) >= start_date)
    
    if end_date:
        query = query.filter(func.date(Batch.created_at) <= end_date)

    if payment_date_start:
        query = query.filter(func.date(Batch.payment_date) >= payment_date_start)
    
    if payment_date_end:
        query = query.filter(func.date(Batch.payment_date) <= payment_date_end)

    total = query.count()
    batches = query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()
    
    # Compute totals
    for b in batches:
        b.total_amount = sum(inv.importe for inv in b.invoices if inv.importe)

    return {"items": batches, "total": total}

@router.get("/{batch_id}", response_model=BatchSchema)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch

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
        
        # Filename: [CreationDate]_CONFIRMING_[DueDate]
        creation_date_str = batch.created_at.strftime('%d-%m-%Y') if batch.created_at else datetime.now().strftime('%d-%m-%Y')
        due_date_str = batch.payment_date.strftime('%d-%m-%Y') if batch.payment_date else "SinVencimiento"
        filename = f"{creation_date_str}_CONFIRMING_{due_date_str}.xlsx"
        
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

@router.patch("/{batch_id}/toggle-upload", response_model=BatchSchema)
def toggle_batch_upload_status(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    batch.uploaded_to_bank = not batch.uploaded_to_bank
    db.commit()
    db.refresh(batch)
    return batch

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

from ..services.pdf_service import generate_batch_pdf

@router.get("/{batch_id}/export-pdf")
def export_batch_pdf(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    pdf_content = generate_batch_pdf(batch)
    
    filename = f"Orden_Remesa_{batch.id}.pdf"
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

from ..services.email_service import email_service
from ..models import Provider, Settings

@router.post("/{batch_id}/notify")
async def notify_batch_providers(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    settings = db.query(Settings).first()
    
    count = 0
    errors = []
    
    print(f"DEBUG: Notifying Batch {batch_id}. Total Invoices: {len(batch.invoices)}")
    
    for inv in batch.invoices:
        # Determine email
        # Priority 1: Email in Invoice record
        email = inv.email
        print(f"DEBUG: Invoice {inv.cif}. InvEmail: {inv.email}")
        
        # Priority 2: Email in Provider record
        if not email:
            prov = db.query(Provider).filter(Provider.cif == inv.cif).first()
            if prov:
                 print(f"DEBUG: Provider found. Email: {prov.email}")
            if prov and prov.email:
                email = prov.email
                
        if email:
            try:
                # We await because email service might be async eventually
                await email_service.send_payment_notification(inv, email, settings)
                count += 1
            except Exception as e:
                print(f"DEBUG: Error sending: {e}")
                errors.append(f"Error sending to {inv.cif}: {str(e)}")
        else:
             print(f"DEBUG: No email found for {inv.cif}")
             pass
    
    return {"message": f"Se han procesado {count} notificaciones.", "count": count, "errors": errors}
