"""
One-time script: generate barcode PNGs for all existing products.
Run from the backend/barcode/ directory:
    python generate_all.py
"""
import os
import sys
import psycopg2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from barcode_generator import generate_barcode

BARCODE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(BARCODE_DIR)

def load_env_defaults(path: str) -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

load_env_defaults(os.path.join(BACKEND_DIR, ".env"))

DB = dict(
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", "5432")),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD", "1234"),
    dbname=os.getenv("DB_NAME", "Autopartsdb"),
)

print(f"Connecting to {DB['host']}:{DB['port']}/{DB['dbname']}...")
conn = psycopg2.connect(**DB)
cur = conn.cursor()
cur.execute("SELECT id, product_code, barcode FROM products ORDER BY id")
rows = cur.fetchall()
cur.close()
conn.close()

print(f"Found {len(rows)} products. Generating barcodes...")
ok, skip, err = 0, 0, 0

for prod_id, product_code, barcode_val in rows:
    wms_code = (product_code or barcode_val or "").strip()
    if not wms_code:
        print(f"  [SKIP] id={prod_id} — no product_code or barcode")
        skip += 1
        continue
    try:
        path = generate_barcode(prod_id, wms_code, BARCODE_DIR)
        print(f"  [OK] id={prod_id} → {os.path.basename(path)}")
        ok += 1
    except Exception as e:
        print(f"  [ERR] id={prod_id}: {e}")
        err += 1

print(f"\nDone: {ok} generated, {skip} skipped, {err} errors")
