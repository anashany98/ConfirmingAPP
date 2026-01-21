from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from pathlib import Path
from datetime import datetime

# Paths
output_path = Path(r"c:\Users\Usuari\Desktop\ConfirmingAPP\frontend\public\manual_usuario.pdf")
artifacts_dir = Path(r"C:\Users\Usuari\.gemini\antigravity\brain\c02dde17-478a-4309-86de-13d899f448aa")

# Screenshots
screenshots = {
    'dashboard': artifacts_dir / 'dashboard_overview_1766405463438.png',
    'upload': artifacts_dir / 'upload_page_dropzone_1766405833714.png',
    'calendar': artifacts_dir / 'calendar_page_1766405845481.png',
    'providers': artifacts_dir / 'providers_page_1766405855925.png',
    'history': artifacts_dir / 'history_page_batches_1766405886980.png',
    'settings': artifacts_dir / 'settings_smtp_config_1766405873828.png',
}

# Create PDF with better margins
doc = SimpleDocTemplate(
    str(output_path), 
    pagesize=A4,
    leftMargin=2*cm, 
    rightMargin=2*cm,
    topMargin=2.5*cm, 
    bottomMargin=2.5*cm
)

# Custom Styles with better spacing
styles = getSampleStyleSheet()

cover_title = ParagraphStyle(
    'CoverTitle',
    parent=styles['Heading1'],
    fontSize=32,
    textColor=colors.HexColor('#2563eb'),
    spaceAfter=25,
    spaceBefore=0,
    alignment=TA_CENTER,
    fontName='Helvetica-Bold',
    leading=40
)

cover_subtitle = ParagraphStyle(
    'CoverSubtitle',
    parent=styles['Normal'],
    fontSize=16,
    textColor=colors.HexColor('#64748b'),
    spaceAfter=35,
    spaceBefore=10,
    alignment=TA_CENTER,
    fontName='Helvetica',
    leading=20
)

section_title = ParagraphStyle(
    'SectionTitle',
    parent=styles['Heading1'],
    fontSize=20,
    textColor=colors.HexColor('#1e40af'),
    spaceBefore=25,
    spaceAfter=18,
    fontName='Helvetica-Bold',
    leading=24,
    backColor=colors.HexColor('#eff6ff'),
    borderPadding=10
)

subsection_title = ParagraphStyle(
    'SubsectionTitle',
    parent=styles['Heading2'],
    fontSize=14,
    textColor=colors.HexColor('#1e3a8a'),
    spaceBefore=18,
    spaceAfter=10,
    fontName='Helvetica-Bold',
    leading=18
)

body_text = ParagraphStyle(
    'BodyText',
    parent=styles['Normal'],
    fontSize=10,
    alignment=TA_JUSTIFY,
    spaceAfter=10,
    spaceBefore=2,
    leading=14,
    fontName='Helvetica'
)

bullet_style = ParagraphStyle(
    'Bullet',
    parent=styles['Normal'],
    fontSize=10,
    spaceAfter=6,
    spaceBefore=2,
    leftIndent=20,
    bulletIndent=10,
    fontName='Helvetica',
    leading=14
)

tip_style = ParagraphStyle(
    'Tip',
    parent=styles['Normal'],
    fontSize=9,
    textColor=colors.HexColor('#0369a1'),
    backColor=colors.HexColor('#e0f2fe'),
    borderWidth=1,
    borderColor=colors.HexColor('#0369a1'),
    borderPadding=8,
    spaceAfter=12,
    spaceBefore=8,
    fontName='Helvetica-Oblique',
    leading=13
)

# Story
story = []

# === COVER PAGE ===
story.append(Spacer(1, 2.5*cm))
story.append(Paragraph("📘 Manual de Usuario", cover_title))
story.append(Spacer(1, 0.3*cm))
story.append(Paragraph("ConfirmingAPP", cover_subtitle))
story.append(Spacer(1, 1*cm))

cover_data = [
    ['Gestión Inteligente de Confirming Empresarial'],
    [''],
    ['✓ Carga masiva de facturas'],
    ['✓ Validación automática'],
    ['✓ Notificaciones email'],
    ['✓ Informes PDF/Excel'],
]
cover_table = Table(cover_data, colWidths=[13*cm])
cover_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 12),
    ('FONTNAME', (0, 2), (-1, -1), 'Helvetica'),
    ('FONTSIZE', (0, 2), (-1, -1), 10),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ('TOPPADDING', (0, 0), (-1, -1), 10),
    ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
]))
story.append(cover_table)
story.append(Spacer(1, 2*cm))
story.append(Paragraph(f"Versión 1.0 • {datetime.now().strftime('%B %Y')}", body_text))
story.append(PageBreak())

