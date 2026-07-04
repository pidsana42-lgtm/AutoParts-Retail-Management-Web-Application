import sys
import os
import json
import re
import traceback
from contextlib import asynccontextmanager
from PIL import Image
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from io import BytesIO
from sqlalchemy import create_engine, text
import google.generativeai as genai

# Parse environment variables manually (matching main.py)
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
# Retrieve API key (check GOOGLE_STUDIO first, and strip any leading/trailing spaces)
GEMINI_API_KEY = (os.getenv("GOOGLE_STUDIO") or os.getenv("GEMINI_API_KEY") or "").strip()
GEMINI_MODEL = (os.getenv("GEMINI_MODEL") or "google/gemini-3.1-pro").strip()
LIGHTNING_API_KEY = (os.getenv("LIGHTNING_API_KEY") or "").strip()
print(f"Loaded LIGHTNING_API_KEY: {LIGHTNING_API_KEY[:6]}...{LIGHTNING_API_KEY[-6:] if len(LIGHTNING_API_KEY) > 12 else ''} (Length: {len(LIGHTNING_API_KEY)})")

# Global variables
engine = None
global_matcher = None

def init_db():
    global engine
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "1234")
    db_name = os.getenv("DB_NAME", "Autopartsdb")
    
    url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    try:
        print(f"Connecting to database at {db_host}:{db_port}/{db_name}...")
        engine = create_engine(url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            print("Database connected successfully!")
            
            # Sync sequences and create product_mapping_corrections table
            try:
                with engine.begin() as transaction_conn:
                    # Check if supplier_id column exists
                    table_exists = transaction_conn.execute(text("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_name = 'product_mapping_corrections'
                        );
                    """)).fetchone()[0]
                    
                    has_supplier_id = False
                    if table_exists:
                        has_supplier_id = transaction_conn.execute(text("""
                            SELECT EXISTS (
                                SELECT FROM information_schema.columns 
                                WHERE table_name = 'product_mapping_corrections' AND column_name = 'supplier_id'
                            );
                        """)).fetchone()[0]
                    
                    if table_exists and not has_supplier_id:
                        # Drop old table to migrate to new supplier-aware schema
                        transaction_conn.execute(text("DROP TABLE IF EXISTS product_mapping_corrections;"))
                        
                    # Create corrections table with supplier_id and updated unique constraint
                    transaction_conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS product_mapping_corrections (
                            id SERIAL PRIMARY KEY,
                            supplier_id INTEGER NOT NULL DEFAULT 1,
                            ai_product_name VARCHAR(255) NOT NULL,
                            ai_product_code VARCHAR(255) NOT NULL DEFAULT '',
                            user_product_name VARCHAR(255) NOT NULL,
                            user_product_code VARCHAR(255) NOT NULL DEFAULT '',
                            product_id INTEGER NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT uq_supplier_ai_name_code UNIQUE (supplier_id, ai_product_name, ai_product_code)
                        );
                    """))
                    
                    transaction_conn.execute(text("SELECT setval(pg_get_serial_sequence('bill_images', 'id'), COALESCE(MAX(id), 1)) FROM bill_images;"))
                    transaction_conn.execute(text("SELECT setval(pg_get_serial_sequence('bill_import_jobs', 'id'), COALESCE(MAX(id), 1)) FROM bill_import_jobs;"))
                    print("Database migrated and sequences synchronized successfully!")
            except Exception as seq_err:
                print(f"Warning: Could not run migrations or sync database sequences: {seq_err}")
    except Exception as e:
        print(f"Database connection failed: {e}")
        engine = None

