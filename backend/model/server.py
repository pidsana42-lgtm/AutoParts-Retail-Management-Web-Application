import sys
import os
import glob
import json
import re
import traceback
from contextlib import asynccontextmanager
from PIL import Image
import pillow_heif
pillow_heif.register_heif_opener()
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from io import BytesIO
from sqlalchemy import create_engine, text
import google.generativeai as genai

# Parse environment variables manually (matching main.py)
def load_env():
    model_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(model_dir)
    project_dir = os.path.dirname(backend_dir)
    env_paths = [
        os.path.join(project_dir, ".env"),
        os.path.join(backend_dir, ".env"),
        os.path.join(model_dir, ".env"),
        os.path.join(project_dir, ".env.local"),
        os.path.join(backend_dir, ".env.local"),
        os.path.join(model_dir, ".env.local"),
    ]
    explicit_env_keys = set(os.environ)

    for path in env_paths:
        if os.path.exists(path):
            with open(path, "r") as f:
                for line in f:
                    if "=" in line and not line.startswith("#"):
                        parts = line.strip().split("=", 1)
                        if len(parts) == 2 and parts[0].strip() not in explicit_env_keys:
                            os.environ[parts[0].strip()] = parts[1].strip()

load_env()

import argparse
parser = argparse.ArgumentParser(description="AutoParts Bill OCR FastAPI Server")
parser.add_argument("--mode", "-m", type=str, default=os.getenv("OCR_MODE", "2"), help="OCR Processing Mode: 1 = Typhoon + Local Model, 2 = Lightning AI Cloud 100%%")
parser.add_argument("--port", type=int, default=int(os.getenv("OCR_PORT", "8000")), help="Port for the OCR FastAPI server")
args, unknown = parser.parse_known_args()

RAW_MODE = str(args.mode).strip().lower()
if RAW_MODE in ["1", "typhoon", "local", "typhoon-local"]:
    OCR_MODE = "1"
    MODE_NAME = "Mode 1: Typhoon OCR + Local GGUF Model"
else:
    OCR_MODE = "2"
    MODE_NAME = "Mode 2: Lightning AI Cloud 100%"

print("==================================================================")
print(f"🚀 ACTIVE OCR ENGINE: [{MODE_NAME}]")
print("==================================================================")

MOCK_MODE = os.getenv("MOCK_LLM", "false").lower() == "true"
# Retrieve API key (check GOOGLE_STUDIO first, and strip any leading/trailing spaces)
GEMINI_API_KEY = (os.getenv("GOOGLE_STUDIO") or os.getenv("GEMINI_API_KEY") or "").strip()
raw_model = (os.getenv("GEMINI_MODEL") or "gemini-3.1-flash-lite").strip()
if "/" in raw_model:
    raw_model = raw_model.split("/")[-1]
GEMINI_MODEL = raw_model
LIGHTNING_API_KEY = (os.getenv("LIGHTNING_API_KEY") or "").strip()
if LIGHTNING_API_KEY:
    print(f"Lightning AI API active with key: {LIGHTNING_API_KEY[:6]}...")
else:
    print("Lightning AI API key not configured.")

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
            
            # จำนวนมิติของเวกเตอร์มาจาก embedder ซึ่งเป็นเจ้าของโมเดล — import แบบ lazy
            # ให้เข้ากับจุดอื่นในไฟล์นี้ที่ import embedder เมื่อถึงเวลาใช้งานจริงเท่านั้น
            from embedder import EMBEDDING_DIM

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
                    
                    # pgvector: เก็บ embedding เป็นชนิด vector จริง เพื่อให้ค้นหาความคล้าย (cosine)
                    # ด้วยตัวดำเนินการ <=> ในฝั่งฐานข้อมูล แทนการดึงเวกเตอร์ทั้งหมดมาคำนวณในหน่วยความจำ
                    transaction_conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

                    # Persistent embedding cache for the product matcher (survives restarts,
                    # only new/changed products get re-embedded — see embedder.ProductMatcher.fit)
                    transaction_conn.execute(text(f"""
                        CREATE TABLE IF NOT EXISTS product_embeddings (
                            id SERIAL PRIMARY KEY,
                            target_key VARCHAR(80) NOT NULL UNIQUE,
                            target_type VARCHAR(16) NOT NULL DEFAULT 'product',
                            target_id INTEGER NOT NULL DEFAULT 0,
                            content_hash VARCHAR(64) NOT NULL,
                            supplier_id INTEGER,
                            embedding vector({EMBEDDING_DIM}) NOT NULL,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                    """))

                    # ตารางที่สร้างไว้ก่อนเพิ่มการค้นแยกตามซัพพลายเออร์ จะยังไม่มีคอลัมน์นี้
                    transaction_conn.execute(text(
                        "ALTER TABLE product_embeddings ADD COLUMN IF NOT EXISTS supplier_id INTEGER;"))

                    # ตารางเวอร์ชันเก่าเก็บ embedding เป็น JSONB — ตารางนี้เป็นแคชล้วน สร้างใหม่ได้จาก
                    # /api/products/refresh-embeddings จึงลบทิ้งแล้วสร้างใหม่เป็นชนิด vector ได้อย่างปลอดภัย
                    embedding_type = transaction_conn.execute(text("""
                        SELECT udt_name FROM information_schema.columns
                        WHERE table_name = 'product_embeddings' AND column_name = 'embedding'
                    """)).scalar()
                    if embedding_type is not None and embedding_type != 'vector':
                        print(f"[pgvector] Migrating product_embeddings.embedding from {embedding_type} to vector({EMBEDDING_DIM})...")
                        transaction_conn.execute(text("DROP TABLE IF EXISTS product_embeddings;"))
                        transaction_conn.execute(text(f"""
                            CREATE TABLE product_embeddings (
                                id SERIAL PRIMARY KEY,
                                target_key VARCHAR(80) NOT NULL UNIQUE,
                                target_type VARCHAR(16) NOT NULL DEFAULT 'product',
                                target_id INTEGER NOT NULL DEFAULT 0,
                                content_hash VARCHAR(64) NOT NULL,
                                supplier_id INTEGER,
                                embedding vector({EMBEDDING_DIM}) NOT NULL,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            );
                        """))

                    # HNSW index สำหรับ cosine distance — ทำให้การค้นหาเพื่อนบ้านใกล้สุดไม่ต้องสแกนทั้งตาราง
                    transaction_conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS idx_product_embeddings_hnsw
                        ON product_embeddings USING hnsw (embedding vector_cosine_ops);
                    """))
                    # รองรับการค้น 3 ชั้น: correction ของซัพเจ้านี้ -> correction เจ้าอื่น -> product
                    transaction_conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS idx_product_embeddings_type
                        ON product_embeddings (target_type);
                    """))
                    transaction_conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS idx_product_embeddings_type_supplier
                        ON product_embeddings (target_type, supplier_id);
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
        "supplier_name": "AP Auto Parts Co., Ltd.",
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