# === SECTION 1: DASHBOARD ===
story.append(Paragraph("📊 Panel Principal", section_title))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "Centro de control financiero con visualización en tiempo real.",
    body_text
))
story.append(Spacer(1, 0.3*cm))

if screenshots['dashboard'].exists():
    img = Image(str(screenshots['dashboard']), width=14*cm, height=8.4*cm)
    story.append(img)
    story.append(Spacer(1, 0.4*cm))

story.append(Paragraph("Indicadores Principales:", subsection_title))
story.append(Paragraph("• <b>Remesas Procesadas:</b> Total de lotes creados", bullet_style))
story.append(Paragraph("• <b>Importe Total:</b> Suma acumulada procesada", bullet_style))
story.append(Paragraph("• <b>Incidencias:</b> Facturas con errores", bullet_style))
story.append(Spacer(1, 0.2*cm))

story.append(Paragraph(
    "💡 <b>Consejo:</b> Revisa 'Proyección de Pagos' semanalmente para planificar liquidez.",
    tip_style
))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Acciones:", subsection_title))
story.append(Paragraph("• <b>Excel:</b> Exporta datos completos", bullet_style))
story.append(Paragraph("• <b>Informe Mensual:</b> Genera PDF resumen", bullet_style))
story.append(PageBreak())

# === SECTION 2: UPLOAD ===
story.append(Paragraph("📤 Nueva Remesa", section_title))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "Crea remesas en 3 pasos: subir Excel, revisar y crear.",
    body_text
))
story.append(Spacer(1, 0.3*cm))

if screenshots['upload'].exists():
    img = Image(str(screenshots['upload']), width=14*cm, height=8.4*cm)
    story.append(img)
    story.append(Spacer(1, 0.4*cm))

story.append(Paragraph("Paso 1: Subir Archivo", subsection_title))
story.append(Paragraph("1. Arrastra Excel (.xlsx/.xls) o haz clic", bullet_style))
story.append(Paragraph("2. Formatos: Factusol o tabla plana", bullet_style))
story.append(Spacer(1, 0.2*cm))

story.append(Paragraph(
    "💡 <b>Columnas requeridas:</b> CIF, Nombre, IBAN, Importe, Nº Factura",
    tip_style
))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Paso 2: Validación", subsection_title))
story.append(Paragraph("• <b>IBAN:</b> Formato y dígitos de control", bullet_style))
story.append(Paragraph("• <b>Email:</b> Solicitud si falta", bullet_style))
story.append(Paragraph("• <b>Importes:</b> Validación numérica", bullet_style))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Paso 3: Crear", subsection_title))
story.append(Paragraph("1. Establece fecha de vencimiento", bullet_style))
story.append(Paragraph("2. Revisa tabla (status 🟢 VÁLIDO)", bullet_style))
story.append(Paragraph("3. Clic en 'Crear Remesa'", bullet_style))
story.append(PageBreak())

# === SECTION 3: CALENDAR ===
story.append(Paragraph("📅 Calendario de Pagos", section_title))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "Visualiza remesas por fecha de vencimiento.",
    body_text
))
story.append(Spacer(1, 0.3*cm))

if screenshots['calendar'].exists():
    img = Image(str(screenshots['calendar']), width=14*cm, height=8.4*cm)
    story.append(img)
    story.append(Spacer(1, 0.4*cm))

story.append(Paragraph("Uso del Calendario:", subsection_title))
story.append(Paragraph("• Navega con flechas ◀ ▶", bullet_style))
story.append(Paragraph("• Badge azul 🔵 = remesas ese día", bullet_style))
story.append(Paragraph("• Clic en día → detalle de remesas", bullet_style))
story.append(Spacer(1, 0.2*cm))

story.append(Paragraph(
    "💡 <b>Planificación:</b> Identifica días de alta carga y coordina con tu banco.",
    tip_style
))
story.append(PageBreak())

# === SECTION 4: PROVIDERS ===
story.append(Paragraph("👥 Proveedores", section_title))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "Base de datos centralizada con info bancaria.",
    body_text
))
story.append(Spacer(1, 0.3*cm))

if screenshots['providers'].exists():
    img = Image(str(screenshots['providers']), width=14*cm, height=8.4*cm)
    story.append(img)
    story.append(Spacer(1, 0.4*cm))

