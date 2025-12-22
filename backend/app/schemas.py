from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List, Any
from datetime import datetime, date
from enum import Enum

class InvoiceStatus(str, Enum):
    VALID = "VALID"
    WARNING = "WARNING"
    ERROR = "ERROR"

class InvoiceBase(BaseModel):
    cif: Optional[str] = None
    nombre: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    cp: Optional[str] = None
    poblacion: Optional[str] = None
    pais: Optional[str] = None
    cuenta: Optional[str] = None
    importe: Optional[float] = None
    factura: Optional[str] = None
    fecha_vencimiento: Optional[datetime] = None
    fecha_aplazamiento: Optional[datetime] = None

class InvoiceCreate(InvoiceBase):
    pass

class Invoice(InvoiceBase):
    id: int
    batch_id: Optional[int] = None
    status: InvoiceStatus
    validation_message: Optional[str] = None

    class Config:
        from_attributes = True

class BatchBase(BaseModel):
    name: str
    file_hash: Optional[str] = None

class Batch(BatchBase):
    id: int
    created_at: datetime
    payment_date: Optional[datetime] = None
    status: str
    uploaded_to_bank: bool = False
    total_amount: Optional[float] = 0.0
    invoices: List[Invoice] = []

    class Config:
        from_attributes = True

class SettingsBase(BaseModel):
    codigo_empresa: Optional[str] = ""
    numero_cuenta_cargo: Optional[str] = ""
    sufijo: Optional[str] = "000"
    nombre_empresa: Optional[str] = ""
    cif_empresa: Optional[str] = ""
    export_path: Optional[str] = ""
    smtp_server: Optional[str] = ""
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = ""
    smtp_password: Optional[str] = ""
    smtp_from_email: Optional[str] = ""

class SettingsCreate(SettingsBase):
    pass

class Settings(SettingsBase):
    id: int
    class Config:
        from_attributes = True

class ProviderBase(BaseModel):
    cif: str
    name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    iban: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    swift: Optional[str] = None

class ProviderCreate(ProviderBase):
    pass

class Provider(ProviderBase):
    updated_at: datetime
    class Config:
        from_attributes = True

class PaginatedBatches(BaseModel):
    items: List[Batch]
    total: int
