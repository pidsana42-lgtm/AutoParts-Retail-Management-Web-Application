"""
Generate QR Code PNGs for all products.

For QR codes that open product info in a browser, encode a public frontend URL:
    python generate_all.py --base-url http://192.168.1.20:5173/product
    python generate_all.py --base-url https://your-domain.com/product
"""
import argparse
import os
import sys

import psycopg2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qr_generator import generate_qrcode

QRCODE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(QRCODE_DIR)


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


def get_db_config() -> dict:
    return dict(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "1234"),
        dbname=os.getenv("DB_NAME", "Autopartsdb"),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate product QR codes.")
    parser.add_argument(
        "--base-url",
        default=os.getenv("QR_PRODUCT_BASE_URL", "http://localhost:5173/product"),
        help="Public product page base URL, e.g. https://shop.example.com/product",
    )
    return parser.parse_args()


load_env_defaults(os.path.join(BACKEND_DIR, ".env"))
args = parse_args()
base_url = args.base_url.rstrip("/")
db = get_db_config()

print(f"Connecting to {db['host']}:{db['port']}/{db['dbname']}...")
conn = psycopg2.connect(**db)
cur = conn.cursor()
cur.execute("SELECT id, product_code, barcode FROM products ORDER BY id")
rows = cur.fetchall()
cur.close()
conn.close()

print(f"Found {len(rows)} products. Generating public URL QR codes...")
ok, skip, err = 0, 0, 0

for prod_id, product_code, barcode_val in rows:
    wms_code = (product_code or barcode_val or "").strip()
    if not wms_code:
        print(f"  [SKIP] id={prod_id} - no product_code or barcode")
        skip += 1
        continue
    try:
        product_url = f"{base_url}/{prod_id}"
        path = generate_qrcode(prod_id, wms_code, product_url, QRCODE_DIR)
        print(f"  [OK] id={prod_id} -> {os.path.basename(path)} ({product_url})")
        ok += 1
    except Exception as exc:
        print(f"  [ERR] id={prod_id}: {exc}")
        err += 1

print(f"\nDone: {ok} generated, {skip} skipped, {err} errors")
