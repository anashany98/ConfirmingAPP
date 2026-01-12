from fastapi import APIRouter, Depends, Query, Response
from ..routers.auth_router import get_current_user
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta
import calendar
from typing import Optional
from ..database import get_db
from ..models import Invoice
from ..services.pdf_service import generate_monthly_report_pdf

router = APIRouter(
    prefix="/reports", 
    tags=["reports"],
    dependencies=[Depends(get_current_user)]
)

MONTH_NAMES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

@router.get("/monthly-pdf")
def get_monthly_pdf(
    month: int = Query(..., ge=1, le=12), 
    year: int = Query(...), 
    db: Session = Depends(get_db)
):
    # Calculate Date Range
    _, last_day = calendar.monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)
    
    # Query Data (Invoices due in this month)
    # We filter by 'VALID' status usually, but maybe show all? Let's show VALID/PAID.
    # In Confirming context, maybe everything SENT + GENERATED? 
    # Let's filter Invoice.fecha_vencimiento inside range.
    
    invoices_query = db.query(Invoice).filter(
        Invoice.fecha_vencimiento >= start_date,
        Invoice.fecha_vencimiento <= end_date
    )
    
    invoices = invoices_query.all()
    
    # Aggregations
    total_amount = sum(inv.importe for inv in invoices)
    total_count = len(invoices)
    active_providers = len(set(inv.cif for inv in invoices))
    
    # Top Providers
    # Group by Provider Name (or CIF)
    provider_map = {}
    for inv in invoices:
        key = inv.nombre # Group by Name for display
        provider_map[key] = provider_map.get(key, 0) + inv.importe
        
    sorted_providers = sorted(provider_map.items(), key=lambda item: item[1], reverse=True)[:5]
    top_providers_list = [{"name": name, "amount": amt} for name, amt in sorted_providers]
    
    # Weekly Breakdown
    # Group by week number relative to year or month?
    # Simple bucket: Week 1 (Day 1-7), Week 2 (8-14)...
    weekly_breakdown = []
    current_week_start = start_date
    
    while current_week_start <= end_date:
        next_week_start = current_week_start + timedelta(days=7)
        # End of this week chunk is min(next_week_start - 1, end_date)
        chunk_end = min(next_week_start - timedelta(days=1), end_date)
        
        # Sum
        week_total = sum(
            inv.importe for inv in invoices 
            if inv.fecha_vencimiento and current_week_start <= inv.fecha_vencimiento.date() <= chunk_end
        )
        
        label = f"Semana {current_week_start.day}-{chunk_end.day}"
        weekly_breakdown.append({"week": label, "amount": week_total})
        
        current_week_start = next_week_start

    stats = {
        "month": MONTH_NAMES[month],
        "year": year,
        "total_amount": total_amount,
        "total_invoices": total_count,
        "active_providers": active_providers,
        "top_providers": top_providers_list,
        "weekly_breakdown": weekly_breakdown
    }
    
    pdf_content = generate_monthly_report_pdf(stats)
    
    filename = f"Informe_Teso_{MONTH_NAMES[month]}_{year}.pdf"
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

from ..services.excel_export_service import generate_excel_from_df, generate_dashboard_excel
from ..routers.batch_router import get_dashboard_stats # Reuse logic? Or replicate? Reuse is better but circular import risk.
# Creating a dedicated helper for params might be better. 
# For now, let's replicate logic or import function if safe.
# batch_router imports database, models... reports_router does too. 
# It's better to move logic to a service if shared. 
# But for speed, let's re-implement query logic or move `get_dashboard_stats` to a service.

# Let's import get_dashboard_stats. 
# batch_router.py -> (depends on models, db)
# reports_router.py -> (depends on models, db)
# Circular import? 
# batch_router imports nothing from reports_router. So it should be fine.
from ..routers.batch_router import get_dashboard_stats

@router.get("/excel/dashboard")
def export_dashboard_excel(db: Session = Depends(get_db)):
    # 1. Get Stats (Reuse existing logic)
    stats = get_dashboard_stats(db)
    
    # 2. Generate Excel
    excel_content = generate_dashboard_excel(stats)
    
    filename = f"Dashboard_Confirming_{datetime.now().strftime('%Y%m%d')}.xlsx"
    
    return Response(
        content=excel_content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/excel/provider/{cif}")
def export_provider_excel(cif: str, db: Session = Depends(get_db)):
    from ..routers.providers_router import get_provider_stats, get_provider_invoices
    import pandas as pd
    
    # Get Data
    stats = get_provider_stats(cif, db)
    invoices = get_provider_invoices(cif, db)
    
    # Convert Invoices to DataFrame
    data = []
    for inv in invoices:
        data.append({
            "Nº Factura": inv.factura,
            "Importe (€)": inv.importe,
            "Vencimiento": inv.fecha_vencimiento.strftime("%d/%m/%Y"),
            "Remesa": f"#{inv.batch_id}" if inv.batch_id else "-",
            "Estado": inv.status
        })
        
    df = pd.DataFrame(data)
    
    # Generate
    excel_content = generate_excel_from_df(df, sheet_name=f"Facturas {cif}")
    
    filename = f"Informe_Proveedor_{cif}.xlsx"
    
    return Response(
        content=excel_content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

    return Response(
        content=excel_content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/excel/batch/{id}")
def export_batch_excel(id: int, db: Session = Depends(get_db)):
    from ..models import Batch
    import pandas as pd
    
    batch = db.query(Batch).filter(Batch.id == id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
        
    data = []
    for inv in batch.invoices:
         data.append({
            "Nº Factura": inv.factura,
            "Proveedor": inv.nombre,
            "CIF": inv.cif,
            "Importe (€)": inv.importe,
            "Vencimiento": inv.fecha_vencimiento.strftime("%d/%m/%Y") if inv.fecha_vencimiento else "-",
            "Estado": inv.status
        })
        
    df = pd.DataFrame(data)
    
    excel_content = generate_excel_from_df(df, sheet_name=f"Remesa {id}")
    
    filename = f"Remesa_{id}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    
    return Response(
        content=excel_content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