story.append(Paragraph("Funciones:", subsection_title))
story.append(Paragraph("• <b>Nuevo Proveedor:</b> Crear manualmente", bullet_style))
story.append(Paragraph("• <b>Importación:</b> Excel masivo", bullet_style))
story.append(Paragraph("• <b>Editar:</b> Icono ✏️", bullet_style))
story.append(Paragraph("• <b>Detalles:</b> Clic → historial", bullet_style))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Filtros:", subsection_title))
story.append(Paragraph("• Búsqueda por nombre/CIF", bullet_style))
story.append(Paragraph("• Filtro por país", bullet_style))
story.append(Paragraph("• Filtro 'Sin IBAN'", bullet_style))
story.append(PageBreak())

# === SECTION 5: HISTORY ===
story.append(Paragraph("📜 Histórico", section_title))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "Gestiona todas las remesas creadas.",
    body_text
))
story.append(Spacer(1, 0.3*cm))

if screenshots['history'].exists():
    img = Image(str(screenshots['history']), width=14*cm, height=8.4*cm)
    story.append(img)
    story.append(Spacer(1, 0.4*cm))

story.append(Paragraph("Acciones por Remesa:", subsection_title))
story.append(Paragraph("• <b>👁️ Detalles:</b> Modal con facturas", bullet_style))
story.append(Paragraph("• <b>📄 PDF:</b> Orden de pago oficial", bullet_style))
story.append(Paragraph("• <b>📊 Excel:</b> Exportar facturas", bullet_style))
story.append(Paragraph("• <b>🗑️ Eliminar:</b> Borrar remesa", bullet_style))
story.append(Spacer(1, 0.2*cm))

story.append(Paragraph(
    "💡 <b>Notificar:</b> En 'Detalles' → 'Notificar Proveedores' para enviar emails.",
    tip_style
))
story.append(PageBreak())

# === SECTION 6: SETTINGS ===
story.append(Paragraph("⚙️ Configuración", section_title))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "Configura servidor SMTP para emails.",
    body_text
))
story.append(Spacer(1, 0.3*cm))

if screenshots['settings'].exists():
    img = Image(str(screenshots['settings']), width=14*cm, height=8.4*cm)
    story.append(img)
    story.append(Spacer(1, 0.4*cm))

story.append(Paragraph("Config SMTP:", subsection_title))
story.append(Paragraph("1. Servidor: smtp.gmail.com / smtp-mail.outlook.com", bullet_style))
story.append(Paragraph("2. Puerto: 587 (STARTTLS) o 465 (SSL)", bullet_style))
story.append(Paragraph("3. Usuario: email completo", bullet_style))
story.append(Paragraph("4. Contraseña: de la cuenta", bullet_style))
story.append(Spacer(1, 0.2*cm))

story.append(Paragraph(
    "⚠️ <b>Gmail:</b> Usa 'Contraseña de Aplicación', no tu contraseña normal.",
    tip_style
))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "⚠️ <b>Office 365:</b> Habilita 'Authenticated SMTP' en Admin Center.",
    tip_style
))
story.append(PageBreak())

# === FAQ ===
story.append(Paragraph("❓ Preguntas Frecuentes", section_title))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Excel no se reconoce", subsection_title))
story.append(Paragraph(
    "Verifica columnas: CIF, Nombre, IBAN, Importe, Nº Factura.",
    body_text
))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Modificar remesa creada", subsection_title))
story.append(Paragraph(
    "Descarga Excel, modifica, crea nueva y elimina antigua.",
    body_text
))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Emails se envían inmediatamente", subsection_title))
story.append(Paragraph(
    "Sí, al clic en 'Notificar'. Puede tardar unos segundos.",
    body_text
))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Total sale 0,00 €", subsection_title))
story.append(Paragraph(
    "Bug corregido en v1.0.0. Actualiza a última versión.",
    body_text
))
story.append(Spacer(1, 2*cm))

# === FOOTER ===
footer_data = [
    ['ConfirmingAPP - Versión 1.0.0'],
    [f'{datetime.now().strftime("%d/%m/%Y")}'],
]
footer_table = Table(footer_data, colWidths=[13*cm])
footer_table.setStyle(TableStyle([
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
    ('FONTSIZE', (0, 0), (-1, -1), 8),
    ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#64748b')),
    ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#cbd5e1')),
    ('TOPPADDING', (0, 0), (-1, 0), 8),
]))
story.append(footer_table)

# Build PDF
print("🎨 Generando manual (versión mejorada)...")
doc.build(story)
print(f"✅ PDF creado: {output_path}")
print(f"📏 Tamaño: {output_path.stat().st_size / 1024:.1f} KB")
