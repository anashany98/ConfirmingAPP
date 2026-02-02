import pandas as pd
import io
import re
import traceback
import logging
from fastapi import HTTPException
from sqlalchemy.orm import Session
from ..models import Provider
from ..utils.validators import validate_iban, validate_spanish_cif

# Setup logger
logging.basicConfig(filename='import_error.log', level=logging.ERROR)


def process_excel_file(content: bytes, db: Session = None):
    """
    Process Excel file which can be:
    1. A flat list of invoices (Standard Format).
    2. A Factusol "Transferencias" Report (Grouped Headers).
    """
    try:
        # Check for Factusol Report Signature
        # Look for "Núm. Fec.Exp." in the first few rows by reading without header
        df_scan = pd.read_excel(io.BytesIO(content), header=None, nrows=15)
        
        is_factusol_report = False
        with open("debug_manual.log", "a") as f: 
            f.write("Scanning for Factusol signature...\n")
            for i in range(len(df_scan)):
                row_list = [str(x) for x in df_scan.iloc[i].values]
                row_str = " ".join(row_list)
                f.write(f"Row {i}: {row_str}\n")
                
                # Check signature
                if "Fec.Exp." in row_str and "Banco" in row_str:
                    is_factusol_report = True
                    f.write("--> SIGNATURE MATCHED!\n")
                    break
                
        if is_factusol_report:
            df = pd.read_excel(io.BytesIO(content), header=None)
            return process_factusol_report(df, db)
        else:
            with open("debug_manual.log", "a") as f: f.write("--> No signature. Falling back to simple table.\n")
            return process_flat_table(content, db)

    except Exception as e:
        error_msg = f"Error processing Excel: {str(e)}\n{traceback.format_exc()}"
        logging.error(error_msg)
        print(error_msg) # Print to console for user to see
        raise HTTPException(status_code=400, detail=f"Error processing Excel: {str(e)}")

