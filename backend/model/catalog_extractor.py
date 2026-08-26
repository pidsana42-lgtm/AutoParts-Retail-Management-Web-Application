import os
import json
import re
import io
import base64
from PIL import Image
import google.generativeai as genai

# Load environment variables cleanly from .env
try:
    from dotenv import load_dotenv
    current_dir = os.path.dirname(os.path.abspath(__file__))
    possible_env_paths = [
        os.path.join(current_dir, ".env"),
        os.path.join(current_dir, "..", ".env"),
        os.path.join(current_dir, "..", "..", ".env"),
    ]
    for env_p in possible_env_paths:
        if os.path.exists(env_p):
            load_dotenv(env_p, override=False)
except ImportError:
    pass

GEMINI_API_KEY = (os.getenv("GOOGLE_STUDIO") or os.getenv("GEMINI_API_KEY") or "").strip()
raw_model = (os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip()
if "/" in raw_model:
    raw_model = raw_model.split("/")[-1]
GEMINI_MODEL = raw_model

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

CATALOG_PROMPT = (
    "Extract all product information from this Thai automotive parts catalog page.\n\n"
    "CRITICAL FORMAT REQUIREMENT: Respond DIRECTLY with a JSON array ONLY. Start your response immediately with '['.\n\n"
    "CATALOG LAYOUT:\n"
    "- Products are arranged in rows across two columns.\n"
    "- Each product row has a product photo pair (standing filter + lying filter) and text details.\n\n"
    "For each product, output a JSON object containing:\n"
    "- \"box_2d\": [ymin, xmin, ymax, xmax] scaled 0-1000 for the product photo pair (including both standing filter and lying filter, ending right before S.T. NO text)\n"
    "- \"st_no\": Supplier product code. Usually, the supplier product code starts with the abbreviation of the supplier/store name (e.g., 'ST' for S.T.). Please infer this abbreviation and accurately extract or reconstruct the supplier product code (e.g., \"ST-03137\").\n"
    "- \"car_model\": Thai car model text (e.g. \"มิตซูบิชิ TROOPER 3.2 เบนซิน\")\n"
    "- \"part_no\": International/OEM Part Number (e.g. \"MD 069782\"). This is DIFFERENT from the supplier product code (st_no). Please extract it clearly and infer if there are missing parts based on standard patterns.\n"
    "- \"height\": H value\n"
    "- \"od\": OD value\n"
    "- \"threads\": THREADS or ID value\n"
)

def crop_box(image: Image.Image, box_2d: list) -> str:
    """Crop image according to normalized 0-1000 bounding box and return base64 data URI."""
    try:
        if not box_2d or len(box_2d) != 4:
            return ""
        ymin, xmin, ymax, xmax = box_2d
        width, height = image.size
        
        left = max(0, int((xmin / 1000.0) * width))
        top = max(0, int((ymin / 1000.0) * height))
        right = min(width, int((xmax / 1000.0) * width))
        bottom = min(height, int((ymax / 1000.0) * height))
        
        if right <= left or bottom <= top:
            return ""
            
        cropped = image.crop((left, top, right, bottom))
        buffer = io.BytesIO()
        cropped.save(buffer, format="JPEG", quality=85)
        b64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{b64_str}"
    except Exception as e:
        print(f"Warning: Failed to crop box {box_2d}: {e}")
        return ""

def extract_catalog_from_image(image_input, crop_thumbnails: bool = True):
    """
    Extract automotive parts product information from a catalog page image.
    
    Args:
        image_input: str (file path), bytes, or PIL.Image.Image
        crop_thumbnails: whether to crop and return base64 thumbnail of the product photo pair
        
    Returns:
        List of product dictionaries.
    """
    if isinstance(image_input, str):
        if not os.path.exists(image_input):
            raise FileNotFoundError(f"File not found: {image_input}")
        if image_input.lower().endswith(".pdf"):
            import fitz
            doc = fitz.open(image_input)
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=150)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        else:
            img = Image.open(image_input).convert("RGB")
    elif isinstance(image_input, bytes):
        if image_input.startswith(b"%PDF"):
            import fitz
            doc = fitz.open(stream=image_input, filetype="pdf")
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=150)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        else:
            img = Image.open(io.BytesIO(image_input)).convert("RGB")
    elif isinstance(image_input, Image.Image):
        img = image_input.convert("RGB")
    else:
        raise ValueError("Unsupported image_input type")

    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured in environment variables.")

    # Optimize image for Gemini API call (downscale to max 1400px for lightning-fast inference)
    max_dim = 1400
    img_for_ai = img
    if max(img.width, img.height) > max_dim:
        scale = max_dim / float(max(img.width, img.height))
        new_size = (int(img.width * scale), int(img.height * scale))
        img_for_ai = img.resize(new_size, Image.Resampling.LANCZOS)

    # Candidate models to try in fallback order (Gemini 3.5 Flash primary)
    candidate_models = [
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-2.5-flash",
        GEMINI_MODEL,
    ]
    # Deduplicate while preserving order
    seen = set()
    models_to_try = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

    response = None
    last_error = None
    for model_name in models_to_try:
        try:
            print(f"Trying Gemini model: {model_name}...")
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(
                [CATALOG_PROMPT, img_for_ai],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=8192,
                    response_mime_type="application/json"
                )
            )
            if response and response.text:
                print(f"Success with model: {model_name}")
                break
        except Exception as err:
            print(f"Model {model_name} failed: {err}")
            last_error = err

    if response is None or not response.text:
        raise ValueError(f"All Gemini models failed. Last error: {last_error}")

    raw_text = response.text.strip()
    
    # Strip any markdown code fences if present
    if raw_text.startswith("```json"):
        raw_text = raw_text[7:]
    elif raw_text.startswith("```"):
        raw_text = raw_text[3:]
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3]
    raw_text = raw_text.strip()

    products = []
    # Attempt 1: Direct JSON parsing
    try:
        data = json.loads(raw_text)
        if isinstance(data, list):
            products = data
        elif isinstance(data, dict):
            products = [data]
    except Exception:
        # Attempt 2: Clean trailing commas and fix missing commas between objects
        try:
            cleaned = re.sub(r',\s*([\]\}])', r'\1', raw_text)
            cleaned = re.sub(r'\}\s*\{', '},{', cleaned)
            data = json.loads(cleaned)
            if isinstance(data, list):
                products = data
            elif isinstance(data, dict):
                products = [data]
        except Exception:
            # Attempt 3: Extract each individual JSON object { ... }
            obj_matches = re.findall(r'\{[^{}]*\}', raw_text)
            for m in obj_matches:
                try:
                    obj = json.loads(m)
                    if isinstance(obj, dict):
                        products.append(obj)
                except Exception:
                    try:
                        obj = json.loads(re.sub(r',\s*\}', '}', m))
                        if isinstance(obj, dict):
                            products.append(obj)
                    except Exception:
                        pass

    if not products:
        raise ValueError(f"Failed to parse model response into JSON array.\nRaw Output:\n{raw_text}")

    # Add thumbnail images from box_2d
    if crop_thumbnails:
        for p in products:
            box = p.get("box_2d")
            if box:
                thumb = crop_box(img, box)
                p["image_thumbnail"] = thumb
                p["image"] = thumb

    return products

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python catalog_extractor.py <image_path>")
        sys.exit(1)
        
    img_path = sys.argv[1]
    print(f"Extracting catalog information from: {img_path}")
    results = extract_catalog_from_image(img_path, crop_thumbnails=False)
    print(json.dumps(results, indent=2, ensure_ascii=False))
