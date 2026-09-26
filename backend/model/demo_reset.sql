-- ============================================================================
--  เตรียมฐานข้อมูลสำหรับการสาธิตการนำเข้าบิล
--  ใช้กับบิล test-bill/631805084_832656033121850_488610104204139582_n.jpg
--  (บริษัท คอมแพ็ค ยูนิตี้ เทรดดิ้ง จำกัด — 7 รายการ)
--
--  ทำไมต้องมีสคริปต์นี้: บิลใบนี้เคยถูกนำเข้าไปแล้ว ระบบจึงจำคู่จับคู่ไว้ครบทั้ง 7 รายการ
--  เวลาสาธิตจะได้คะแนน 1.000 หมดทุกบรรทัด มองไม่เห็นว่า AI ทำงานตรงไหน และไม่มี
--  รายการไหนเหลือให้เห็นขั้นตอนที่คนต้องตรวจสอบ
--
--  หลังรันสคริปต์นี้ การสาธิตจะแสดงครบทั้ง 3 เส้นทาง:
--     4 รายการ  จับคู่แบบตรงเป๊ะจากคู่ที่เคยยืนยัน   (score 1.000)
--     2 รายการ  จับคู่ด้วยการเทียบความหมาย pgvector  (score 0.95-0.99)
--     1 รายการ  จับคู่ไม่ได้ ต้องให้พนักงานเลือกเอง  (บัตรกำนัล Tesco Lotus)
--
--  ทุกอย่างสำรองไว้ในตาราง demo_backup_* ย้อนกลับได้ด้วย demo_restore.sql
--
--  วิธีใช้:
--     psql -d Autopartsdb -f backend/model/demo_reset.sql
--     แล้วรีสตาร์ต ai-service เพื่อให้สร้าง embedding ใหม่
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. เตรียมตารางสำรอง (สร้างครั้งแรกครั้งเดียว)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demo_backup_corrections AS
    SELECT * FROM product_mapping_corrections WHERE false;

CREATE TABLE IF NOT EXISTS demo_backup_products (
    product_id INTEGER PRIMARY KEY,
    is_active  BOOLEAN
);

-- ---------------------------------------------------------------------------
-- 2. รายการที่จะให้ "จับคู่ด้วยการเทียบความหมาย" แทนการจำคู่เดิม
--    ลบเฉพาะคู่ที่เคยยืนยันของ 2 รายการนี้ ตัวสินค้าในคลังยังอยู่ครบ
--    ระบบจึงต้องใช้ pgvector เทียบ "แม่ปั๊มครัชบน" กับ "แม่ปั๊มดรัชบน/คลัทช์บน" ในคลังเอง
-- ---------------------------------------------------------------------------
INSERT INTO demo_backup_corrections
SELECT c.* FROM product_mapping_corrections c
WHERE (c.ai_product_name ILIKE '%D-MAX TFR/TFS 5/8'
       OR c.ai_product_name ILIKE '%BIG-M TD27%')
  AND NOT EXISTS (SELECT 1 FROM demo_backup_corrections b WHERE b.id = c.id);

DELETE FROM product_mapping_corrections
WHERE ai_product_name ILIKE '%D-MAX TFR/TFS 5/8'
   OR ai_product_name ILIKE '%BIG-M TD27%';

-- ---------------------------------------------------------------------------
-- 3. รายการที่จะให้ "จับคู่ไม่ได้ ต้องให้คนตรวจ"
--    เลือกบัตรกำนัล Tesco Lotus เพราะเป็นของแถม ไม่ใช่อะไหล่ เป็นเหตุผลที่สมจริง
--    ที่ร้านจะยังไม่มีในระบบ — ลบคู่ที่เคยยืนยันและปิดการใช้งานสินค้าในคลัง
-- ---------------------------------------------------------------------------
INSERT INTO demo_backup_corrections
SELECT c.* FROM product_mapping_corrections c
WHERE c.ai_product_name ILIKE '%Tesco Lotus%'
  AND NOT EXISTS (SELECT 1 FROM demo_backup_corrections b WHERE b.id = c.id);

DELETE FROM product_mapping_corrections WHERE ai_product_name ILIKE '%Tesco Lotus%';

INSERT INTO demo_backup_products (product_id, is_active)
SELECT id, is_active FROM products WHERE product_name ILIKE '%Tesco Lotus%'
ON CONFLICT (product_id) DO NOTHING;

UPDATE products SET is_active = false WHERE product_name ILIKE '%Tesco Lotus%';

-- ---------------------------------------------------------------------------
-- 4. ล้างแคชเวกเตอร์ของแถวที่ถูกลบ/ปิดไป
--    ai-service จะสร้างใหม่ให้เองตอนสตาร์ต (ดู ProductMatcher.fit)
-- ---------------------------------------------------------------------------
DELETE FROM product_embeddings;

COMMIT;

\echo ''
\echo '── สถานะหลังเตรียมข้อมูลสาธิต ──'
SELECT
    (SELECT count(*) FROM demo_backup_corrections)                      AS "คู่ที่สำรองไว้",
    (SELECT count(*) FROM product_mapping_corrections)                  AS "คู่ที่เหลือในระบบ",
    (SELECT count(*) FROM products WHERE is_active AND deleted_at IS NULL) AS "สินค้าที่ใช้งานอยู่";
\echo ''
\echo 'ขั้นต่อไป: รีสตาร์ต ai-service เพื่อสร้าง embedding ใหม่'
\echo '  pm2 restart ai-fastapi-api      (หรือ docker compose restart ai-service)'
\echo 'ย้อนกลับ: psql -d Autopartsdb -f backend/model/demo_restore.sql'
\echo ''
