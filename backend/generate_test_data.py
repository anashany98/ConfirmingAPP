import pandas as pd
import os
from datetime import datetime, timedelta

# Create test data directory
os.makedirs("test_data", exist_ok=True)

# Columns expected by process_flat_table in excel_service.py:
# FACTURA, IMPORTE, VENCIMIENTO, CIF, NOMBRE, IBAN, EMAIL, DIRECCION, POBLACION, CP, PAIS

columns = [
    "FACTURA", "IMPORTE", "VENCIMIENTO", "CIF", "NOMBRE", 
    "IBAN", "EMAIL", "DIRECCION", "POBLACION", "CP", "PAIS"
]

# 1. Valid Remittance
data_valid = [
    ["F-2024-001", 1250.75, (datetime.now() + timedelta(days=30)).strftime("%d/%m/%Y"), "B87654321", "Proveedor Tecnológico S.A.", "ES7001825700680201502479", "tecnico@prov-tec.com", "Calle Ficticia 123", "Madrid", "28001", "ES"],
    ["F-2024-002", 3400.00, (datetime.now() + timedelta(days=30)).strftime("%d/%m/%Y"), "A11223344", "Logística Rápida S.L.", "ES2114650100722030876293", "info@logirapida.es", "Polígono Industrial Nave 4", "Barcelona", "08005", "ES"],
    ["F-2024-003", 890.20, (datetime.now() + timedelta(days=15)).strftime("%d/%m/%Y"), "B55667788", "Servicios Generales Global", "ES4421000100722030876211", "admin@sergeglo.es", "Av. Libertad 45", "Sevilla", "41010", "ES"],
]

df_valid = pd.DataFrame(data_valid, columns=columns)
df_valid.to_excel("test_data/remesa_valida.xlsx", index=False)
print("Created test_data/remesa_valida.xlsx")

# 2. Remittance with Errors (Invalid IBAN, Invalid Date, Missing CIF)
data_errors = [
    ["ERROR-001", 500.00, "FECHA-INVALIDA", "B87654321", "Proveedor Tecnológico S.A.", "IBAN-CORTO", "", "", "", "", "ES"],
    ["ERROR-002", -100, (datetime.now() + timedelta(days=30)).strftime("%d/%m/%Y"), "", "Empresa Sin CIF", "ES7001825700680201502479", "", "", "", "", "ES"],
    ["ERROR-003", 1000.00, (datetime.now() + timedelta(days=30)).strftime("%d/%m/%Y"), "B55667788", "IBAN Mismatch Test", "ES0000000000000000000000", "", "", "", "", "ES"],
]

df_errors = pd.DataFrame(data_errors, columns=columns)
df_errors.to_excel("test_data/remesa_con_errores.xlsx", index=False)
print("Created test_data/remesa_con_errores.xlsx")