def save_result_to_db(file_path, result, job_id=None):
    if engine is None:
        print("Database connection not available. Skipping DB save.")
        return None
        
    draft_json_str = json.dumps(result, ensure_ascii=False)
    ocr_text = result.get("ocr_text", "")
    error_msg = result.get("error", None)
    status = "failed" if error_msg else "processed"
    
    try:
        with engine.begin() as conn:
            if job_id:
                # Update existing job record from Go backend
                query = text("""
                    UPDATE bill_import_jobs 
                    SET status = :status, 
                        draft_json = :draft_json, 
                        raw_model_output = :raw_model_output, 
                        error_message = :error_message,
                        updated_at = NOW()
                    WHERE id = :job_id
                """)
                conn.execute(query, {
                    "status": status,
                    "draft_json": draft_json_str,
                    "raw_model_output": ocr_text,
                    "error_message": error_msg,
                    "job_id": job_id
                })
                print(f"DB Update: Successfully updated Job ID {job_id}")
                return job_id
            else:
                # Insert a brand new job record (e.g. testing directly from FastAPI Swagger UI)
                query = text("""
                    INSERT INTO bill_import_jobs (
                        file_url, file_type, status, draft_json, 
                        raw_model_output, error_message, created_by, 
                        created_at, updated_at
                    ) VALUES (
                        :file_url, 'invoice', :status, :draft_json, 
                        :raw_model_output, :error_message, 1, 
                        NOW(), NOW()
                    ) RETURNING id
                """)
                res = conn.execute(query, {
                    "file_url": file_path,
                    "status": status,
                    "draft_json": draft_json_str,
                    "raw_model_output": ocr_text,
                    "error_message": error_msg
                })
                new_id = res.fetchone()[0]
                print(f"DB Insert: Successfully created new Job ID {new_id}")
                return new_id
    except Exception as e:
        print(f"DB Error while saving: {e}")
        traceback.print_exc()
        return None

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
    # Startup: Load DB and configure Gemini API
    print(f"Starting OCR Service (Mock Mode: {MOCK_MODE})")
    
    # Initialize DB connection
    init_db()
    
    # Pre-initialize ProductMatcher to avoid cold-start delays on first request
    global global_matcher
    try:
        print("Pre-loading Product Matcher engine (active learning registry)...")
        from embedder import ProductMatcher
        global_matcher = ProductMatcher()
        print("Product Matcher pre-loaded successfully!")
    except Exception as pm_err:
        print(f"Warning: Could not pre-load ProductMatcher: {pm_err}")
    
    if not MOCK_MODE:
        if not GEMINI_API_KEY:
            print("Warning: GOOGLE_STUDIO (or GEMINI_API_KEY) is not set in .env! Running in Mock Mode.")
        else:
            try:
                print(f"Configuring Gemini API (Model: {GEMINI_MODEL})...")
                genai.configure(api_key=GEMINI_API_KEY)
                print("Gemini API configured successfully.")
            except Exception as e:
                print(f"Error configuring Gemini API: {e}")
                traceback.print_exc()
    
    yield
    print("Shutting down OCR Service")

