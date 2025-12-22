from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import io
from datetime import datetime

def generate_batch_pdf(batch):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    normal_style = styles['Normal']
    
    # Title
    elements.append(Paragraph(f"Orden de Confirming - Remesa #{batch.id}", title_style))
    elements.append(Spacer(1, 12))
    
    # Details
    batch_date = batch.created_at.strftime("%d/%m/%Y") if batch.created_at else "-"
    payment_date = batch.payment_date.strftime("%d/%m/%Y") if batch.payment_date else "-"
    
    elements.append(Paragraph(f"<b>Fecha de Creación:</b> {batch_date}", normal_style))
    elements.append(Paragraph(f"<b>Fecha de Pago:</b> {payment_date}", normal_style))
    elements.append(Paragraph(f"<b>Nombre Remesa:</b> {batch.name}", normal_style))
    elements.append(Spacer(1, 24))
    
    # Invoices Table
    data = [['Factura', 'Proveedor', 'CIF', 'Vencimiento', 'Importe']]
    
    total = 0
    for inv in batch.invoices:
        data.append([
            inv.factura,
            inv.nombre[:30], # Truncate long names
            inv.cif,
            inv.fecha_vencimiento.strftime("%d/%m/%Y") if inv.fecha_vencimiento else "-",
            f"{inv.importe:,.2f} €"
        ])
        total += inv.importe
        
    # Total Row
    data.append(['', '', '', 'TOTAL', f"{total:,.2f} €"])
    
    table = Table(data, colWidths=[80, 200, 70, 80, 80])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -2), 1, colors.black), # Grid for content
        ('LINEBELOW', (0, -1), (-1, -1), 2, colors.black), # Line below total
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'), # Bold Total
        ('BACKGROUND', (0, -1), (-1, -1), colors.whitesmoke),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 48))
    
    # Signatures
    sig_data = [['Firma Responsable Financiero:', 'Firma Dirección:']]
    sig_table = Table(sig_data, colWidths=[250, 250])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('TOPPADDING', (0, 0), (-1, 0), 20),
    ]))
    
    elements.append(sig_table)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.read()

def generate_monthly_report_pdf(stats):
    """
    stats = {
        "month": "Diciembre",
        "year": 2024,
        "total_amount": 12345.67,
        "total_invoices": 45,
        "active_providers": 12,
        "top_providers": [ { "name": "Prov A", "amount": 1000 }, ... ],
        "weekly_breakdown": [ { "week": "Semana 1", "amount": 500 }, ... ]
    }
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    h2_style = styles['Heading2']
    normal_style = styles['Normal']
    
    # Title
    elements.append(Paragraph(f"Informe Mensual de Tesorería", title_style))
    elements.append(Paragraph(f"{stats['month']} {stats['year']}", h2_style))
    elements.append(Spacer(1, 24))
    
    # KPI Box (Simulated with Table)
    kpi_data = [
        ['Total Procesado', 'Facturas', 'Proveedores Activos'],
        [f"{stats['total_amount']:,.2f} €", str(stats['total_invoices']), str(stats['active_providers'])]
    ]
    
    kpi_table = Table(kpi_data, colWidths=[150, 100, 150])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica'),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 14),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.white),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 36))
    
    # Top Providers
    elements.append(Paragraph("Top 5 Proveedores (Volumen)", h2_style))
    elements.append(Spacer(1, 12))
    
    prov_data = [['Proveedor', 'Importe Acumulado']]
    for p in stats['top_providers']:
        prov_data.append([p['name'], f"{p['amount']:,.2f} €"])
        
    prov_table = Table(prov_data, colWidths=[300, 150])
    prov_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(prov_table)
    elements.append(Spacer(1, 36))

    # Weekly Breakdown
    elements.append(Paragraph("Evolución Semanal", h2_style))
    elements.append(Spacer(1, 12))
    
    week_data = [['Semana', 'Importe']]
    for w in stats['weekly_breakdown']:
        week_data.append([w['week'], f"{w['amount']:,.2f} €"])
        
    week_table = Table(week_data, colWidths=[200, 150])
    week_table.setStyle(TableStyle([
         ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
         ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
         ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
         ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
         ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(week_table)
    elements.append(Spacer(1, 48))
    
    # Footer
    elements.append(Paragraph(f"Generado automáticamante el {datetime.now().strftime('%d/%m/%Y %H:%M')}", normal_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
