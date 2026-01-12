from fastapi import APIRouter, Depends, HTTPException
from ..routers.auth_router import get_current_user
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Settings
from ..schemas import Settings as SettingsSchema, SettingsCreate

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    dependencies=[Depends(get_current_user)]
)

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
    
    settings_data = settings_in.dict(exclude_unset=True)
    for key, value in settings_data.items():
        setattr(settings, key, value)
    
    db.commit()
    db.refresh(settings)
    return settings
