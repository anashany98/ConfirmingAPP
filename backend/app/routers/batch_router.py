from fastapi import APIRouter, Depends, HTTPException, Response
from ..routers.auth_router import get_current_user
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from ..database import get_db
from ..models import Batch, Invoice, BatchStatus, Provider
from ..schemas import Batch as BatchSchema, InvoiceCreate, BatchBase
from ..services.duplicate_service import summarize_duplicate_groups
from ..services.export_service import generate_bankinter_excel
from ..utils.log_files import append_log_line
from datetime import datetime, date, timedelta

router = APIRouter(
    prefix="/batches", 
    tags=["batches"],
    dependencies=[Depends(get_current_user)]
)

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

    duplicate_groups = summarize_duplicate_groups(db.query(Invoice).all())

    # 4. Cash Flow Projection (Next 4 Weeks)
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
        "duplicate_invoices_count": sum(group["occurrences"] for group in duplicate_groups),
        "status_distribution": status_distribution,
        "monthly_volume": monthly_volume,
        "cash_flow_projection": cash_flow
    }


@router.get("/treasury-simulator")
def get_treasury_simulator(
    opening_balance: float = 150000,
    reserve_balance: float = 30000,
    horizon_weeks: int = 8,
    payment_delay_days: int = 0,
    stress_pct: float = 12.5,
    db: Session = Depends(get_db),
):
    horizon_weeks = max(4, min(horizon_weeks, 16))
    payment_delay_days = max(0, min(payment_delay_days, 45))
    stress_pct = max(0.0, min(stress_pct, 50.0))

    today = date.today()
    invoices = (
        db.query(Invoice, Provider.name)
        .outerjoin(Provider, Provider.cif == Invoice.cif)
        .filter(Invoice.fecha_vencimiento != None)
        .filter(Invoice.status != "ERROR")
        .all()
    )

    def build_provider_breakdown(start_range: date, end_range: date, shifted: bool = False):
        provider_totals = {}
        for invoice, provider_name in invoices:
            if not invoice.fecha_vencimiento:
                continue
            due_date = invoice.fecha_vencimiento.date()
            if shifted:
                due_date = due_date + timedelta(days=payment_delay_days)
            if start_range <= due_date <= end_range:
                key = invoice.cif or "SIN-CIF"
                if key not in provider_totals:
                    provider_totals[key] = {
                        "cif": invoice.cif,
                        "name": provider_name or invoice.nombre or "Proveedor sin nombre",
                        "amount": 0.0,
                        "invoices": 0,
                    }
                provider_totals[key]["amount"] += float(invoice.importe or 0.0)
                provider_totals[key]["invoices"] += 1
        ranked = sorted(provider_totals.values(), key=lambda item: item["amount"], reverse=True)
        return ranked[:3]

    scheduled_balance = opening_balance
    delayed_balance = opening_balance
    stressed_balance = opening_balance
    stress_multiplier = 1 + (stress_pct / 100)
    weekly_projection = []

    for index in range(horizon_weeks):
        week_start = today + timedelta(days=index * 7)
        week_end = week_start + timedelta(days=6)

        scheduled_amount = 0.0
        delayed_amount = 0.0
        for invoice, _provider_name in invoices:
            if not invoice.fecha_vencimiento:
                continue
            due_date = invoice.fecha_vencimiento.date()
            if week_start <= due_date <= week_end:
                scheduled_amount += float(invoice.importe or 0.0)

            shifted_due_date = due_date + timedelta(days=payment_delay_days)
            if week_start <= shifted_due_date <= week_end:
                delayed_amount += float(invoice.importe or 0.0)

        stressed_amount = scheduled_amount * stress_multiplier
        scheduled_balance -= scheduled_amount
        delayed_balance -= delayed_amount
        stressed_balance -= stressed_amount

        weekly_projection.append(
            {
                "label": f"S{index + 1}",
                "range": f"{week_start.strftime('%d/%m')} - {week_end.strftime('%d/%m')}",
                "scheduled_amount": round(scheduled_amount, 2),
                "delayed_amount": round(delayed_amount, 2),
                "stressed_amount": round(stressed_amount, 2),
                "scheduled_balance": round(scheduled_balance, 2),
                "delayed_balance": round(delayed_balance, 2),
                "stressed_balance": round(stressed_balance, 2),
                "available_after_reserve": round(scheduled_balance - reserve_balance, 2),
                "providers": build_provider_breakdown(week_start, week_end),
            }
        )

    next_30_days = today + timedelta(days=30)
    exposure_by_provider = {}
    for invoice, provider_name in invoices:
        if not invoice.fecha_vencimiento:
            continue
        due_date = invoice.fecha_vencimiento.date()
        if due_date < today or due_date > next_30_days:
            continue
        key = invoice.cif or "SIN-CIF"
        if key not in exposure_by_provider:
            exposure_by_provider[key] = {
                "cif": invoice.cif,
                "name": provider_name or invoice.nombre or "Proveedor sin nombre",
                "amount": 0.0,
                "invoices": 0,
            }
        exposure_by_provider[key]["amount"] += float(invoice.importe or 0.0)
        exposure_by_provider[key]["invoices"] += 1

    top_exposures = sorted(exposure_by_provider.values(), key=lambda item: item["amount"], reverse=True)[:5]
    upcoming_total = round(sum(item["amount"] for item in top_exposures), 2)

    alerts = []
    first_shortfall_week = next((week for week in weekly_projection if week["scheduled_balance"] < 0), None)
    first_reserve_breach = next((week for week in weekly_projection if week["available_after_reserve"] < 0), None)
    if first_shortfall_week:
        alerts.append(
            {
                "type": "critical",
                "message": f"El saldo cae por debajo de cero en {first_shortfall_week['range']}.",
            }
        )
    if first_reserve_breach:
        alerts.append(
            {
                "type": "warning",
                "message": f"La reserva mínima se compromete en {first_reserve_breach['range']}.",
            }
        )
    if top_exposures:
        largest_exposure = top_exposures[0]
        if upcoming_total and largest_exposure["amount"] / upcoming_total > 0.35:
            alerts.append(
                {
                    "type": "info",
                    "message": f"Alta concentración de pagos en {largest_exposure['name']} durante los próximos 30 días.",
                }
            )

    return {
        "opening_balance": opening_balance,
        "reserve_balance": reserve_balance,
        "payment_delay_days": payment_delay_days,
        "stress_pct": stress_pct,
        "weeks": weekly_projection,
        "summary": {
            "scheduled_total": round(sum(week["scheduled_amount"] for week in weekly_projection), 2),
            "delayed_total": round(sum(week["delayed_amount"] for week in weekly_projection), 2),
            "stressed_total": round(sum(week["stressed_amount"] for week in weekly_projection), 2),
            "final_balance": round(weekly_projection[-1]["scheduled_balance"] if weekly_projection else opening_balance, 2),
            "peak_week": max(weekly_projection, key=lambda week: week["scheduled_amount"], default=None),
        },
        "top_exposures": top_exposures,
        "alerts": alerts,
    }

