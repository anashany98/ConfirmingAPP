from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Settings
from ..schemas import Settings as SettingsSchema, SettingsCreate

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("/", response_model=SettingsSchema)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Settings).first()
    if not settings:
        # Create default if not exists
        settings = Settings(
            codigo_empresa="0000",
            numero_cuenta_cargo="",
            sufijo="000",
            nombre_empresa="MI EMPRESA S.L.",
            cif_empresa="",
            export_path=""
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/", response_model=SettingsSchema)
def update_settings(settings_in: SettingsCreate, db: Session = Depends(get_db)):
    settings = db.query(Settings).first()
    if not settings:
        settings = Settings()
        db.add(settings)
    
    settings.codigo_empresa = settings_in.codigo_empresa
    settings.numero_cuenta_cargo = settings_in.numero_cuenta_cargo
    settings.sufijo = settings_in.sufijo
    settings.nombre_empresa = settings_in.nombre_empresa
    settings.cif_empresa = settings_in.cif_empresa
    settings.export_path = settings_in.export_path
    
    db.commit()
    db.refresh(settings)
    return settings