def process_factusol_report(df: pd.DataFrame, db: Session = None):
    invoices = []
    current_payment_date = None
    
    re_invoice = re.compile(r'Nº:?\s*([A-Za-z0-9\-\/]+)', re.IGNORECASE)
    re_cif = re.compile(r'^[A-Z]\d{7,8}[A-Z0-9]$|^[0-9]{8}[A-Z]$', re.IGNORECASE)

    iterator = df.itertuples(index=False, name=None)
    
    for row in iterator:
        row_clean = [str(x).strip() if pd.notna(x) else "" for x in row]
        if len(row_clean) < 6: continue 

        col0 = row_clean[0] 
        col1 = row_clean[1] 
        col2 = row_clean[2] 
        col3 = row_clean[3] 
        col4 = row_clean[4]
        
        # DETECT BATCH HEADER
        if col0.isdigit() and "/" in col2 and len(col2) == 10:
            current_payment_date = col2
            continue

        # DETECT DATA ROW (Handling Indentation)
        cif_candidate = col0
        name_candidate = col1
        iban_candidate = col2
        concept_candidate = col3
        
        # If Col0 is empty, shift right
        if not col0 and re_cif.match(col1):
            cif_candidate = col1
            name_candidate = col2
            iban_candidate = col3
            concept_candidate = col4 
        
        if re_cif.match(cif_candidate):
            cif = cif_candidate
            name = name_candidate
            iban = iban_candidate
            concept = concept_candidate
            amount_raw = ""
            
            # Find amount
            for val in reversed(row_clean):
                if re.match(r'^-?[\d\.,]+$', val) and any(c.isdigit() for c in val):
                    amount_raw = val
                    break
            
            # Extract Invoice Number
            invoice_number = concept 
            match = re_invoice.search(concept)
            if match:
                invoice_number = match.group(1)

            # Parse Amount
            try:
                clean_amount = amount_raw.replace('.', '').replace(',', '.')
                amount = float(clean_amount)
            except:
                amount = 0.0

            # ENRICHMENT (Using DB)
            email = ""
            address = ""
            city = ""
            zip_code = ""
            country = "ES"
            
            enrichment_note = []

            if db:
                provider = db.query(Provider).filter(Provider.cif == cif).first()
                if provider:
                    if not name or len(name) < 3: 
                        name = provider.name
                        enrichment_note.append("Nombre")
                    # Enrich other fields
                    email = provider.email or ""
                    address = provider.address or ""
                    city = provider.city or ""
                    zip_code = provider.zip_code or ""
                    country = provider.country or "ES"
                    phone = provider.phone or ""

                    # Check for IBAN Mismatch
                    # If file has IBAN, and DB has IBAN, and they differ -> Mismatch
                    db_iban = provider.iban
                    iban_mismatch = False
                    
                    if iban and db_iban:
                         # Normalize for comparison (remove spaces)
                         norm_file = iban.replace(" ", "").upper()
                         norm_db = db_iban.replace(" ", "").upper()
                         if norm_file != norm_db:
                             iban_mismatch = True
                    elif not iban and db_iban:
                         # Auto-fill if missing in file
                         iban = db_iban
                         enrichment_note.append("IBAN")

            # VALIDATION LOGIC
            status = "VALID"
            val_msgs = []
            
            if enrichment_note:
                val_msgs.append(f"Auto-completado: {', '.join(enrichment_note)}")
            
            if not cif:
                status = "ERROR"
                val_msgs.append("Falta CIF")
            elif not validate_spanish_cif(cif):
                status = "WARNING"
                val_msgs.append(f"CIF sospechoso: {cif}")

            if not amount or amount == 0:
                status = "WARNING"
                val_msgs.append("Importe 0")

            if not iban:
                status = "WARNING"
                val_msgs.append("Falta IBAN")
            elif not validate_iban(iban):
                status = "ERROR"
                val_msgs.append("IBAN Inválido")

            # Map to Spanish Schema
            invoices.append({
                "factura": invoice_number,
                "importe": amount,
                "fecha_vencimiento": None, 
                "fecha_aplazamiento": None,
                "cif": cif,
                "nombre": name,
                "cuenta": iban,
                "email": email,
                "direccion": address,
                "poblacion": city,
                "cp": zip_code,
                "pais": country,
                "status": status,
                "validation_message": ", ".join(val_msgs),
                "iban_mismatch": locals().get('iban_mismatch', False),
                "uban_mismatch": locals().get('iban_mismatch', False),
                "db_iban": locals().get('db_iban', ""),
                "phone": locals().get('phone', "")
            })
            
            # Inject payment date if needed.
            if current_payment_date:
                try:
                    from datetime import datetime
                    dt = datetime.strptime(current_payment_date, "%d/%m/%Y")
                    invoices[-1]["fecha_vencimiento"] = dt
                except:
                    pass

    return invoices

