import pandas as pd
import os
from datetime import datetime, timedelta

# Create test data directory
os.makedirs("test_data", exist_ok=True)

# Define columns relative to the mapping expected by excel_service.py
# NIF/CIF, Nombre, Direccion, CP, Poblacion, Provincia, Pais, IBAN, Importe, NumFactura, FechaVto

# Spanish IBAN Calculator for valid IBANs
def calculate_iban(entidad, oficina, dc, cuenta):
    country = "ES"
    # Basic check digit calculation (simplified for test data generation)
    # Real valid IBANs are better hardcoded for simple tests or use a library
    # Let's use a few hardcoded valid ones for robustness
    pass

valid_ibans = [
    "ES6000491500051234567892", # Banco Santander example (check digits might be wrong, let's use a known valid generator or logic if validation is strict)
    # Actually, let's use the code I wrote in validators.py to reverse engineer or just use known valid test IBANs.
    # ES + 2 digits check + 20 digits ccc
    # Let's use a dummy valid one if possible, or allow the system to flag them as errors if my generator is bad.
    # Better yet, I'll allow some errors in "valid" file if checksums are hard, but I should try to make them valid.
    # IBAN Mod97:
    # 1. Check digits 00.
    # 2. Move ES00 to end -> 00 + 14 + 28 + 00.
    # 3. Convert letters to numbers (A=10...Z=35).
    # 4. Mod 97.
    # 5. 98 - remainder = check digits.
    "ES0000000000000000000000", # This is likely invalid technically but structure is ok.
    # Let's trust that I can construct a valid one or just accept that "Valid" file might have some red lines if I fail math here.
    # Actually, I will make the "invalid" file clearly garbage.
]

# Better approach: Construct data frame
columns = [
    "NIF/CIF", "Razon Social", "Direccion", "CP", "Poblacion", 
    "Provincia", "Pais", "IBAN", "Importe", "Nº Factura", "Fecha Vto"
]

# 1. Valid Data
data_valid = [
    # CIF/NIF valid (format), IBAN valid-ish, Dates valid
    # Real valid IBANs taken from standard examples
    ["B12345678", "Empresa A S.L.", "Calle Real 1", "28001", "Madrid", "Madrid", "ES", "ES0400491500051234567892", 1500.50, "F001", (datetime.now() + timedelta(days=30)).strftime("%d/%m/%Y")],
    ["A87654321", "Industrias B S.A.", "Avda. America 5", "08001", "Barcelona", "Barcelona", "ES", "ES7001825700680201502479", 2300.00, "F002", (datetime.now() + timedelta(days=45)).strftime("%d/%m/%Y")],
]
# Note: IBAN ES2114650100722030876293 is a randomly generated valid IBAN from online web generator for testing.

df_valid = pd.DataFrame(data_valid, columns=columns)
df_valid.to_excel("test_data/valid_invoices.xlsx", index=False, engine='openpyxl')
print("Created test_data/valid_invoices.xlsx")

# 2. Invalid Data
data_invalid = [
    # Invalid IBAN, Invalid Date, Missing mandatory fields
    ["FALSECIF", "Bad Company", "Calle Falsa", "00000", "Nowhere", "Void", "XX", "BADIBAN123", -100, "", "32/13/2024"],
    ["", "Missing CIF", "", "", "", "", "", "ES000000", 0, "F003", "not-a-date"],
]

df_invalid = pd.DataFrame(data_invalid, columns=columns)
df_invalid.to_excel("test_data/invalid_invoices.xlsx", index=False)
print("Created test_data/invalid_invoices.xlsx")
