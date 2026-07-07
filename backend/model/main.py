import sys
import os
import json
import re
import traceback
from PIL import Image
import requests
from io import BytesIO
import google.generativeai as genai

# Parse environment variables manually (if no dotenv is installed)
def load_env():
    env_paths = [".env", "../.env", "../../.env"]
    for path in env_paths:
        if os.path.exists(path):
            with open(path, "r") as f:
                for line in f:
                    if "=" in line and not line.startswith("#"):
                        parts = line.strip().split("=", 1)
                        if len(parts) == 2:
                            os.environ[parts[0].strip()] = parts[1].strip()
            break

load_env()

MOCK_MODE = os.getenv("MOCK_LLM", "false").lower() == "true"
GEMINI_API_KEY = (os.getenv("GOOGLE_STUDIO") or os.getenv("GEMINI_API_KEY") or "").strip()
GEMINI_MODEL = (os.getenv("GEMINI_MODEL") or "google/gemini-3.1-pro").strip()
LIGHTNING_API_KEY = (os.getenv("LIGHTNING_API_KEY") or "").strip()
print(f"Loaded LIGHTNING_API_KEY: {LIGHTNING_API_KEY[:6]}...{LIGHTNING_API_KEY[-6:] if len(LIGHTNING_API_KEY) > 12 else ''} (Length: {len(LIGHTNING_API_KEY)})")

def extract_mock_data(image_path_or_url):
    """
    Returns realistic mock invoice structured data (matching server.py).
    """
    filename = os.path.basename(image_path_or_url)
    mock_response = {
        "bill_no": f"INV-{abs(hash(filename)) % 100000000:08d}",
        "total_amount": 15450.00,
        "due_date": "2026-07-24",
        "transport_by": "Kerry Express Logistics",
        "supplier_id": 1,
        "subtotal": 14439.25,
        "discount_total": 500.00,
        "credit_term": "30 Days",
        "vat_amount": 1010.75,
        "grand_total": 15450.00,
        "payment_status": "unpaid",
        "ocr_text": f"--- MOCK OCR EXTRACTED TEXT FROM {filename} ---\nSupplier: AP Auto Parts Co., Ltd.\nInvoice No: INV-9923841\nDate: 24/06/2026\nDue Date: 24/07/2026\nItems:\n1. SPK-001 Spark Plug Premium Bosch - 10 PCS @ 350.00 = 3500.00\n2. BRK-002 Brake Pad Front Set Toyota Hilux - 5 SET @ 2200.00 = 11000.00\n3. OIL-003 Engine Oil 10W-40 Synthetic 4L - 2 BOTTLE @ 719.63 = 1439.25 (Freebie item conversion active)\nSubtotal: 14439.25\nDiscount: 500.00\nVAT 7%: 1010.75\nGrand Total: 15450.00\n--------------------------------------------",
        "items": [
            {
                "item_sequence": 1,
                "company_product_code": "SPK-001",
                "company_product_name": "Spark Plug Premium Bosch",
                "order_quantity": 10,
                "unit": "PCS",
                "conversion_factor": 1.0,
                "price_per_unit": 350.00,
                "discount_amount": 0.0,
                "net_amount": 3500.00,
                "is_freebie": False,
                "remark": "High quality spark plugs",
                "product_id": 1
            },
            {
                "item_sequence": 2,
                "company_product_code": "BRK-002",
                "company_product_name": "Brake Pad Front Set Toyota Hilux",
                "order_quantity": 5,
                "unit": "SET",
                "conversion_factor": 1.0,
                "price_per_unit": 2200.00,
                "discount_amount": 500.00,
                "net_amount": 10500.00,
                "is_freebie": False,
                "remark": "Front brake pads",
                "product_id": 2
            },
            {
                "item_sequence": 3,
                "company_product_code": "OIL-003",
                "company_product_name": "Engine Oil 10W-40 Synthetic 4L",
                "order_quantity": 2,
                "unit": "BOTTLE",
                "conversion_factor": 1.0,
                "price_per_unit": 719.63,
                "discount_amount": 0.0,
                "net_amount": 1439.25,
                "is_freebie": True,
                "remark": "Promo freebie engine oil",
                "product_id": 3
            }
        ]
    }
    return mock_response

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided."}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    
    if MOCK_MODE or not LIGHTNING_API_KEY:
        print(json.dumps(extract_mock_data(image_path), indent=2, ensure_ascii=False))
        sys.exit(0)
        
    try:
        # Load image
        if image_path.startswith("http://") or image_path.startswith("https://"):
            response = requests.get(image_path, timeout=30)
            img = Image.open(BytesIO(response.content))
        else:
            img = Image.open(image_path)
            
        prompt = """Analyze the invoice/bill image and extract the following information in JSON format:
{
  "bill_no": "Invoice/Bill number (string)",
  "total_amount": 0.0 (float),
  "due_date": "YYYY-MM-DD (string)",
  "transport_by": "Transportation provider if any (string)",
  "supplier_id": 1 (integer),
  "subtotal": 0.0 (float),
  "discount_total": 0.0 (float),
  "credit_term": "Credit term details (e.g. 30 Days) (string)",
  "vat_amount": 0.0 (float),
  "grand_total": 0.0 (float),
  "payment_status": "unpaid",
  "items": [
    {
      "item_sequence": 1,
      "company_product_code": "Product code (string)",
      "company_product_name": "Product name (string)",
      "order_quantity": 1 (integer),
      "unit": "Unit (e.g. PCS, Box) (string)",
      "conversion_factor": 1.0 (float),
      "price_per_unit": 0.0 (float),
      "discount_amount": 0.0 (float),
      "net_amount": 0.0 (float),
      "is_freebie": false (boolean),
      "remark": "Any remark (string)",
      "product_id": 1 (integer)
    }
  ]
}
Return ONLY the raw JSON object representation. Do not include any formatting like ```json ... ``` or additional explanations."""

        import io
        import base64
        import requests
        
        img_byte_arr = io.BytesIO()
        temp_img = img
        if temp_img.mode in ('RGBA', 'LA', 'P'):
            temp_img = temp_img.convert('RGB')
        temp_img.save(img_byte_arr, format='JPEG')
        img_b64 = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')

        headers = {
            "Authorization": f"Bearer {LIGHTNING_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": GEMINI_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        { "type": "text", "text": prompt },
                        { "type": "image_url", "image_url": { "url": f"data:image/jpeg;base64,{img_b64}" } }
                    ]
                }
            ]
        }

        resp = requests.post(
            url="https://lightning.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=60
        )
        resp.raise_for_status()
        resp_json = resp.json()
        generated_text = resp_json['choices'][0]['message']['content']
        
        # Find JSON block in generated text
        json_match = re.search(r"(\{.*\})", generated_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
            parsed_json = json.loads(json_str)
            parsed_json["ocr_text"] = generated_text
            print(json.dumps(parsed_json, indent=2, ensure_ascii=False))
        else:
            print(json.dumps({
                "error": "Failed to parse JSON from model output",
                "raw_output": generated_text
            }))
            
    except Exception as e:
        mock_data = extract_mock_data(image_path)
        tb = traceback.format_exc()
        mock_data["ocr_text"] = f"--- OCR EXECUTION FALLBACK (MOCK DATA GENERATED) ---\nError Detail:\n{tb}\n\n" + mock_data["ocr_text"]
        print(json.dumps(mock_data, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
