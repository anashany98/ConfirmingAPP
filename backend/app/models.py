from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum as SqEnum, Boolean
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from .database import Base

class BatchStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    GENERATED = "GENERATED"
    SENT = "SENT"

class InvoiceStatus(str, enum.Enum):
    VALID = "VALID"
    WARNING = "WARNING"
    ERROR = "ERROR"

class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    name = Column(String, index=True)
    file_hash = Column(String, index=True, nullable=True)
    payment_date = Column(DateTime, nullable=True)
    status = Column(SqEnum(BatchStatus), default=BatchStatus.DRAFT)
    uploaded_to_bank = Column(Boolean, default=False)
    
    invoices = relationship("Invoice", back_populates="batch")

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    
    # Raw Excel Columns
    cif = Column(String, index=True)
    nombre = Column(String)
    email = Column(String)
    direccion = Column(String)
    cp = Column(String)
    poblacion = Column(String)
    pais = Column(String)
    cuenta = Column(String)
    importe = Column(Float)
    factura = Column(String)
    fecha_vencimiento = Column(DateTime)
    fecha_aplazamiento = Column(DateTime, nullable=True)

    # Validation Status
    status = Column(SqEnum(InvoiceStatus), default=InvoiceStatus.VALID)
    validation_message = Column(String, nullable=True)

    batch = relationship("Batch", back_populates="invoices")

class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    # Bankinter Config
    codigo_empresa = Column(String, default="")
    numero_cuenta_cargo = Column(String, default="") # IBAN payer
    sufijo = Column(String, default="000")
    
    # Defaults for file generation
    nombre_empresa = Column(String, default="")
    cif_empresa = Column(String, default="")
    export_path = Column(String, default="") # Folder to save exports
    
    # SMTP Email Configuration
    smtp_server = Column(String, default="")
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String, default="")
    smtp_password = Column(String, default="") # Should be encrypted in prod but plain text for local MVP
    smtp_from_email = Column(String, default="")

class Provider(Base):
    __tablename__ = "providers"

    cif = Column(String, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    iban = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    country = Column(String, nullable=True)
    swift = Column(String, nullable=True)
    
    # Metadata
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ImportLog(Base):
    __tablename__ = "import_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    filename = Column(String)
    status = Column(String) # "SUCCESS", "ERROR", "WARNING"
    details = Column(String, nullable=True) # Error message or summary
    total_invoices = Column(Integer, default=0)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
