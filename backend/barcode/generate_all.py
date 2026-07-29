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

DB = dict(host="localhost", port=5432, user="postgres", password="1234", dbname="Autopartsdb")
BARCODE_DIR = os.path.dirname(os.path.abspath(__file__))

conn = psycopg2.connect(**DB)
cur = conn.cursor()
cur.execute("SELECT id, product_code, barcode FROM products ORDER BY id")
rows = cur.fetchall()
cur.close()
conn.close()

print(f"Found {len(rows)} products. Generating barcodes...")
ok, skip, err = 0, 0, 0

for prod_id, product_code, barcode_val in rows:
    wms_code = (barcode_val or product_code or "").strip()
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
