from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from ..routers.auth_router import get_current_user
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Provider
from ..schemas import Provider as ProviderSchema, ProviderCreate
import pandas as pd
import io
from datetime import datetime, timedelta

router = APIRouter(
    prefix="/providers", 
    tags=["providers"],
    dependencies=[Depends(get_current_user)]
)

PROVIDER_COLUMN_MAPPING = {
    'CIF': ['N.I.F.', 'NIF', 'CIF', 'DNI', 'CODIGO FISCAL', 'N.I.F'],
    'NAME': ['Nombre fiscal', 'NOMBRE', 'RAZON SOCIAL', 'TITULAR', 'EMPRESA', 'NAME', 'PROVEEDOR', 'Nombre'],
    'ADDRESS': ['Domicilio', 'DIRECCION', 'DOMICILIO', 'ADDRESS', 'Dirección'],
    'CITY': ['Población', 'POBLACION', 'CIUDAD', 'CITY', 'LOCALIDAD'],
    'ZIP': ['Cód. Postal', 'CP', 'CODIGO POSTAL', 'ZIP', 'C.P.', 'C.P', 'Cód Postal'],
    'EMAIL': ['E-mail', 'EMAIL', 'CORREO', 'MAIL', 'Email'],
    'IBAN': ['IBAN del banco', 'IBAN', 'CUENTA', 'CCC', 'NUMERO CUENTA'],
    'PHONE': ['Teléfono', 'TELEFONO', 'PHONE', 'MOVIL'],
    'COUNTRY': ['País', 'PAIS', 'COUNTRY'],
    'SWIFT': ['SWIFT del banco', 'SWIFT', 'BIC']
}

def normalize_columns(columns):
    mapping = {}
    used = set()
    # Create normalized map for easier matching
    # structure: { "NORMALIZED_ALIAS": "STD_KEY" }
    alias_map = {}
    for std, aliases in PROVIDER_COLUMN_MAPPING.items():
        for alias in aliases:
            # key = alias.upper().strip().replace(".", "") # too aggressive?
            # User headers have dots and accents. Let's try exact match first, then normalized.
            alias_map[alias.upper().strip()] = std
            
    for col in columns:
        col_clean = str(col).upper().strip()
        
        # 1. Try Exact Match (upper stripped)
        if col_clean in alias_map:
            std = alias_map[col_clean]
            if std not in mapping:
                mapping[std] = col
                continue
                
        # 2. Try removing punctuation for "N.I.F." -> "NIF" match
        col_no_dot = col_clean.replace(".", "")
        if col_no_dot in alias_map:
             std = alias_map[col_no_dot]
             if std not in mapping:
                mapping[std] = col
                continue

    return mapping

import logging

# Configure logging
import sys

# Configure logging to stdout so it appears in Docker logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

