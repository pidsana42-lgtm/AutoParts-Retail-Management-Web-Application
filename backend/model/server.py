import sys
import os
import json
import re
import traceback
from contextlib import asynccontextmanager
from PIL import Image
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
import requests
from io import BytesIO

# Parse environment variables manually (matching main.py)
def load_env():
    # If running from backend/model, .env might be in parent directory
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
HF_TOKEN = os.getenv("HF_TOKEN", "")

# Global variables for model and processor
model = None
processor = None
device = None

def extract_mock_data(image_path_or_url):
    """
    Returns realistic mock invoice structured data (matching main.py).
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load model once if not in Mock Mode
    global model, processor, device
    print(f"Starting OCR Service (Mock Mode: {MOCK_MODE})")
    
    if not MOCK_MODE:
        try:
            import torch
            from transformers import AutoProcessor, AutoModelForCausalLM
            
            if torch.backends.mps.is_available():
                device = torch.device("mps")
            elif torch.cuda.is_available():
                device = torch.device("cuda")
            else:
                device = torch.device("cpu")
                
            model_id = "Phonsiri/Gemma-4-E4B-it-PARL"
            print(f"Loading Gemma model {model_id} on {device}...")
            
            processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True, token=HF_TOKEN)
            model = AutoModelForCausalLM.from_pretrained(
                model_id,
                torch_dtype=torch.float16 if device.type != "cpu" else torch.float32,
                trust_remote_code=True,
                token=HF_TOKEN
            ).to(device)
            print("Model loaded successfully.")
        except Exception as e:
            print(f"Error loading model: {e}. Falling back to Mock Mode for safety.")
            traceback.print_exc()
    
    yield
    # Shutdown: Clean up if needed
    print("Shutting down OCR Service")

app = FastAPI(
    title="AutoParts OCR & AI Agent API",
    description="FastAPI service for invoice OCR parsing and AI Agent reasoning",
    version="1.0.0",
    lifespan=lifespan
)

class ExtractRequest(BaseModel):
    file_path: str

def perform_ocr(img, image_name_for_mock="image.jpg"):
    if MOCK_MODE or model is None:
        return extract_mock_data(image_name_for_mock)
        
    try:
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

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": img},
                    {"type": "text", "text": prompt}
                ]
            }
        ]
        
        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = processor(images=img, text=text, return_tensors="pt").to(device)
        
        import torch
        with torch.no_grad():
            output_ids = model.generate(**inputs, max_new_tokens=2048)
            
        generated_text = processor.decode(output_ids[0], skip_special_tokens=True)
        
        json_match = re.search(r"(\{.*\})", generated_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
            parsed_json = json.loads(json_str)
            parsed_json["ocr_text"] = generated_text
            return parsed_json
        else:
            return {
                "error": "Failed to parse JSON from model output",
                "raw_output": generated_text
            }
    except Exception as e:
        tb = traceback.format_exc()
        mock_data = extract_mock_data(image_name_for_mock)
        mock_data["ocr_text"] = f"--- OCR EXECUTION FALLBACK (MOCK DATA GENERATED) ---\nError Detail:\n{tb}\n\n" + mock_data["ocr_text"]
        return mock_data

@app.post("/api/extract-invoice")
def extract_invoice_from_path(request: ExtractRequest):
    """
    Extracts invoice information from a local file path or web URL.
    """
    image_path = request.file_path
    
    # Try opening the image from URL or local path
    try:
        if image_path.startswith("http://") or image_path.startswith("https://"):
            response = requests.get(image_path, timeout=30)
            img = Image.open(BytesIO(response.content))
        else:
            # Handle relative pathing differences if started from different working dirs
            resolved_path = image_path
            if not os.path.exists(resolved_path):
                # Try parent directories if not found (e.g., if API is run from model/ folder)
                parent_path = os.path.join("..", image_path)
                if os.path.exists(parent_path):
                    resolved_path = parent_path
            
            if not os.path.exists(resolved_path):
                raise HTTPException(status_code=400, detail=f"File not found: {image_path}")
                
            img = Image.open(resolved_path)
            
        result = perform_ocr(img, image_name_for_mock=image_path)
        return result
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")

@app.post("/api/extract-invoice/upload")
async def extract_invoice_from_upload(file: UploadFile = File(...)):
    """
    Extracts invoice information from an uploaded multipart image file.
    """
    try:
        contents = await file.read()
        img = Image.open(BytesIO(contents))
        result = perform_ocr(img, image_name_for_mock=file.filename)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process uploaded file: {str(e)}")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "mock_mode": MOCK_MODE,
        "model_loaded": model is not None,
        "device": str(device) if device else "none"
    }

if __name__ == "__main__":
    import uvicorn
    # Start the server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
