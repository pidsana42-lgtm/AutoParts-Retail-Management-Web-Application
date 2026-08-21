import os
import re
import json
import qrcode

def generate_qrcode(prod_id: int, wms_code: str, payload_data: dict, output_dir: str) -> str:
    """
    Generates a QR Code image for the given product details.
    Saves the QR Code PNG under the output_dir using the filename format:
    prod_[PaddedID]_[SanitizedCode]_qr.png
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Sanitize product code for filename
    sanitized_code = re.sub(r'[^a-zA-Z0-9_\-]', '-', wms_code)
    sanitized_code = re.sub(r'-+', '-', sanitized_code).strip('-')
    
    padded_id = f"{prod_id:06d}"
    if not sanitized_code:
        sanitized_code = f"PROD-{padded_id}"
        
    # Append _qr to distinguish from barcode
    filename = f"prod_{padded_id}_{sanitized_code}_qr.png"
    qr_filepath = os.path.join(output_dir, filename)
    
    # 2. QR Code text to encode
    # If payload_data is provided (like JSON info or URL), use it.
    # Otherwise fallback to just the product code.
    if payload_data:
        if isinstance(payload_data, dict):
            qr_text = json.dumps(payload_data, ensure_ascii=False)
        else:
            qr_text = str(payload_data)
    else:
        qr_text = wms_code.strip() if wms_code.strip() else f"PROD{padded_id}"
    
    # 3. Generate QR Code and save as PNG
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_text)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(qr_filepath)
    
    return qr_filepath