def process_flat_table(content: bytes, db: Session = None):
    df = pd.read_excel(io.BytesIO(content))
    
    # Normalize headers
    df.columns = [str(c).upper().strip() for c in df.columns]
    
    # Basic mapping
    mapping = {
        'INVOICE_NUMBER': ['FACTURA', 'NUMERO', 'NUM_FACTURA', 'REF', 'INVOICE'],
        'AMOUNT': ['IMPORTE', 'TOTAL', 'AMOUNT', 'PRECIO'],
        'PAYMENT_DATE': ['FECHA_PAGO', 'VENCIMIENTO', 'FECHA', 'DATE', 'FECHA DE VENCIMIENTO'],
        'CIF': ['CIF', 'NIF'],
        'NAME': ['NOMBRE', 'PROVEEDOR', 'NAME'],
        'IBAN': ['IBAN', 'CUENTA', 'ACCOUNT'],
        'EMAIL': ['EMAIL', 'CORREO', 'MAIL', 'E-MAIL'],
        'ADDRESS': ['DIRECCION', 'ADDRESS', 'DOMICILIO'],
        'CITY': ['POBLACION', 'CIUDAD', 'CITY', 'MUNICIPIO'],
        'ZIP': ['CP', 'ZIP', 'CODIGO_POSTAL', 'POSTAL'],
        'COUNTRY': ['PAIS', 'COUNTRY', 'NACION']
    }
    
    final_col_map = {}
    for key, aliases in mapping.items():
        for col in df.columns:
            if col in aliases or any(a in col for a in aliases):
                final_col_map[key] = col
                break
    
    data = []
    for _, row in df.iterrows():
        raw_amount = row.get(final_col_map.get('AMOUNT'), 0)
        
        inv = {
            "factura": str(row.get(final_col_map.get('INVOICE_NUMBER'), 'Unknown')),
            "importe": 0.0,
            "cif": str(row.get(final_col_map.get('CIF'), '')),
            "nombre": str(row.get(final_col_map.get('NAME'), '')),
            "cuenta": str(row.get(final_col_map.get('IBAN'), '')),
            "email": str(row.get(final_col_map.get('EMAIL'), '')),
            "direccion": str(row.get(final_col_map.get('ADDRESS'), '')),
            "poblacion": str(row.get(final_col_map.get('CITY'), '')),
            "cp": str(row.get(final_col_map.get('ZIP'), '')),
            "pais": str(row.get(final_col_map.get('COUNTRY'), 'ES')),
            "status": "VALID",
            "phone": ""
        }
        
        # Clean 'nan' values
        for k, v in inv.items():
            if v == 'nan': inv[k] = ""
            
        # Filter Dummy Emails
        if inv['email'].upper().strip() in ['TEST@TEST.COM', 'EMAIL@EMAIL.COM', 'EXAMPLE@EXAMPLE.COM']:
            inv['email'] = ""

        if inv['pais'].upper() in ['ESPAÑA', 'SPAIN', 'ESP']:
            inv['pais'] = 'ES'

        # Handle Amount conversion
        try:
            if isinstance(raw_amount, (int, float)):
                inv['importe'] = float(raw_amount)
            else:
                val = str(raw_amount).replace('.', '').replace(',', '.')
                inv['importe'] = float(val)
        except:
            inv['importe'] = 0.0
            
        # Date handling
        date_val = row.get(final_col_map.get('PAYMENT_DATE'))
        if pd.notna(date_val):
            try:
                inv['fecha_vencimiento'] = pd.to_datetime(date_val).to_pydatetime()
            except:
                inv['fecha_vencimiento'] = None
        else:
             inv['fecha_vencimiento'] = None

        # Enrichment
        if db and inv['cif']:
            provider = db.query(Provider).filter(Provider.cif == inv['cif']).first()
            if provider:
                if not inv['nombre']: inv['nombre'] = provider.name
                
                # Enrichment: Overwrite only if empty
                if not inv['email']: inv['email'] = provider.email or ""
                if not inv['direccion']: inv['direccion'] = provider.address or ""
                if not inv['poblacion']: inv['poblacion'] = provider.city or ""
                if not inv['cp']: inv['cp'] = provider.zip_code or ""
                if not inv['cp']: inv['cp'] = provider.zip_code or ""
                if not inv['pais'] or inv['pais'] == 'ES': # Prefer Provider country if we have default ES
                     if provider.country: inv['pais'] = provider.country
                
                if not inv['phone']: inv['phone'] = provider.phone or ""

                inv['db_iban'] = provider.iban or ""
                inv['iban_mismatch'] = False
                
                file_iban = inv['cuenta']
                db_iban = provider.iban
                
                if file_iban and len(file_iban) > 5 and db_iban:
                    if file_iban.replace(" ", "").upper() != db_iban.replace(" ", "").upper():
                        inv['iban_mismatch'] = True
                elif (not file_iban or file_iban == 'nan') and db_iban:
                     inv['cuenta'] = db_iban
             
        data.append(inv)
        
    return data
