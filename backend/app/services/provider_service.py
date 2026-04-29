from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import Provider
from datetime import datetime

def normalize_cif(cif: str) -> str:
    """Normaliza el CIF: strip, upper, sin espacios"""
    if not cif:
        return cif
    return cif.strip().upper().replace(" ", "")

def upsert_providers_by_cif(db: Session, providers_data: list[dict]) -> dict:
    """
    UPSERT de proveedores por CIF (compatible con PostgreSQL y SQLite).
    - Si el CIF no existe, lo crea.
    - Si el CIF ya existe, actualiza sus datos básicos.
    - Devuelve un dict {cif: Provider} para mapeo rápido.
    """
    # Deduplicar por CIF (quedarse con el último)
    seen = {}
    for pdata in providers_data:
        cif = normalize_cif(pdata.get('cif'))
        if cif:
            seen[cif] = pdata
    
    if not seen:
        return {}
    
    # Obtener proveedores existentes
    existing_providers = db.query(Provider).filter(Provider.cif.in_(list(seen.keys()))).all()
    existing_cifs = {p.cif for p in existing_providers}
    
    # Actualizar existentes y preparar nuevos
    for cif, data in seen.items():
        if cif in existing_cifs:
            # Actualizar proveedor existente
            provider = db.query(Provider).filter(Provider.cif == cif).first()
            if provider:
                if data.get('name'):
                    provider.name = data['name']
                if data.get('email'):
                    provider.email = data['email']
                if data.get('address'):
                    provider.address = data['address']
                if data.get('city'):
                    provider.city = data['city']
                if data.get('zip_code'):
                    provider.zip_code = data['zip_code']
                if data.get('country'):
                    provider.country = data['country']
                if data.get('phone'):
                    provider.phone = data['phone']
                if data.get('iban'):
                    provider.iban = data['iban']
                provider.updated_at = datetime.utcnow()
        else:
            # Crear nuevo proveedor
            new_provider = Provider(
                cif=cif,
                name=data.get('name', ''),
                email=data.get('email'),
                address=data.get('address'),
                city=data.get('city'),
                zip_code=data.get('zip_code'),
                country=data.get('country'),
                phone=data.get('phone'),
                iban=data.get('iban'),
                updated_at=datetime.utcnow()
            )
            db.add(new_provider)
    
    db.flush()
    
    # Devolver diccionario de proveedores para mapeo
    cifs = list(seen.keys())
    providers = db.query(Provider).filter(Provider.cif.in_(cifs)).all()
    return {p.cif: p for p in providers}