@router.post("/upload", status_code=201)
async def upload_providers(file: UploadFile = File(...), db: Session = Depends(get_db)):
    logger.info(f"Starting upload for file: {file.filename}")
    content = await file.read()
    
    # First pass: read as headerless to find the header row
    try:
        df_scan = pd.read_excel(io.BytesIO(content), header=None, engine='openpyxl')
        logger.info(f"File read successfully. Rows: {len(df_scan)}")
    except Exception as e:
        logger.error(f"Error reading Excel: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid Excel file: {str(e)}")

    # Find header row
    header_index = -1
    for idx, row in df_scan.iterrows():
        # Convert row to list of strings
        # We also check for "N.I.F." specifically or just "NIF" after stripping punctuation
        row_str = [str(val).upper().strip() for val in row.values]
        
        # Check if row contains key identifiers
        # We check both exact string and a "clean" version (dots removed) to catch N.I.F. as NIF
        found = False
        for val in row_str:
            clean_val = val.replace(".", "")
            if val in ["CIF", "NIF", "N.I.F.", "N.I.F"] or clean_val in ["CIF", "NIF"]:
                found = True
                break
        
        if found:
            header_index = idx
            logger.info(f"Header found at index {idx}: {row_str}")
            break
            
    if header_index == -1:
        logger.error("Header row (CIF/NIF) NOT found in the first rows.")
        # Fallback: reload with default header=0
        try:
            df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
        except:
             raise HTTPException(status_code=400, detail="Could not detect header row (CIF/NIF not found)")
    else:
        # Reload with correct header
        df = pd.read_excel(io.BytesIO(content), header=header_index, engine='openpyxl')

    # Normalize headers
    df.columns = [str(c).upper().strip() for c in df.columns]
    print(f"DEBUG: Columns detected: {list(df.columns)}", flush=True)
    
    col_map = normalize_columns(df.columns)
    print(f"DEBUG: Column Mapping Result: {col_map}", flush=True)

    if 'CIF' not in col_map:
        logger.error(f"Missing CIF in mapping. Mapping: {col_map}")
        raise HTTPException(status_code=400, detail=f"Column 'CIF' key not found. Found: {list(df.columns)}")

    count = 0
    errors = []

    for idx, row in df.iterrows():
        try:
            val_cif = row.get(col_map.get('CIF'))
            if pd.isna(val_cif): continue
            
            cif = str(val_cif).strip()
            
            # Upsert logic
            provider = db.query(Provider).filter(Provider.cif == cif).first()
            if not provider:
                provider = Provider(cif=cif)
                db.add(provider)
            
            # Helper to safely get string
            def get_s(key):
                real_col = col_map.get(key)
                if not real_col: return None
                val = row.get(real_col)
                return str(val).strip() if pd.notna(val) else None

            provider.name = get_s('NAME') or provider.name
            provider.email = get_s('EMAIL')
            provider.address = get_s('ADDRESS')
            provider.city = get_s('CITY')
            provider.zip_code = get_s('ZIP')
            provider.iban = get_s('IBAN')
            provider.phone = get_s('PHONE')
            provider.country = get_s('COUNTRY')
            provider.swift = get_s('SWIFT')
            
            count += 1
        except Exception as e:
            err_msg = f"Row {idx} error: {str(e)}"
            logger.warning(err_msg)
            errors.append(err_msg)

    db.commit()
    logger.info(f"Upload finished. Processed: {count}, Errors: {len(errors)}")
    return {"message": f"Processed {count} providers", "errors": errors[:10]}

@router.get("/", response_model=List[ProviderSchema])
def list_providers(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db)):
    providers = db.query(Provider).order_by(Provider.cif).offset(skip).limit(limit).all()
    return providers

# CRUD Endpoints

@router.post("/", response_model=ProviderSchema, status_code=201)
def create_provider(provider: ProviderCreate, db: Session = Depends(get_db)):
    # Check exists
    db_prov = db.query(Provider).filter(Provider.cif == provider.cif).first()
    if db_prov:
        raise HTTPException(status_code=400, detail="Provider with this CIF already exists")
    
    new_prov = Provider(**provider.dict())
    db.add(new_prov)
    db.commit()
    db.refresh(new_prov)
    return new_prov

@router.put("/{cif}", response_model=ProviderSchema)
def update_provider(cif: str, provider_in: ProviderCreate, db: Session = Depends(get_db)):
    db_prov = db.query(Provider).filter(Provider.cif == cif).first()
    if not db_prov:
        # Start with a new provider if not found (Upsert)
        db_prov = Provider(cif=cif)
        db.add(db_prov)
        # Continue to update fields below
    
    # Update fields
    data = provider_in.dict(exclude_unset=True, exclude={'updated_at'})
    for key, value in data.items():
        if key == 'cif' and value != cif:
            continue # Don't allow changing key via this method easily
        setattr(db_prov, key, value)
        
    db.commit()
    db.refresh(db_prov)
    return db_prov

@router.delete("/{cif}", status_code=204)
def delete_provider(cif: str, db: Session = Depends(get_db)):
    db_prov = db.query(Provider).filter(Provider.cif == cif).first()
    if not db_prov:
        raise HTTPException(status_code=404, detail="Provider not found")
        
    db.delete(db_prov)
    db.commit()
    return None

# --- STATS ENDPOINTS ---

from pydantic import BaseModel
from typing import Optional
from ..models import Invoice, Batch
from sqlalchemy import func
from ..services.duplicate_service import summarize_duplicate_groups, build_duplicate_key


class Insight(BaseModel):
    type: str
    message: str


class ProviderMonthlyVolume(BaseModel):
    label: str
    amount: float
    invoices: int


class DuplicateGroup(BaseModel):
    reference: str
    amount: float
    due_date: Optional[str] = None
    occurrences: int
    total_amount: float
    batch_ids: List[int] = []
    invoice_ids: List[int] = []


