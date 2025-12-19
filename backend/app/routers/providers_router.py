from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Provider
from ..schemas import Provider as ProviderSchema, ProviderCreate
import pandas as pd
import io

router = APIRouter(prefix="/providers", tags=["providers"])

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
    logger.info(f"Columns detected: {list(df.columns)}")
    
    col_map = normalize_columns(df.columns)
    logger.info(f"Column Mapping Result: {col_map}")

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
