import barcode
from barcode.writer import ImageWriter
import os
import re

def generate_barcode(prod_id: int, wms_code: str, output_dir: str) -> str:
    """
    Generates a Code 128 barcode image for the given product details.
    Saves the barcode PNG under the output_dir using the filename format:
    prod_[PaddedID]_[SanitizedCode].png
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Sanitize product code for filename
    # Keep only alphanumeric characters, underscores, and dashes
    sanitized_code = re.sub(r'[^a-zA-Z0-9_\-]', '-', wms_code)
    sanitized_code = re.sub(r'-+', '-', sanitized_code).strip('-')
    
    padded_id = f"{prod_id:06d}"
    if not sanitized_code:
        sanitized_code = f"PROD-{padded_id}"
        
    filename_base = f"prod_{padded_id}_{sanitized_code}"
    
    # 2. Barcode text to encode (Code 128 standard ASCII)
    bar_code_text = wms_code.strip() if wms_code.strip() else f"PROD{padded_id}"
    bar_code_text = re.sub(r'[^a-zA-Z0-9_\-\.\/ ]', '', bar_code_text)
    
    # 3. Generate Code 128 barcode and save as PNG
    CODE128 = barcode.get_barcode_class('code128')
    bar = CODE128(bar_code_text, writer=ImageWriter())
    bar_filepath = os.path.join(output_dir, filename_base)
    
    # python-barcode automatically appends .png extension
    saved_path = bar.save(bar_filepath)
    return saved_path
