from typing import List
import pandas as pd
import io
from ..schemas import Invoice
from sqlalchemy.orm import Session
from ..models import Settings

def generate_bankinter_excel(invoices: List[Invoice], db: Session) -> bytes:
    # Fetch settings
    settings = db.query(Settings).first()
    payer_iban = settings.numero_cuenta_cargo if settings else ""
    
    # Define exact columns as requested
    columns = [
        "CIF", "NOMBRE", "EMAIL", "DIRECCION", "CP", "POBLACION", "PAIS", 
        "CUENTA", "IMPORTE", "FACTURA", "FECHA DE VENCIMIENTO", "FECHA DE APLAZAMIENTO",
        "", "", "CUENTA CONFIRMING", "", "", "", "", "", "FORMA PAGO", "RESIDENCIA", "", "", "PREFIJO"
    ]
    
    rows = []
    for inv in invoices:
        # Prepare row with empty strings for blank columns
        row = [
            inv.cif or "",                              # CIF
            inv.nombre or "",                           # NOMBRE
            inv.email or "",                            # EMAIL
            inv.direccion or "",                        # DIRECCION
            inv.cp or "",                               # CP
            inv.poblacion or "",                        # POBLACION
            inv.pais or "ES",                           # PAIS
            inv.cuenta or "",                           # CUENTA
            inv.importe,                                # IMPORTE (Number)
            inv.factura or "",                          # FACTURA
            inv.fecha_vencimiento.strftime("%Y%m%d") if inv.fecha_vencimiento else "", # FECHA VTO
            inv.fecha_aplazamiento.strftime("%Y%m%d") if inv.fecha_aplazamiento else "", # FECHA APLAZAMIENTO (Optional)
            "", "",                                     # Empty x2
            payer_iban,                                 # CUENTA CONFIRMING
            "", "", "", "", "",                         # Empty x5
            "T",                                        # FORMA PAGO
            "ES",                                       # RESIDENCIA (As seen in sample 'ES')
            "", "",                                     # Empty x2
            "001"                                       # PREFIJO
        ]
        rows.append(row)

    df = pd.DataFrame(rows, columns=columns)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='CONFIRMING', index=False)
    
    return output.getvalue()