app = FastAPI(
    title="AutoParts OCR & AI Agent API",
    description="FastAPI service for invoice OCR parsing using Gemini API and AI Agent reasoning",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExtractRequest(BaseModel):
    file_path: str
    job_id: int = None

def perform_ocr(img, image_name_for_mock="image.jpg"):
    if MOCK_MODE or not LIGHTNING_API_KEY:
        print("Mock Mode active or LIGHTNING_API_KEY missing. Returning mock data.")
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

        print(f"Calling Lightning AI completions with model {GEMINI_MODEL}...")
        resp = requests.post(
            url="https://lightning.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=60
        )
        resp.raise_for_status()
        resp_json = resp.json()
        generated_text = resp_json['choices'][0]['message']['content']
        
        # Extract JSON from response
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

def match_bill_products(result):
    """
    Uses the ProductMatcher class (embeddinggemma-300m-ONNX) to map OCR extracted items
    to active system products from the products table, leveraging active learning.
    """
    if "items" not in result or not result["items"]:
        return result
        
    try:
        # 1. Fetch active products and user mapping corrections from DB
        db_products = []
        corrections = []
        if engine is not None:
            with engine.connect() as conn:
                # Get base products
                query = text("SELECT id, product_name, product_code FROM products WHERE is_active = true")
                rows = conn.execute(query).fetchall()
                for r in rows:
                    db_products.append({
                        "id": r[0],
                        "product_name": r[1],
                        "product_code": r[2]
                    })
                
                # Get corrections
                try:
                    supplier_id = int(result.get("supplier_id") or 1)
                    corr_query = text("SELECT ai_product_name, ai_product_code, product_id FROM product_mapping_corrections WHERE supplier_id = :supplier_id")
                    corr_rows = conn.execute(corr_query, {"supplier_id": supplier_id}).fetchall()
                    for cr in corr_rows:
                        corrections.append({
                            "company_product_name": cr[0],
                            "company_product_code": cr[1],
                            "product_id": cr[2]
                        })
                except Exception as ex:
                    print(f"Could not load mapping corrections: {ex}")
        
        if not db_products:
            print("[Matcher] No active products in database. Skipping vector matching.")
            # Set default product_id = None for items
            for item in result["items"]:
                item["product_id"] = None
            return result
            
        # 2. Fit pre-loaded global matcher with both base products and corrections
        global global_matcher
        if global_matcher is None:
            from embedder import ProductMatcher
            global_matcher = ProductMatcher()
        global_matcher.fit(db_products, corrections)
        
        # 3. Match each item using global_matcher
        for item in result["items"]:
            comp_name = item.get("company_product_name", "")
            comp_code = item.get("company_product_code", "")
            
            # Match
            matched_id, score = global_matcher.match_product(comp_name, comp_code, threshold=0.90)
            if matched_id:
                item["product_id"] = matched_id
                print(f"[Matcher] Auto-mapped: '{comp_name}' -> DB Product ID {matched_id} (Similarity: {score:.4f})")
            else:
                item["product_id"] = None
                print(f"[Matcher] Unmapped: '{comp_name}' (Best Similarity: {score:.4f})")
                
    except Exception as e:
        print(f"Error during vector product matching: {e}")
        traceback.print_exc()
        # Ensure fallback product_id is None if matching fails
        for item in result.get("items", []):
            if "product_id" not in item:
                item["product_id"] = None
                
    return result

@app.post("/api/extract-invoice")
def extract_invoice_from_path(request: ExtractRequest):
    """
    Extracts invoice information from a local file path or web URL, and saves to database.
    """
    image_path = request.file_path
    job_id = request.job_id
    
    try:
        if image_path.startswith("http://") or image_path.startswith("https://"):
            response = requests.get(image_path, timeout=30)
            img = Image.open(BytesIO(response.content))
        else:
            resolved_path = image_path
            if not os.path.exists(resolved_path):
                parent_path = os.path.join("..", image_path)
                if os.path.exists(parent_path):
                    resolved_path = parent_path
            
            if not os.path.exists(resolved_path):
                error_response = {"error": f"File not found: {image_path}"}
                save_result_to_db(image_path, error_response, job_id)
                raise HTTPException(status_code=400, detail=f"File not found: {image_path}")
                
            img = Image.open(resolved_path)
            
        result = perform_ocr(img, image_name_for_mock=image_path)
        # Perform local vector product matching
        result = match_bill_products(result)
        
        saved_id = save_result_to_db(image_path, result, job_id)
        if saved_id:
            result["db_job_id"] = saved_id
            
        return result
        
    except HTTPException as he:
        raise he
    except Exception as e:
        error_response = {"error": f"Failed to process image: {str(e)}"}
        save_result_to_db(image_path, error_response, job_id)
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")

@app.post("/api/extract-invoice/upload")
async def extract_invoice_from_upload(file: UploadFile = File(...), job_id: int = Query(None)):
    """
    Extracts invoice information from an uploaded multipart image file, and saves to database.
    """
    import time
    try:
        contents = await file.read()
        img = Image.open(BytesIO(contents))
        result = perform_ocr(img, image_name_for_mock=file.filename)
        # Perform local vector product matching
        result = match_bill_products(result)
        
        # Save image file to backend/uploads/ folder on the host
        uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
        os.makedirs(uploads_dir, exist_ok=True)
        
        safe_filename = f"{int(time.time())}_{file.filename}"
        file_path = os.path.join(uploads_dir, safe_filename)
        with open(file_path, "wb") as f:
            f.write(contents)
            
        # Create a database record in bill_images table
        bill_image_id = None
        if engine is not None:
            try:
                with engine.begin() as conn:
                    query = text("""
                        INSERT INTO bill_images (image_url, created_at, updated_at)
                        VALUES (:image_url, NOW(), NOW())
                        RETURNING id
                    """)
                    res = conn.execute(query, {"image_url": f"uploads/{safe_filename}"})
                    bill_image_id = res.fetchone()[0]
                    print(f"Created bill_image record ID: {bill_image_id}")
            except Exception as e:
                print(f"Failed to create bill image record: {e}")
                
        saved_id = save_result_to_db(f"uploads/{safe_filename}", result, job_id)
        if saved_id:
            result["db_job_id"] = saved_id
            
        if bill_image_id:
            result["bill_image_id"] = bill_image_id
            
        return result
    except Exception as e:
        error_response = {"error": f"Failed to process uploaded file: {str(e)}"}
        save_result_to_db(file.filename, error_response, job_id)
        raise HTTPException(status_code=500, detail=f"Failed to process uploaded file: {str(e)}")

class AgentRequest(BaseModel):
    query: str
    line_user_id: str = None

@app.post("/api/agent")
def ask_agent(request: AgentRequest):
    """
    Exposes the AI database agent query service to Go backend via HTTP REST endpoint.
    """
    from agent import run_agent
    try:
        response = run_agent(request.query, request.line_user_id)
        return {"response": response}
    except Exception as e:
        tb = traceback.format_exc()
        print(f"Agent error: {e}\n{tb}")
        raise HTTPException(status_code=500, detail=str(e))

class GenerateCodesRequest(BaseModel):
    product_ids: list[int]

def sanitize_filename(name: str) -> str:
    import re
    # Keep only alphanumeric characters, underscores, and dashes
    s = re.sub(r'[^a-zA-Z0-9_\-]', '-', name)
    s = re.sub(r'-+', '-', s)
    return s.strip('-')

@app.post("/api/products/generate-codes")
def generate_product_codes(request: GenerateCodesRequest):
    """
    Query products table by ID to get the real internal WMS product code.
    Generates Barcode (Code 128) using these internal values,
    and saves them under the backend/barcode folder using generator.py.
    """
    import os
    import sys
    
    # Add backend root to path to allow importing from barcode package
    backend_root = "/Users/phonsirithabunsri/Desktop/AutoParts-Retail-Management-Web-Application/backend"
    if backend_root not in sys.path:
        sys.path.append(backend_root)
        
    try:
        from barcode_generator import generate_barcode
    except ImportError as e:
        print(f"Error importing barcode generator: {e}")
        raise HTTPException(status_code=500, detail=f"Barcode module import error: {e}")

    BARCODE_DIR = os.path.join(backend_root, "barcode")
    generated = []
    
    with engine.connect() as conn:
        for prod_id in request.product_ids:
            try:
                # Query the actual internal WMS product code (source of truth)
                query = text("SELECT product_code FROM products WHERE id = :id")
                row = conn.execute(query, {"id": prod_id}).fetchone()
                if not row:
                    print(f"Product ID {prod_id} not found in DB, skipping code generation.")
                    continue
                
                wms_code = row[0] or ""
                
                # Call the modular barcode generator
                generate_barcode(prod_id, wms_code, BARCODE_DIR)
                generated.append(prod_id)
            except Exception as item_err:
                print(f"Error processing product ID {prod_id}: {item_err}")
                
    return {"status": "success", "generated_product_ids": generated}

@app.get("/health")
def health_check():
    db_ok = False
    if engine:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            db_ok = True
        except Exception:
            db_ok = False
            
    return {
        "status": "healthy",
        "mock_mode": MOCK_MODE,
        "gemini_api_configured": bool(GEMINI_API_KEY),
        "model": GEMINI_MODEL,
        "database_connected": db_ok
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