class BatchInput(BatchBase):
    invoices: List[InvoiceCreate]
    payment_date: Optional[date] = None

@router.post("/", response_model=BatchSchema)
def create_batch(batch_in: BatchInput, db: Session = Depends(get_db)):
    global_due_date = None
    if batch_in.payment_date:
        global_due_date = datetime.combine(batch_in.payment_date, datetime.min.time())

    try:
        db_batch = Batch(
            name=batch_in.name,
            file_hash=batch_in.file_hash,
            payment_date=global_due_date,
            status=BatchStatus.GENERATED,
            created_at=datetime.utcnow()
        )
        db.add(db_batch)
        db.flush()

        for inv_data in batch_in.invoices:
            data = inv_data.model_dump()
            provider_phone = data.pop('phone', None)
            data.pop('duplicate_status', None)
            data.pop('duplicate_message', None)
            data.pop('duplicate_count', None)

            invoice_status = data.pop('status', 'VALID') or 'VALID'

            if global_due_date:
                data['fecha_vencimiento'] = global_due_date

            db_inv = Invoice(
                **data,
                batch_id=db_batch.id,
                status=invoice_status,
            )
            db.add(db_inv)

            if data.get('cif'):
                provider = db.query(Provider).filter(Provider.cif == data['cif']).first()
                if not provider:
                    db.add(
                        Provider(
                            cif=data['cif'],
                            name=data['nombre'],
                            email=data['email'],
                            address=data.get('direccion'),
                            city=data.get('poblacion'),
                            zip_code=data.get('cp'),
                            country=data.get('pais'),
                            phone=provider_phone,
                            iban=data.get('cuenta')
                        )
                    )
                else:
                    if data.get('nombre'):
                        provider.name = data['nombre']
                    if data.get('email'):
                        provider.email = data['email']
                    if data.get('direccion'):
                        provider.address = data['direccion']
                    if data.get('poblacion'):
                        provider.city = data['poblacion']
                    if data.get('cp'):
                        provider.zip_code = data['cp']
                    if data.get('pais'):
                        provider.country = data['pais']
                    if data.get('cuenta'):
                        provider.iban = data['cuenta']
                    if provider_phone:
                        provider.phone = provider_phone

        db.commit()
        db.refresh(db_batch)
        return db_batch
    except Exception:
        db.rollback()
        raise

