import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Provider, Invoice, Batch
from app.database import Base
from app.services.provider_service import normalize_cif, upsert_providers_by_cif
from datetime import datetime, date

def test_upsert_providers_by_cif():
    """Test unitario: UPSERT de proveedores con CIFs duplicados"""
    # Crear BD en memoria
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    # Datos con CIFs duplicados
    providers_data = [
        {
            'cif': 'B72546815',
            'name': 'DISTRICOMPO SL',
            'email': 'prov1@test.com',
            'address': 'Calle Mayor 1',
            'city': 'Madrid',
            'zip_code': '28001',
            'country': 'España',
            'phone': '911234567',
            'iban': 'ES1234567890123456789012'
        },
        {
            'cif': 'B72546815',  # Mismo CIF - duplicado
            'name': 'DISTRICOMPO SL',
            'email': 'prov1@test.com',
            'address': 'Calle Mayor 1',
            'city': 'Madrid',
            'zip_code': '28001',
            'country': 'España',
            'phone': '911234567',
            'iban': 'ES1234567890123456789012'
        },
        {
            'cif': 'A12345678',  # Otro CIF
            'name': 'OTRO PROVEEDOR SL',
            'email': 'prov2@test.com',
            'importe': 500.00
        }
    ]
    
    # Ejecutar UPSERT
    providers_map = upsert_providers_by_cif(db, providers_data)
    db.commit()
    
    # Verificar: solo 2 proveedores (no 3 por duplicados)
    all_providers = db.query(Provider).all()
    assert len(all_providers) == 2, f"Esperado 2 proveedores, obtenido {len(all_providers)}"
    
    # Verificar CIFs
    cifs = [p.cif for p in all_providers]
    assert 'B72546815' in cifs, "CIF B72546815 no encontrado"
    assert 'A12345678' in cifs, "CIF A12345678 no encontrado"
    
    # Verificar que solo hay 1 proveedor con B72546815 (no duplicado)
    b725_providers = db.query(Provider).filter(Provider.cif == 'B72546815').all()
    assert len(b725_providers) == 1, f"Esperado 1 proveedor con B72546815, obtenido {len(b725_providers)}"
    
    print("✅ Test passed: UPSERT con deduplicación funciona correctamente")
    print(f"   - Proveedores creados: {len(all_providers)}")
    print(f"   - CIFs: {cifs}")
    
    db.close()

def test_normalize_cif():
    """Test: Normalización de CIF"""
    assert normalize_cif(" b72546815 ") == "B72546815"
    assert normalize_cif("B 725 468 15") == "B72546815"
    assert normalize_cif("b72546815") == "B72546815"
    assert normalize_cif(None) is None
    assert normalize_cif("") == ""
    print("✅ CIF normalization works")

if __name__ == "__main__":
    print("=" * 50)
    print("EJECUTANDO TESTS UNITARIOS")
    print("=" * 50)
    
    print("\n1. Test normalize_cif:")
    test_normalize_cif()
    
    print("\n2. Test upsert_providers_by_cif:")
    test_upsert_providers_by_cif()
    
    print("\n" + "=" * 50)
    print("TODOS LOS TESTS PASSED!")
    print("=" * 50)