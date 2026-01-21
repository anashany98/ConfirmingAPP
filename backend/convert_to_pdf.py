import markdown
from xhtml2pdf import pisa
import re
from pathlib import Path
import sys
import base64

# Paths
ARTIFACTS_DIR = Path(r"C:\Users\Usuari\.gemini\antigravity\brain\91133883-0f75-49b1-96f5-40775d6d2ba8")
MANUAL_SRC = ARTIFACTS_DIR / "user_manual.md"
PUBLIC_DIR = Path(r"c:\Users\Usuari\Desktop\ConfirmingAPP\frontend\public")
PDF_DEST = PUBLIC_DIR / "manual_usuario.pdf"

CSS = """
<style>
    @page { size: A4; margin: 2cm; }
    body { font-family: Helvetica, sans-serif; font-size: 10pt; line-height: 1.5; }
    h1 { color: #f97316; font-size: 24pt; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-top: 0; }
    h2 { color: #2c3e50; font-size: 18pt; margin-top: 25px; border-bottom: 1px solid #eee; }
    img { max-width: 100%; height: auto; margin: 15px 0; border: 1px solid #ddd; }
    code { background-color: #f5f5f5; font-family: monospace; }
</style>
"""

def image_to_base64(path_str):
    # path_str might be "C:/Users..." or "/C:/Users..." or "file:///C:/..."
    cleaned_path = path_str.replace("file:///", "").replace("file://", "")
    if cleaned_path.startswith("/") and ":" in cleaned_path:
        cleaned_path = cleaned_path[1:] # Remove leading / if standard windows path
        
    p = Path(cleaned_path)
    if not p.exists():
        print(f"Warning: Image not found: {p}")
        return None
        
    with open(p, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        return f"data:image/png;base64,{encoded_string}"

def convert_md_to_pdf():
    print(f"Reading from: {MANUAL_SRC}")
    if not MANUAL_SRC.exists():
        print("Error: Manual not found")
        sys.exit(1)

    with open(MANUAL_SRC, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Pre-process: Remove carousel artifacts
    md_content = re.sub(r'````carousel', '', md_content)
    md_content = re.sub(r'````', '', md_content)

    # Embed Images as Base64
    def repl_img(match):
        alt = match.group(1)
        path = match.group(2)
        
        # Clean up path
        path = path.replace('"', '').replace("'", "").strip()
        
        base64_src = image_to_base64(path)
        if base64_src:
            return f'<img src="{base64_src}" alt="{alt}" />'
        else:
            return f'<p>[Image missing: {alt}]</p>'

    md_content = re.sub(r'!\[(.*?)\]\((.*?)\)', repl_img, md_content)

    # Convert remaining Markdown to HTML
    html_body = markdown.markdown(md_content, extensions=['tables', 'fenced_code'])

    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        {CSS}
    </head>
    <body>
        {html_body}
    </body>
    </html>
    """

    print(f"Writing PDF to: {PDF_DEST}")
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(PDF_DEST, "wb") as result_file:
        pisa_status = pisa.CreatePDF(
            src=full_html,
            dest=result_file,
            encoding='utf-8'
        )

    if pisa_status.err:
        print(f"Error generating PDF: {pisa_status.err}")
    else:
        print("PDF generated successfully!")

if __name__ == "__main__":
    convert_md_to_pdf()
