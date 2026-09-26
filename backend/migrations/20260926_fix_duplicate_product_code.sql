-- ============================================================================
--  แก้รหัสสินค้าซ้ำ และกันไม่ให้เกิดซ้ำอีก
--
--  ที่มา: entity/products.go BeforeCreate() เดิมสร้างเลขรันจาก "จำนวนแถวในชุดหมวดหมู่"
--  (category, sub_category, sub_sub_category) แล้วบวกหนึ่ง แต่คนละชุดหมวดหมู่สามารถให้
--  prefix เดียวกันได้ เช่นตอนสร้างสินค้า lookup หมวดย่อยไม่เจอ prefix ของหมวดย่อยจะว่าง
--  แต่ละชุดจึงนับเลขของตัวเองแยกกันแล้วออกรหัสชนกัน
--
--  ผลกระทบ: match_product() ขั้นแรกเทียบรหัสแบบตรงตัวแล้วคืนสินค้าตัวแรกที่เจอด้วยคะแนน
--  1.0 ทันที ถ้ารหัสซ้ำก็จะคืนสินค้าผิดตัวโดยดูน่าเชื่อถือที่สุด ของอาจเข้าสต็อกผิดตัว
--
--  โค้ดถูกแก้ให้อ้างเลขสูงสุดของ prefix แทนแล้ว สคริปต์นี้จัดการข้อมูลที่ซ้ำไปแล้ว
--  ปลอดภัยแม้รันซ้ำหลายครั้ง
--
--  วิธีใช้:
--     psql -d Autopartsdb -f backend/migrations/20260926_fix_duplicate_product_code.sql
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. สำรองรหัสเดิมไว้ก่อน เผื่อต้องย้อนกลับหรือไล่ดูว่าตัวไหนถูกเปลี่ยน
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_code_rename_log (
    product_id   INTEGER PRIMARY KEY,
    old_code     VARCHAR(255) NOT NULL,
    new_code     VARCHAR(255) NOT NULL,
    renamed_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- 2. ตั้งรหัสใหม่ให้แถวที่ซ้ำ
--    เก็บแถวที่ id น้อยที่สุดของแต่ละรหัสไว้เหมือนเดิม (ตัวที่มีมาก่อน) แล้วไล่ตั้งรหัสใหม่
--    ให้แถวที่เหลือ โดยต่อจากเลขสูงสุดที่เคยใช้กับ prefix เดียวกัน — ตรรกะเดียวกับที่
--    BeforeCreate() ใช้ตอนนี้
-- ---------------------------------------------------------------------------
WITH dup AS (
    SELECT id, product_code,
           split_part(product_code, '-', 1) AS prefix,
           row_number() OVER (PARTITION BY product_code ORDER BY id) AS rn
    FROM products
    WHERE deleted_at IS NULL
),
to_rename AS (
    SELECT id, product_code AS old_code, prefix,
           row_number() OVER (PARTITION BY prefix ORDER BY id) AS offset_in_prefix
    FROM dup
    WHERE rn > 1                      -- แถวแรกของแต่ละรหัสไม่ต้องแตะ
),
prefix_max AS (
    SELECT split_part(product_code, '-', 1) AS prefix,
           COALESCE(MAX(NULLIF(substring(product_code from '[0-9]+$'), '')::bigint), 0) AS max_suffix
    FROM products                      -- นับรวมแถวที่ถูกลบด้วย จะได้ไม่เอารหัสเดิมกลับมาใช้
    GROUP BY 1
),
assigned AS (
    SELECT r.id, r.old_code,
           r.prefix || '-' || lpad((m.max_suffix + r.offset_in_prefix)::text, 5, '0') AS new_code
    FROM to_rename r
    JOIN prefix_max m ON m.prefix = r.prefix
)
INSERT INTO product_code_rename_log (product_id, old_code, new_code)
SELECT id, old_code, new_code FROM assigned
ON CONFLICT (product_id) DO NOTHING;

UPDATE products p
SET product_code = l.new_code
FROM product_code_rename_log l
WHERE p.id = l.product_id AND p.product_code = l.old_code;

-- ---------------------------------------------------------------------------
-- 3. กันไม่ให้ซ้ำอีก — unique เฉพาะแถวที่ยังไม่ถูกลบ
--    (แถวที่ soft delete แล้วปล่อยให้ซ้ำได้ ไม่งั้นการลบ-สร้างใหม่จะติดขัด)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_product_code_active
    ON products (product_code)
    WHERE deleted_at IS NULL;

COMMIT;

\echo ''
\echo '── ผลลัพธ์ ──'
SELECT product_id, old_code, new_code FROM product_code_rename_log ORDER BY product_id;
SELECT count(*) AS "รหัสที่ยังซ้ำอยู่ (ต้องเป็น 0)"
FROM (SELECT product_code FROM products WHERE deleted_at IS NULL
      GROUP BY 1 HAVING count(*) > 1) t;
\echo ''
