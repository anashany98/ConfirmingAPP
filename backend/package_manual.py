import os
import re
import zipfile
from pathlib import Path

# Paths
ARTIFACTS_DIR = Path(r"C:\Users\Usuari\.gemini\antigravity\brain\91133883-0f75-49b1-96f5-40775d6d2ba8")
PUBLIC_DIR = Path(r"c:\Users\Usuari\Desktop\ConfirmingAPP\frontend\public")
MANUAL_SRC = ARTIFACTS_DIR / "user_manual.md"
ZIP_NAME = "manual_usuario.zip"
ZIP_PATH = PUBLIC_DIR / ZIP_NAME

def package_manual():
    if not MANUAL_SRC.exists():
        print(f"Error: Manual not found at {MANUAL_SRC}")
        return

    # Create public dir if not exists
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    # Read Manual
    with open(MANUAL_SRC, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all images
    # Image pattern: ![Alt](Path)
    # The paths in MD are absolute windows paths C:/...
    
    images = []
    
    def replace_image(match):
        full_path = match.group(1)
        # Handle Windows paths quirks in MD (forward slashes)
        # The file content has C:/...
        # We want to change it to local relative path: "images/filename.png"
        
        # Clean path
        clean_path = full_path.replace("file:///", "").replace("file://", "")
        # If it starts with /C:/, remove leading slash
        if clean_path.startswith("/") and clean_path[2] == ":":
             clean_path = clean_path[1:]
             
        p = Path(clean_path)
        if p.exists():
            images.append(p)
            return f"![{match.group(1)}] (images/{p.name})"
        else:
            print(f"Warning: Image not found {clean_path}")
            return match.group(0)

    # We need to be careful with regex replacement to only change the path part
    # Pattern: ![alt](path)
    # Group 1: path
    
    # Simpler approach: find unique paths first
    img_pattern = re.compile(r'!\[.*?\]\((.*?)\)')
    found_paths = img_pattern.findall(content)
    
    file_map = {} # old_path -> new_filename
    
    new_content = content
    
    for ipath in found_paths:
        # Determine actual file path
        # Assuming format C:/... or /C:/...
        clean_path = ipath
        if clean_path.startswith("/") and len(clean_path) > 2 and clean_path[2] == ":":
             clean_path = clean_path[1:]
        
        p = Path(clean_path)
        if p.exists():
            new_filename = p.name
            file_map[clean_path] = new_filename
            # Replace in content: use simpler replacement to avoid regex complexity with special chars
            new_content = new_content.replace(ipath, f"images/{new_filename}")
        else:
             print(f"Skipping missing image: {ipath}")

    # Create temporary modified MD
    temp_md = ARTIFACTS_DIR / "user_manual_packaged.md"
    with open(temp_md, 'w', encoding='utf-8') as f:
        f.write(new_content)

    # Create Zip
    print(f"Creating zip {ZIP_PATH}...")
    with zipfile.ZipFile(ZIP_PATH, 'w') as zf:
        # Write MD
        zf.write(temp_md, arcname="manual_usuario.md")
        
        # Write Images
        for original_path, filename in file_map.items():
            zf.write(original_path, arcname=f"images/{filename}")

    # Cleanup
    if temp_md.exists():
        os.remove(temp_md)
        
    print(f"Success! Manual packaged at {ZIP_PATH}")

if __name__ == "__main__":
    package_manual()