local_llm = None
cuda_dll_directory_handles = []
cuda_dll_directories_added = set()
cuda_dll_handles = []
cuda_dlls_preloaded = set()

def add_windows_cuda_dll_directories():
    global cuda_dll_directories_added, cuda_dlls_preloaded
    if os.name != "nt" or not hasattr(os, "add_dll_directory"):
        return

    candidate_dirs = []
    llama_lib_dirs = []
    try:
        import site
        site_roots = set(site.getsitepackages())
        user_site = site.getusersitepackages()
        if user_site:
            site_roots.add(user_site)

        for site_root in site_roots:
            llama_lib = os.path.join(site_root, "llama_cpp", "lib")
            if os.path.isdir(llama_lib):
                candidate_dirs.append(llama_lib)
                llama_lib_dirs.append(llama_lib)

            nvidia_root = os.path.join(site_root, "nvidia")
            if not os.path.isdir(nvidia_root):
                continue
            for current_dir, _, filenames in os.walk(nvidia_root):
                if any(filename.lower().endswith(".dll") for filename in filenames):
                    candidate_dirs.append(current_dir)
    except Exception as err:
        print(f"Warning: Could not inspect NVIDIA Python DLL directories: {err}")

    driver_store = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", "DriverStore", "FileRepository")
    for pattern in ("nv*.inf_amd64_*", "nvhm.inf_amd64_*"):
        for dll_path in glob.glob(os.path.join(driver_store, pattern, "nvcudart_hybrid64.dll")):
            candidate_dirs.append(os.path.dirname(dll_path))

    for directory in candidate_dirs:
        if not os.path.isdir(directory):
            continue
        normalized = os.path.normcase(os.path.abspath(directory))
        if normalized in cuda_dll_directories_added:
            continue
        try:
            cuda_dll_directory_handles.append(os.add_dll_directory(directory))
            cuda_dll_directories_added.add(normalized)
        except OSError as err:
            print(f"Warning: Could not add CUDA DLL directory {directory}: {err}")

    try:
        import ctypes
        preload_order = (
            "ggml-base.dll",
            "ggml-cpu.dll",
            "ggml-cuda.dll",
            "ggml.dll",
            "mtmd.dll",
            "llama.dll",
        )
        for llama_lib in llama_lib_dirs:
            for dll_name in preload_order:
                dll_path = os.path.join(llama_lib, dll_name)
                normalized = os.path.normcase(os.path.abspath(dll_path))
                if normalized in cuda_dlls_preloaded or not os.path.exists(dll_path):
                    continue
                try:
                    cuda_dll_handles.append(ctypes.CDLL(dll_path))
                    cuda_dlls_preloaded.add(normalized)
                except OSError as err:
                    print(f"Warning: Could not preload {dll_name}: {err}")
    except Exception as err:
        print(f"Warning: Could not preload llama.cpp CUDA DLLs: {err}")

def resolve_llama_cuda_config(llama_supports_gpu_offload):
    cuda_mode = os.getenv("LLAMA_CPP_USE_CUDA", "auto").strip().lower()
    force_cpu = cuda_mode in {"0", "false", "no", "off", "cpu"}
    force_cuda = cuda_mode in {"1", "true", "yes", "on", "cuda", "gpu"}

    torch_cuda_available = False
    cuda_device_name = None
    torch_error = None
    try:
        import torch
        torch_cuda_available = bool(torch.cuda.is_available())
        if torch_cuda_available:
            cuda_device_name = torch.cuda.get_device_name(0)
    except Exception as err:
        torch_error = str(err)

    llama_gpu_offload_available = bool(llama_supports_gpu_offload())
    use_cuda = False
    if not force_cpu:
        use_cuda = (cuda_mode in {"", "auto"} or force_cuda) and llama_gpu_offload_available

    if use_cuda:
        device_text = cuda_device_name or "llama.cpp GPU backend"
        print(f"CUDA mode enabled for llama.cpp GPU offload ({device_text}).")
        if not torch_cuda_available:
            print("Note: PyTorch CUDA is not available in this environment, but llama.cpp GPU offload is available.")
    else:
        if force_cpu:
            print("CUDA mode disabled by LLAMA_CPP_USE_CUDA; using CPU mode.")
        elif force_cuda:
            print("LLAMA_CPP_USE_CUDA requested CUDA, but CUDA offload is not available; using CPU mode.")
        elif not llama_gpu_offload_available:
            print("llama-cpp-python was installed without CUDA/GPU offload support; using CPU mode.")
        elif not torch_cuda_available:
            print("PyTorch CUDA is not available, but this does not block llama.cpp GPU offload.")

        if torch_error:
            print(f"Warning: Could not inspect PyTorch CUDA status: {torch_error}")

    return use_cuda, (-1 if use_cuda else 0)