class ProviderInvoiceItem(BaseModel):
    id: int
    cif: str
    nombre: Optional[str] = None
    factura: Optional[str] = None
    importe: float
    fecha_vencimiento: Optional[datetime] = None
    status: str
    batch_id: Optional[int] = None
    batch_name: Optional[str] = None
    payment_date: Optional[datetime] = None
    duplicate_status: Optional[str] = None
    duplicate_message: Optional[str] = None


class ProviderStats(BaseModel):
    cif: str
    name: str
    total_amount: float
    total_invoices: int
    last_payment_date: Optional[str] = None
    average_amount: float
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    iban: Optional[str] = None
    swift: Optional[str] = None
    updated_at: Optional[str] = None
    next_due_date: Optional[str] = None
    upcoming_due_amount: float = 0.0
    upcoming_invoices_count: int = 0
    overdue_invoices_count: int = 0
    duplicate_invoices_count: int = 0
    duplicate_groups: List[DuplicateGroup] = []
    monthly_volume: List[ProviderMonthlyVolume] = []
    insights: List[Insight] = []


@router.get("/{cif}/stats", response_model=ProviderStats)
def get_provider_stats(cif: str, db: Session = Depends(get_db)):
    provider = db.query(Provider).filter(Provider.cif == cif).first()
    latest_invoice = db.query(Invoice).filter(Invoice.cif == cif).order_by(Invoice.id.desc()).first()

    if not latest_invoice and not provider:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    provider_name = provider.name if provider is not None else None
    name = provider_name or (latest_invoice.nombre if latest_invoice else "Desconocido")
    provider_invoices = db.query(Invoice).filter(Invoice.cif == cif).order_by(Invoice.id.desc()).all()

    stats = db.query(
        func.sum(Invoice.importe),
        func.count(Invoice.id),
        func.avg(Invoice.importe)
    ).filter(Invoice.cif == cif).first()

    total_amount = (stats[0] if stats else 0.0) or 0.0
    total_invoices = (stats[1] if stats else 0) or 0
    avg_amount = (stats[2] if stats else 0.0) or 0.0

    last_batch = db.query(Batch).join(Invoice).filter(Invoice.cif == cif).filter(Batch.payment_date != None).order_by(Batch.payment_date.desc()).first()
    last_payment = last_batch.payment_date.strftime("%Y-%m-%d") if last_batch and last_batch.payment_date else None

    today = datetime.now().date()
    next_30_days = today + timedelta(days=30)
    next_due_invoice = (
        db.query(Invoice)
        .filter(Invoice.cif == cif, Invoice.fecha_vencimiento != None, func.date(Invoice.fecha_vencimiento) >= today)
        .order_by(Invoice.fecha_vencimiento.asc())
        .first()
    )
    next_due_date = next_due_invoice.fecha_vencimiento.strftime("%Y-%m-%d") if next_due_invoice and next_due_invoice.fecha_vencimiento else None

    upcoming_stats = db.query(
        func.sum(Invoice.importe),
        func.count(Invoice.id),
    ).filter(
        Invoice.cif == cif,
        Invoice.fecha_vencimiento != None,
        func.date(Invoice.fecha_vencimiento) >= today,
        func.date(Invoice.fecha_vencimiento) <= next_30_days,
    ).first()
    upcoming_due_amount = (upcoming_stats[0] if upcoming_stats else 0.0) or 0.0
    upcoming_invoices_count = (upcoming_stats[1] if upcoming_stats else 0) or 0

    overdue_invoices_count = db.query(Invoice).filter(
        Invoice.cif == cif,
        Invoice.fecha_vencimiento != None,
        func.date(Invoice.fecha_vencimiento) < today,
    ).count()

    duplicate_groups = summarize_duplicate_groups(provider_invoices)
    duplicate_invoices_count = sum(group["occurrences"] for group in duplicate_groups)

    six_months_ago = datetime.utcnow() - timedelta(days=180)
    monthly_raw = (
        db.query(Batch.created_at, func.sum(Invoice.importe), func.count(Invoice.id))
        .join(Invoice)
        .filter(Invoice.cif == cif, Batch.created_at >= six_months_ago)
        .group_by(Batch.created_at)
        .all()
    )
    monthly_map = {}
    current = datetime.utcnow()
    for i in range(5, -1, -1):
        month_date = current - timedelta(days=i * 30)
        month_key = month_date.strftime("%Y-%m")
        monthly_map[month_key] = {"label": month_date.strftime("%b"), "amount": 0.0, "invoices": 0}

    for created_at, amount, count in monthly_raw:
        if not created_at:
            continue
        month_key = created_at.strftime("%Y-%m")
        if month_key in monthly_map:
            monthly_map[month_key]["amount"] += float(amount or 0.0)
            monthly_map[month_key]["invoices"] += int(count or 0)

    insights = []
    if total_amount > 50000:
        insights.append(Insight(type="positive", message="Proveedor VIP: volumen acumulado superior a 50k€"))
    if total_invoices > 12:
        insights.append(Insight(type="info", message="Proveedor recurrente: más de 12 facturas procesadas"))
    if avg_amount > 4000:
        insights.append(Insight(type="warning", message=f"Ticket medio alto: {avg_amount:,.2f}€ por factura"))

    if last_payment:
        last_date = datetime.strptime(last_payment, "%Y-%m-%d").date()
        days_diff = (datetime.now().date() - last_date).days
        if days_diff > 90:
            insights.append(Insight(type="warning", message=f"Inactivo: último pago hace {days_diff} días"))
    elif total_invoices > 0:
        insights.append(Insight(type="info", message="Pendiente de primer pago confirmado"))

    if not (provider and provider.email):
        insights.append(Insight(type="warning", message="Ficha incompleta: falta email del proveedor"))
    if not (provider and provider.iban):
        insights.append(Insight(type="warning", message="Ficha incompleta: falta IBAN maestro"))
    if duplicate_invoices_count:
        insights.append(Insight(type="warning", message=f"Se han detectado {duplicate_invoices_count} facturas duplicadas en histórico"))
    if upcoming_due_amount > 10000:
        insights.append(Insight(type="info", message=f"Exposición próxima: {upcoming_due_amount:,.2f}€ vencen en 30 días"))

    return {
        "cif": cif,
        "name": name,
        "total_amount": total_amount,
        "total_invoices": total_invoices,
        "last_payment_date": last_payment,
        "average_amount": avg_amount,
        "email": provider.email if provider else (latest_invoice.email if latest_invoice else None),
        "phone": provider.phone if provider else None,
        "address": provider.address if provider else (latest_invoice.direccion if latest_invoice else None),
        "city": provider.city if provider else (latest_invoice.poblacion if latest_invoice else None),
        "zip_code": provider.zip_code if provider else (latest_invoice.cp if latest_invoice else None),
        "country": provider.country if provider else (latest_invoice.pais if latest_invoice else None),
        "iban": provider.iban if provider else (latest_invoice.cuenta if latest_invoice else None),
        "swift": provider.swift if provider else None,
        "updated_at": provider.updated_at.isoformat() if provider and provider.updated_at else None,
        "next_due_date": next_due_date,
        "upcoming_due_amount": upcoming_due_amount,
        "upcoming_invoices_count": upcoming_invoices_count,
        "overdue_invoices_count": overdue_invoices_count,
        "duplicate_invoices_count": duplicate_invoices_count,
        "duplicate_groups": duplicate_groups,
        "monthly_volume": list(monthly_map.values()),
        "insights": insights
    }


@router.get("/{cif}/invoices", response_model=List[ProviderInvoiceItem])
def get_provider_invoices(cif: str, db: Session = Depends(get_db)):
    invoices = db.query(Invoice).filter(Invoice.cif == cif).order_by(Invoice.id.desc()).all()
    duplicate_counts = {}
    for invoice in invoices:
        key = build_duplicate_key(invoice)
        duplicate_counts[key] = duplicate_counts.get(key, 0) + 1

    response = []
    for invoice in invoices:
        key = build_duplicate_key(invoice)
        is_duplicate = duplicate_counts.get(key, 0) > 1
        response.append(
            {
                "id": invoice.id,
                "cif": invoice.cif,
                "nombre": invoice.nombre,
                "factura": invoice.factura,
                "importe": invoice.importe or 0.0,
                "fecha_vencimiento": invoice.fecha_vencimiento,
                "status": invoice.status,
                "batch_id": invoice.batch_id,
                "batch_name": invoice.batch.name if invoice.batch else None,
                "payment_date": invoice.batch.payment_date if invoice.batch else None,
                "duplicate_status": "HISTORICAL" if is_duplicate else None,
                "duplicate_message": "Coincide con otra factura histórica del mismo proveedor" if is_duplicate else None,
            }
        )
    return response
