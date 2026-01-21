import io
import pandas as pd
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

def adjust_column_width(ws):
    for column in ws.columns:
        max_length = 0
        column = [cell for cell in column]
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = (max_length + 2)
        ws.column_dimensions[get_column_letter(column[0].column)].width = adjusted_width

def style_header(ws):
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="3b82f6", end_color="3b82f6", fill_type="solid") # Blue-500
    alignment = Alignment(horizontal="center", vertical="center")
    
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = alignment

def generate_excel_from_df(df: pd.DataFrame, sheet_name: str = "Sheet1") -> bytes:
    buffer = io.BytesIO()
    
    # Use ExcelWriter with openpyxl engine
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name=sheet_name)
        
        # Access the workbook and worksheet to apply styles
        workbook = writer.book
        worksheet = writer.sheets[sheet_name]
        
        style_header(worksheet)
        adjust_column_width(worksheet)
        
    buffer.seek(0)
    return buffer.read()

def generate_dashboard_excel(stats):
    """
    Generates a multi-sheet Excel for Dashboard Stats
    """
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        # Sheet 1: Monthly Volume
        df_volume = pd.DataFrame(stats['monthly_volume'])
        if not df_volume.empty:
            df_volume = df_volume[['full_date', 'name', 'amount']]
            df_volume.columns = ['Fecha', 'Mes', 'Importe']
            df_volume.to_excel(writer, sheet_name='Volumen Mensual', index=False)
            
        # Sheet 2: Weekly Cash Flow
        df_cashflow = pd.DataFrame(stats['cash_flow_projection'])
        if not df_cashflow.empty:
            df_cashflow = df_cashflow[['name', 'range', 'amount']]
            df_cashflow.columns = ['Semana', 'Rango', 'Importe']
            df_cashflow.to_excel(writer, sheet_name='Proyección Pagos', index=False)
            
        # Sheet 3: Status
        df_status = pd.DataFrame(stats['status_distribution'])
        if not df_status.empty:
            df_status.to_excel(writer, sheet_name='Estado Facturas', index=False)
            
    buffer.seek(0)
    return buffer.read()