def get_local_llm():
    global local_llm
    if local_llm is None:
        model_path = os.path.join(os.path.dirname(__file__), "Gemma-4-E4B-it-PARL-Q4_K_M.gguf")
        clip_path = os.path.join(os.path.dirname(__file__), "Gemma-4-E4B-it-PARL-mmproj.gguf")
        
        # Check if files exist in the same directory as server.py
        if not os.path.exists(model_path) or not os.path.exists(clip_path):
            print("Model files not found locally in directory. Attempting to download from Hugging Face Hub...")
            try:
                from huggingface_hub import hf_hub_download
                model_dir = os.path.dirname(model_path)
                
                # Download model files if they are missing
                if not os.path.exists(model_path):
                    print(f"Downloading Gemma-4-E4B-it-PARL-Q4_K_M.gguf to {model_dir}...")
                    model_path = hf_hub_download(
                        repo_id="Phonsiri/Gemma-4-E4B-it-PARL-GGUF", 
                        filename="Gemma-4-E4B-it-PARL-Q4_K_M.gguf",
                        local_dir=model_dir,
                        local_dir_use_symlinks=False
                    )
                if not os.path.exists(clip_path):
                    print(f"Downloading Gemma-4-E4B-it-PARL-mmproj.gguf to {model_dir}...")
                    clip_path = hf_hub_download(
                        repo_id="Phonsiri/Gemma-4-E4B-it-PARL-GGUF", 
                        filename="Gemma-4-E4B-it-PARL-mmproj.gguf",
                        local_dir=model_dir,
                        local_dir_use_symlinks=False
                    )
            except Exception as dl_err:
                raise RuntimeError(
                    f"Failed to automatically download GGUF model files from Hugging Face: {dl_err}. "
                    f"Please place them manually in {os.path.dirname(model_path)}."
                )
                
        print(f"Loading local Gemma 4 model from {model_path}...")
        add_windows_cuda_dll_directories()
        from llama_cpp import Llama, llama_supports_gpu_offload
        use_cuda, n_gpu_layers = resolve_llama_cuda_config(llama_supports_gpu_offload)
        runtime_mode = "CUDA mode" if use_cuda else "CPU mode"
        try:
            from llama_cpp.llama_chat_format import Gemma4ChatHandler
            chat_handler = Gemma4ChatHandler(clip_model_path=clip_path, use_gpu=use_cuda)
            print(f"Using Gemma4ChatHandler ({runtime_mode}) for Gemma 4 multimodal format")
        except ImportError:
            try:
                from llama_cpp.llama_chat_format import Gemma3ChatHandler
                chat_handler = Gemma3ChatHandler(clip_model_path=clip_path, use_gpu=use_cuda)
                print(f"Using Gemma3ChatHandler ({runtime_mode}) for Gemma 4 multimodal format")
            except ImportError:
                from llama_cpp.llama_chat_format import Llava15ChatHandler
                chat_handler = Llava15ChatHandler(clip_model_path=clip_path)
                print("Warning: Gemma4/3ChatHandler not found, falling back to Llava15ChatHandler")
        
        local_llm = Llama(
            model_path=model_path,
            chat_handler=chat_handler,
            n_ctx=16384,       # กำหนดขนาด context window เพื่อรองรับ prompt และผลลัพธ์ JSON ขนาดใหญ่
            n_gpu_layers=-1,   # โหลดโมเดลทั้งหมดลงบน Apple Silicon Metal (MPS GPU) เพื่อความเร็วสูงสุด
            verbose=False      # ซ่อน log tensor loading เยอะๆ
        )
        print("Local Gemma 4 model loaded successfully!")
    return local_llm

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load DB and configure local GGUF model
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
        try:
            model_path = os.path.join(os.path.dirname(__file__), "Gemma-4-E4B-it-PARL-Q4_K_M.gguf")
            if os.path.exists(model_path):
                print("Pre-loading local Gemma 4 model (GGUF)...")
                get_local_llm()
            else:
                print("Local GGUF model file not found; using Cloud Gemini API.")
        except Exception as llm_err:
            print(f"Warning: Could not pre-load local model during startup: {llm_err}")

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