from ..schemas import PaginatedBatches

@router.get("/", response_model=PaginatedBatches)
def list_batches(
    skip: int = 0, 
    limit: int = 10, 
    search: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
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
            append_log_line("export_error.log", f"\n[ERROR GENERATING EXCEL]: {str(e)}\n{traceback.format_exc()}\n")
            raise HTTPException(status_code=500, detail=f"Error generando Excel: {str(e)}")
        
        # Filename: [CreationDate]_CONFIRMING_[DueDate] (ISO format for better sorting)
        creation_date_str = batch.created_at.strftime('%Y-%m-%d') if batch.created_at else datetime.now().strftime('%Y-%m-%d')
        due_date_str = batch.payment_date.strftime('%Y-%m-%d') if batch.payment_date else "SinVencimiento"
        filename = f"{creation_date_str}_CONFIRMING_{due_date_str}.xlsx"
        
# Check for export path in settings
        from ..models import Settings
        settings_obj = db.query(Settings).first()
        
        append_log_line("debug_export.log", f"\n--- EXPORT REQUEST {datetime.now()} ---\n")
        append_log_line("debug_export.log", f"Settings found: {settings_obj is not None}\n")
        if settings_obj:
            export_path = settings_obj.export_path
            append_log_line("debug_export.log", f"Export Path in DB: '{export_path}'\n")

        if settings_obj and settings_obj.export_path and settings_obj.export_path.strip():
            import os
            try:
                # Ensure directory exists
                target_dir = settings_obj.export_path.strip()
                append_log_line("debug_export.log", f"Target Dir: '{target_dir}'\n")
                
                os.makedirs(target_dir, exist_ok=True)
                full_path = os.path.join(target_dir, filename)
                
                append_log_line("debug_export.log", f"Writing to: '{full_path}'\n")
                
                with open(full_path, "wb") as f:
                    f.write(file_content) # file_content is bytes
                    
                append_log_line("debug_export.log", "SUCCESS: File written.\n")
                    
                # No need to seek for bytes
            except Exception as e:
                append_log_line("debug_export.log", f"ERROR: {str(e)}\n{traceback.format_exc()}\n")
                
                # Also log to main error log
                append_log_line("export_error.log", f"\n[ERROR SAVING LOCAL]: {str(e)}\n{traceback.format_exc()}\n")
        else:
             append_log_line("debug_export.log", "SKIP: No export path configured.\n")
        
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
        append_log_line("export_error.log", f"\n[CRITICAL EXPORT ERROR]: {str(e)}\n{traceback.format_exc()}\n")
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
from ..models import Settings

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