def extract_text_via_typhoon(img, image_name_for_mock="image.jpg"):
    TYPHOON_API_KEY = (os.getenv("api_key") or "").strip()
    if not TYPHOON_API_KEY:
        print("Warning: api_key (Typhoon) not found in environment!")
        return None
        
    import io
    img_byte_arr = io.BytesIO()
    temp_img = img.copy()
    if temp_img.mode in ('RGBA', 'LA', 'P'):
        temp_img = temp_img.convert('RGB')
    temp_img.save(img_byte_arr, format='JPEG', quality=95)
    img_bytes = img_byte_arr.getvalue()
    
    url = "https://api.opentyphoon.ai/v1/ocr"
    typhoon_filename = os.path.splitext(image_name_for_mock)[0] + ".jpg"
    files = {'file': (typhoon_filename, img_bytes, 'image/jpeg')}
    data = {
        'model': 'typhoon-ocr',
        'max_tokens': '16384',
        'temperature': '0.1',
        'top_p': '0.6',
        'repetition_penalty': '1.2'
    }
    headers = {
        'Authorization': f'Bearer {TYPHOON_API_KEY}'
    }
    
    print(f"Attempting OpenTyphoon OCR for {image_name_for_mock}...")
    try:
        response = requests.post(url, files=files, data=data, headers=headers, timeout=60)
        if response.status_code == 200:
            result = response.json()
            extracted_texts = []
            for page_result in result.get('results', []):
                if page_result.get('success') and page_result.get('message'):
                    content = page_result['message']['choices'][0]['message']['content']
                    try:
                        parsed_content = json.loads(content)
                        text = parsed_content.get('natural_text', content)
                    except json.JSONDecodeError:
                        text = content
                    extracted_texts.append(text)
                elif not page_result.get('success'):
                    print(f"Error processing page: {page_result.get('error', 'Unknown error')}")
            
            full_text = '\n'.join(extracted_texts)
            return full_text
        else:
            print(f"OpenTyphoon OCR returned error {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print(f"Failed to connect to OpenTyphoon OCR: {e}")
        return None

def match_bill_supplier(result):
    """
    Attempts to match the extracted 'supplier_name' to a supplier_id in the database
    using exact or fuzzy/substring text matching.
    """
    if "supplier_name" not in result or not result["supplier_name"]:
        # Fallback default supplier_id = 1 if not extracted
        if "supplier_id" not in result or not result["supplier_id"]:
            result["supplier_id"] = 1
        return result
        
    supplier_name_extracted = str(result["supplier_name"]).strip()
    if not supplier_name_extracted:
        if "supplier_id" not in result or not result["supplier_id"]:
            result["supplier_id"] = 1
        return result
        
    try:
        if engine is not None:
            with engine.begin() as conn:
                query = text("SELECT id, supplier_name, short_supplier_name FROM suppliers")
                rows = conn.execute(query).fetchall()
                
                name_clean = supplier_name_extracted.lower().replace("บริษัท", "").replace("จำกัด", "").replace("บจก.", "").replace("หจก.", "").strip()
                
                best_match_id = None
                best_match_score = 0.0
                
                for r in rows:
                    sup_id = r[0]
                    sup_name = r[1] or ""
                    short_name = r[2] or ""
                    
                    sup_name_lower = sup_name.lower()
                    short_name_lower = short_name.lower()
                    
                    # Clean names for comparison
                    sup_name_clean = sup_name_lower.replace("บริษัท", "").replace("จำกัด", "").replace("บจก.", "").replace("หจก.", "").strip()
                    short_name_clean = short_name_lower.replace("บริษัท", "").replace("จำกัด", "").replace("บจก.", "").replace("หจก.", "").strip()
                    
                    # Exact matches on full or short name
                    if name_clean == sup_name_clean or name_clean == short_name_clean:
                        result["supplier_id"] = sup_id
                        print(f"[Supplier Match] Exact match found: '{supplier_name_extracted}' -> Supplier ID {sup_id} ('{sup_name}')")
                        return result
                        
                    # Fuzzy/substring match: check if clean name is a substring or vice-versa
                    if name_clean and (name_clean in sup_name_clean or sup_name_clean in name_clean or name_clean in short_name_clean):
                        overlap_score = len(name_clean) / max(len(sup_name_clean), 1)
                        if overlap_score > best_match_score:
                            best_match_score = overlap_score
                            best_match_id = sup_id
                            
                if best_match_id and best_match_score >= 0.3:
                    result["supplier_id"] = best_match_id
                    print(f"[Supplier Match] Fuzzy match found: '{supplier_name_extracted}' -> Supplier ID {best_match_id} (Score: {best_match_score:.2f})")
                    return result
                
                # If no match is found, dynamically create the supplier so it can be pre-selected in the UI!
                import time
                words = name_clean.split()
                short_name = "".join([w[0].upper() for w in words if w])[:5]
                if not short_name:
                    short_name = supplier_name_extracted[:3].upper()
                
                email_fallback = f"sale_{short_name.lower()}_{int(time.time())}@na.com"
                
                insert_query = text(
                    "INSERT INTO suppliers (supplier_name, short_supplier_name, supplier_address, contact_line_sale, phone_number_sale, email_sale, bank_account_number, created_at, updated_at) "
                    "VALUES (:name, :short, 'N/A', 'N/A', 'N/A', :email, 'N/A', NOW(), NOW()) RETURNING id"
                )
                insert_res = conn.execute(insert_query, {
                    "name": supplier_name_extracted, 
                    "short": short_name,
                    "email": email_fallback
                })
                new_id = insert_res.fetchone()[0]
                result["supplier_id"] = new_id
                print(f"[Supplier Match] Created new supplier '{supplier_name_extracted}' with ID {new_id}")
                return result
                    
        # If no DB match is found, default to 1
        if "supplier_id" not in result or not result["supplier_id"]:
            result["supplier_id"] = 1
            
    except Exception as e:
        print(f"Error matching/creating bill supplier: {e}")
        if "supplier_id" not in result or not result["supplier_id"]:
            result["supplier_id"] = 1
            
    return result

async def perform_ocr(img, image_name_for_mock="image.jpg"):
    if MOCK_MODE:
        print("Mock Mode active. Returning mock data.")
        return extract_mock_data(image_name_for_mock)
    try:
        # Step 1: OpenTyphoon OCR to extract text in Markdown/Natural Text (Mode 1 only)
        extracted_markdown = None
        if OCR_MODE == "1":
            extracted_markdown = extract_text_via_typhoon(img, image_name_for_mock)
        
        # We will build base64 for image_url if we need to fall back to visual model
        import io
        import base64
        img_byte_arr = io.BytesIO()
        temp_img = img.copy()
        if temp_img.mode in ('RGBA', 'LA', 'P'):
            temp_img = temp_img.convert('RGB')
        temp_img.save(img_byte_arr, format='JPEG', quality=95)
        img_bytes = img_byte_arr.getvalue()
        img_b64 = base64.b64encode(img_bytes).decode('utf-8')
        
        def is_valid_structured_json(text_content):
            if not text_content:
                return False
            try:
                cleaned = re.sub(r"<think>.*?</think>", "", text_content, flags=re.DOTALL).strip()
                if cleaned.startswith("```"):
                    cleaned = re.sub(r"```(?:json)?\s*", "", cleaned)
                    cleaned = re.sub(r"```\s*$", "", cleaned).strip()
                cleaned = re.sub(r'(?<=\d),(?=\d)', '', cleaned)
                parsed = json.loads(cleaned)
                if "items" in parsed and len(parsed["items"]) > 0:
                    return True
            except Exception:
                pass
            return False

        # Build Markdown Section if present
        markdown_section = ""
        if extracted_markdown:
            print("Successfully obtained markdown text from OpenTyphoon OCR. Structuring via LLM...")
            markdown_section = f"""
Extracted Invoice Markdown:
\"\"\"
{extracted_markdown}
\"\"\"
"""
        else:
            print("OpenTyphoon OCR not available. Using pure visual model processing...")

        # Prompt for structuring text
        prompt = f"""You are an expert OCR JSON Structurer specializing in agricultural machinery and auto parts invoices/bills (บิลร้านอะไหล่รถยนต์).
Analyze the input invoice/bill carefully. You can intelligently correct typos, guess garbled characters, and reconstruct words using the auto parts context, brand names (e.g. FORD, NEWHOLLAND, KUBOTA, ISUZU, TOYOTA, BOSCH), and item descriptions.

Follow these strict extraction guidelines for this layout:
1. Invoice Metadata:
   - "bill_no": Extract from the bill number field (e.g. "IV-202507/01229").
   - "due_date": Extract the invoice/purchase date shown as "วันที่" on the bill (e.g. if the bill shows "วันที่ : 29/07/2025", due_date is 2025-07-29). Do NOT use the separate "วันครบกำหนดชำระเงิน"/"DUE DATE" field even if the bill has one, and do NOT add the credit term days to the invoice date — always use the "วันที่" (invoice date) as-is.
   - "credit_term": Extract the term details (e.g. "90 Days" or "90 วัน").
   - "transport_by": Extract from "ขนส่งโดย" if present.
   - "supplier_name": Extract the supplier company name visible in the invoice header/logo (e.g. "บริษัท ไทยออโตพาร์ท จำกัด" or "เจ.เจ. อะไหล่").
   - "subtotal", "vat_amount", & "grand_total": Extract the corresponding financial summaries at the bottom.

2. Line Items Extraction:
   - Identify rows by the sequence number under the "ลำดับ" column.
   - Product Codes: Extract the exact supplier product code, part number, or article code from the "รหัสสินค้า" column (e.g. "A2-260404F", "07862", "BP-VIO-01"). Do NOT put sequence numbers (1, 2, 3) or price numbers into "company_product_code". If there is no product code in the bill row, set "company_product_code" to "".
   - Product Name: The "รายการ" description column may span multiple lines (including compatibility/cross-reference numbers). Group all subsequent lines belonging to the same sequence into a single, clean "company_product_name" string. Do not split them into separate items.
   - Units: Clean unit string inside parentheses, e.g. change "เส้น(1)" to "เส้น", "ลูก(1)" to "ลูก", and "อัน(1)" to "อัน".
   - Numbers & Pricing: Clean any comma separators from numbers (e.g. "1,200.00" -> 1200.00). If a discount column is empty or "-", set it to 0.0.
   - Column and Row Alignment (การจัดเรียงคอลัมน์และแถวให้ตรงกัน): You MUST trace each line horizontally from left to right. Make sure quantity (จำนวน), unit price (ราคาต่อหน่วย), discount (ส่วนลด), and net amount (จำนวนเงิน) are matched with the CORRECT product on the same horizontal line. Do not let columns shift or drift across rows even if the text or numbers in the image are slightly misaligned or offset. Cross-reference the values for each row: `(order_quantity * price_per_unit) - discount_amount` MUST be equal or extremely close to the `net_amount` shown on that same row. If it is not, you have misaligned the columns. Re-align them visually by looking at the original image layout.

3. Auto Parts Terminology Spelling Corrections (แก้ไขคำสะกดผิดทางภาษาไทยในบริบทอะไหล่รถยนต์/แทรกเตอร์):
   - You MUST actively correct typical OCR spelling mistakes using the agricultural machinery and auto parts store domain context.
   - Examples of common corrections you must apply to the item names:
     * "สายซัก", "สายขึ้ก", "สายชักข้าง..." -> "สายชัก" (Steering linkages / chains)
     * "เว๋า", "เวีย" -> "เว้า" (e.g. "สายชักข้างหัวงอ เว้า ยาว 32\"")
     * "ฝาปิดถังเชล่า", "ถังเชล่า" -> "ฝาปิดถังโซล่า" (Fuel tank cap)
     * "ปิ๊มน้ำ", "ปั้มน้ำ", "ปั้มน้ำดูโบ๊ค" -> "ปั๊มน้ำคูโบต้า" (Kubota Water Pump)
     * "ยางหมวดเบรค", "ยางหมวกเปรค" -> "ยางหมวกเบรค"
     * "มีบริษัท", "มีบริปริม" -> "มีสปริง" (e.g. "มีสปริง" instead of "มีบริษัท" or "มีบริปริม")
     * "ลูกบนพื้นชุด", "ลูกบนทั่งชุด" -> "ลูกบนทั้งชุด" (e.g. "กรองอากาศลูกบนทั้งชุด")
     * "NEXTWHolland", "NEXTWOLLAND", "NEXTHOLLAND" -> "NEWHOLLAND" (New Holland tractor brand)
     * "ดูโบต้า", "ดูโบ๊ค" -> "คูโบต้า" (Kubota brand)

Return ONLY a raw JSON object (no markdown block wrappers, no explanation) with this exact structure:
{{
  "bill_no": "Invoice/Bill number visible in the image",
  "total_amount": 0.0,
  "due_date": "YYYY-MM-DD",
  "transport_by": "Transportation provider if shown, else null",
  "supplier_name": "Supplier company name extracted from invoice header",
  "supplier_id": 1,
  "subtotal": 0.0,
  "discount_total": 0.0,
  "credit_term": "e.g. 30 Days or null",
  "vat_amount": 0.0,
  "grand_total": 0.0,
  "payment_status": "unpaid",
  "items": [
    {{
      "item_sequence": 1,
      "company_product_code": "product code from invoice",
      "company_product_name": "product name from invoice",
      "order_quantity": 1,
      "unit": "PCS",
      "conversion_factor": 1.0,
      "price_per_unit": 0.0,
      "discount_amount": 0.0,
      "net_amount": 0.0,
      "is_freebie": false,
      "remark": "",
      "product_id": null
    }}
  ]
}}
{markdown_section}
Extract every line item. Use null for missing fields. Do not include any thinking or reasoning process (do not output <think>...</think> block). Return ONLY the JSON, nothing else."""

        prompt_vision = prompt

        generated_text = None

        if OCR_MODE == "1":
            print("=== Executing [MODE 1]: Typhoon OCR + Local GGUF Model ===")
            if extracted_markdown:
                print("Successfully obtained markdown text from OpenTyphoon OCR. Structuring via Local LLM...")
                try:
                    llm = get_local_llm()
                    import asyncio
                    response = await asyncio.to_thread(
                        llm.create_chat_completion,
                        messages=[
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        temperature=0.1,
                        max_tokens=8192
                    )
                    local_text = response['choices'][0]['message']['content']
                    if is_valid_structured_json(local_text):
                        generated_text = local_text
                        print("Local text-only model structuring completed successfully!")
                except Exception as local_err:
                    print(f"Local text-only structuring failed: {local_err}")

            # Fallback to Lightning AI if Mode 1 local fails or if no extracted markdown
            if generated_text is None and LIGHTNING_API_KEY:
                print("Mode 1 Fallback: Executing Lightning AI Cloud API...")
                try:
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
                                    { "type": "text", "text": prompt_vision },
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
                    cloud_text = resp.json()['choices'][0]['message']['content']
                    if is_valid_structured_json(cloud_text):
                        generated_text = cloud_text
                        print("Lightning AI Cloud API fallback completed successfully!")
                except Exception as l_err:
                    print(f"Lightning AI Cloud API fallback failed: {l_err}")

        # Direct Google Gemini (Primary & Fast Cloud Model)
        if generated_text is None and GEMINI_API_KEY:
            import asyncio
            genai.configure(api_key=GEMINI_API_KEY)
            preferred_model = GEMINI_MODEL if GEMINI_MODEL.startswith("models/") else f"models/{GEMINI_MODEL}"
            candidate_models = [preferred_model]
            for fallback_m in ["models/gemini-3.1-flash-lite", "models/gemini-2.5-flash", "models/gemini-flash-latest"]:
                if fallback_m not in candidate_models:
                    candidate_models.append(fallback_m)
            
            for m_name in candidate_models:
                try:
                    print(f"Calling Google Gemini API directly ({m_name})...")
                    gemini_model = genai.GenerativeModel(m_name)
                    gemini_res = await asyncio.to_thread(gemini_model.generate_content, [prompt, img])
                    if gemini_res and gemini_res.text and is_valid_structured_json(gemini_res.text):
                        generated_text = gemini_res.text
                        print(f"Google Gemini API ({m_name}) structuring completed successfully!")
                        break
                except Exception as gemini_err:
                    print(f"Google Gemini API ({m_name}) failed: {gemini_err}")

        # Fallback to Lightning AI if Mode 2 / Gemini fails
        if generated_text is None and LIGHTNING_API_KEY:
            print(f"Performing direct vision OCR via Lightning AI Cloud API ({GEMINI_MODEL})...")
            try:
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
                                { "type": "text", "text": prompt_vision },
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
                cloud_text = resp.json()['choices'][0]['message']['content']
                if is_valid_structured_json(cloud_text):
                    generated_text = cloud_text
                    print(f"Lightning AI Cloud API ({GEMINI_MODEL}) inference completed successfully!")
            except Exception as lightning_err:
                print(f"Lightning AI Cloud API failed: {lightning_err}")

        # Fallback to local model if cloud models fail
        if generated_text is None:
            print("Fallback: Executing local GGUF model...")
            try:
                llm = get_local_llm()
                import asyncio
                if extracted_markdown:
                    response = await asyncio.to_thread(
                        llm.create_chat_completion,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.1,
                        max_tokens=8192
                    )
                else:
                    response = await asyncio.to_thread(
                        llm.create_chat_completion,
                        messages=[
                            {
                                "role": "user",
                                "content": [
                                    { "type": "text", "text": prompt_vision },
                                    { "type": "image_url", "image_url": { "url": f"data:image/jpeg;base64,{img_b64}" } }
                                ]
                            }
                        ],
                        temperature=0.1,
                        max_tokens=8192
                    )
                local_vision_text = response['choices'][0]['message']['content']
                if is_valid_structured_json(local_vision_text):
                    generated_text = local_vision_text
                    print("Local GGUF fallback completed successfully!")
            except Exception as local_err:
                print(f"Local model fallback failed: {local_err}")

        if not generated_text:
            raise ValueError("No OCR model was able to produce structured text output.")

        print(f"Raw model output (first 500 chars): {generated_text[:500]}")
        
        # Remove any thinking block like <think>...</think> if present
        generated_text_clean = re.sub(r"<think>.*?</think>", "", generated_text, flags=re.DOTALL).strip()
        if generated_text_clean.startswith("```"):
            # กำจัด markdown code block
            generated_text_clean = re.sub(r"```(?:json)?\s*", "", generated_text_clean)
            generated_text_clean = re.sub(r"```\s*$", "", generated_text_clean).strip()
        
        # Remove commas inside numbers (e.g. 12,000.0 -> 12000.0) to make it valid JSON
        generated_text_clean = re.sub(r'(?<=\d),(?=\d)', '', generated_text_clean)
        
        parsed_json = None
        # แบบที่ 2: parse ตรงๆ ก่อน
        try:
            parsed_json = json.loads(generated_text_clean)
        except Exception:
            pass
        
        # แบบที่ 3: หา JSON ด้วย regex
        if parsed_json is None:
            json_match = re.search(r"(\{.*\})", generated_text_clean, re.DOTALL)
            if json_match:
                try:
                    parsed_json = json.loads(json_match.group(1))
                except Exception:
                    pass
        
        if parsed_json:
            parsed_json["ocr_text"] = generated_text
            parsed_json = match_bill_supplier(parsed_json)
            return parsed_json
        else:
            return {
                "error": "Failed to parse JSON from model output",
                "raw_output": generated_text
            }
    except Exception as e:
        tb = traceback.format_exc()
        print(f"Error during OCR execution: {e}\n{tb}")
        mock_data = extract_mock_data(image_name_for_mock)
        mock_data["ocr_text"] = f"--- OCR EXECUTION FALLBACK (MOCK DATA GENERATED) ---\nError Detail:\n{tb}\n\n" + mock_data["ocr_text"]
        mock_data = match_bill_supplier(mock_data)
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
                query = text("SELECT id, product_name, product_code, COALESCE((SELECT barcode FROM inventories WHERE inventories.product_id = products.id LIMIT 1), '') AS barcode FROM products WHERE is_active = true")
                rows = conn.execute(query).fetchall()
                for r in rows:
                    db_products.append({
                        "id": r[0],
                        "product_name": r[1],
                        "product_code": r[2],
                        "barcode": r[3] or ""
                    })
                
                # Get corrections globally for cross-supplier semantic embedding matching
                try:
                    corr_query = text("SELECT ai_product_name, ai_product_code, product_id, supplier_id FROM product_mapping_corrections")
                    corr_rows = conn.execute(corr_query).fetchall()
                    for cr in corr_rows:
                        corrections.append({
                            "company_product_name": cr[0],
                            "company_product_code": cr[1],
                            "product_id": cr[2],
                            "supplier_id": cr[3]
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
        # (persist_engine=engine → reuse cached embeddings from product_embeddings table)
        global global_matcher
        if global_matcher is None:
            from embedder import ProductMatcher
            global_matcher = ProductMatcher()
        global_matcher.fit(db_products, corrections, persist_engine=engine)
        
        # 3. Match each item using global_matcher
        supplier_id = int(result.get("supplier_id") or 1)
        for item in result["items"]:
            comp_name = item.get("company_product_name", "")
            comp_code = item.get("company_product_code", "")
            
            # Match
            # เกณฑ์ความมั่นใจขั้นต่ำของการจับคู่ด้วยเวกเตอร์ วัดกับข้อมูลจริงในระบบแล้ว:
            # คู่ที่ควรจับได้อยู่ราว 0.76-0.84 ส่วนสินค้าคนละชนิดอยู่ราว 0.59-0.70
            # 0.85 จึงยังปลอดภัย ไม่มีการจับคู่ผิดเพิ่มจากเกณฑ์ 0.95 เดิม (ทดสอบกับ 138 คู่ที่พนักงานยืนยันแล้ว)
            matched_id, score = global_matcher.match_product(comp_name, comp_code, current_supplier_id=supplier_id, threshold=0.85)
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
async def extract_invoice_from_path(request: ExtractRequest):
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
            
        result = await perform_ocr(img, image_name_for_mock=image_path)
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
    Extracts invoice information from an uploaded multipart image or PDF file, and saves to database.
    """
    import time
    import fitz
    try:
        contents = await file.read()
        is_pdf = file.filename.lower().endswith(".pdf") or file.content_type == "application/pdf"
        
        is_heic = file.filename.lower().endswith((".heic", ".heif")) or file.content_type in ("image/heic", "image/heif")

        if is_pdf:
            print(f"Detecting PDF upload: {file.filename}. Converting first page to PNG...")
            doc = fitz.open(stream=contents, filetype="pdf")
            if len(doc) == 0:
                raise Exception("The PDF file is empty or corrupted")
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=200) # 200 DPI is optimal for OCR quality
            file_to_save = pix.tobytes("png")
            img = Image.open(BytesIO(file_to_save))
            safe_filename = f"{int(time.time())}_{file.filename}.png"
        elif is_heic:
            print(f"Detecting HEIC/HEIF upload: {file.filename}. Converting to JPEG...")
            img = Image.open(BytesIO(contents))
            img = img.convert("RGB")
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=95)
            file_to_save = buf.getvalue()
            base_name = os.path.splitext(file.filename)[0]
            safe_filename = f"{int(time.time())}_{base_name}.jpg"
        else:
            img = Image.open(BytesIO(contents))
            file_to_save = contents
            safe_filename = f"{int(time.time())}_{file.filename}"

        result = await perform_ocr(img, image_name_for_mock=file.filename)
        # Perform local vector product matching
        result = match_bill_products(result)
        
        # Save image file to backend/uploads/ folder on the host
        uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
        os.makedirs(uploads_dir, exist_ok=True)
        
        file_path = os.path.join(uploads_dir, safe_filename)
        with open(file_path, "wb") as f:
            f.write(file_to_save)
            
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
    Generates Barcode (Code 128) and public product URL QR Code images.
    """
    import os
    import sys
    
    backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    barcode_dir = os.path.join(backend_root, "barcode")
    qrcode_dir = os.path.join(backend_root, "QRCode")
    for path in (barcode_dir, qrcode_dir):
        if path not in sys.path:
            sys.path.insert(0, path)
        
    try:
        from barcode_generator import generate_barcode
        from qr_generator import generate_qrcode
    except ImportError as e:
        print(f"Error importing code generator: {e}")
        raise HTTPException(status_code=500, detail=f"Code module import error: {e}")

    product_base_url = os.getenv("QR_PRODUCT_BASE_URL", "http://8.219.93.236:3000/product").rstrip("/")
    generated = []
    generated_qr_urls = {}
    
    with engine.connect() as conn:
        for prod_id in request.product_ids:
            try:
                # Use the internal WMS product code as the barcode source.
                query = text("SELECT product_code, COALESCE((SELECT barcode FROM inventories WHERE inventories.product_id = products.id LIMIT 1), '') AS barcode FROM products WHERE id = :id")
                row = conn.execute(query, {"id": prod_id}).fetchone()
                if not row:
                    print(f"Product ID {prod_id} not found in DB, skipping code generation.")
                    continue
                
                product_code, barcode_value = row
                wms_code = (product_code or barcode_value or "").strip()
                product_url = f"{product_base_url}/{prod_id}"
                
                generate_barcode(prod_id, wms_code, barcode_dir)
                generate_qrcode(prod_id, wms_code, product_url, qrcode_dir)
                generated.append(prod_id)
                generated_qr_urls[str(prod_id)] = product_url
            except Exception as item_err:
                print(f"Error processing product ID {prod_id}: {item_err}")
                
    return {
        "status": "success",
        "generated_product_ids": generated,
        "generated_qr_urls": generated_qr_urls,
    }

class RefreshEmbeddingsRequest(BaseModel):
    product_ids: list[int] = []

@app.post("/api/products/refresh-embeddings")
def refresh_product_embeddings(request: RefreshEmbeddingsRequest):
    """
    Eagerly (re)compute embeddings for products right after a bill import creates/updates
    them, instead of waiting for the next OCR scan's match_bill_products() call to do it
    lazily. ProductMatcher.fit() only embeds new/changed items (content-hash cache in the
    product_embeddings table), so this is cheap even though it refits against the whole
    active product list.
    """
    if engine is None:
        raise HTTPException(status_code=503, detail="Database engine not available")

    db_products = []
    corrections = []
    with engine.connect() as conn:
        query = text("SELECT id, product_name, product_code, COALESCE((SELECT barcode FROM inventories WHERE inventories.product_id = products.id LIMIT 1), '') AS barcode FROM products WHERE is_active = true")
        rows = conn.execute(query).fetchall()
        for r in rows:
            db_products.append({
                "id": r[0],
                "product_name": r[1],
                "product_code": r[2],
                "barcode": r[3] or ""
            })
        try:
            corr_query = text("SELECT ai_product_name, ai_product_code, product_id, supplier_id FROM product_mapping_corrections")
            corr_rows = conn.execute(corr_query).fetchall()
            for cr in corr_rows:
                corrections.append({
                    "company_product_name": cr[0],
                    "company_product_code": cr[1],
                    "product_id": cr[2],
                    "supplier_id": cr[3]
                })
        except Exception as ex:
            print(f"Could not load mapping corrections: {ex}")

    if not db_products:
        return {"status": "success", "embedded_count": 0}

    global global_matcher
    if global_matcher is None:
        from embedder import ProductMatcher
        global_matcher = ProductMatcher()
    global_matcher.fit(db_products, corrections, persist_engine=engine)

    return {"status": "success", "product_count": len(db_products), "requested_ids": request.product_ids}

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

@app.post("/api/extract-catalog")
async def extract_catalog_endpoint(file: UploadFile = File(...), crop_thumbnails: bool = True):
    """
    Extract all automotive product parts from an uploaded catalog page image using Gemini AI.
    """
    try:
        from catalog_extractor import extract_catalog_from_image
        contents = await file.read()
        results = extract_catalog_from_image(contents, crop_thumbnails=crop_thumbnails)
        return {
            "status": "success",
            "filename": file.filename,
            "total_items": len(results),
            "data": results
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=args.port)
