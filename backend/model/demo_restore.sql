-- ============================================================================
--  คืนฐานข้อมูลกลับสู่สภาพก่อนเตรียมสาธิต (ย้อน demo_reset.sql)
--
--  คืนคู่จับคู่ที่ถูกลบไปทั้งหมด และเปิดการใช้งานสินค้าที่ถูกปิดไว้
--  ปลอดภัยแม้จะรันซ้ำหลายครั้ง และแม้จะมีการนำเข้าบิลไปแล้วระหว่างนั้น
--  (คู่ที่ระบบเรียนรู้ใหม่ระหว่างสาธิตจะไม่ถูกลบ)
--
--  วิธีใช้:
--     psql -d Autopartsdb -f backend/model/demo_restore.sql
--     แล้วรีสตาร์ต ai-service
-- ============================================================================

BEGIN;

-- คืนคู่ที่เคยยืนยันกลับเข้าตารางหลัก
-- ON CONFLICT กันกรณีที่ระหว่างสาธิตมีการนำเข้าบิลจนระบบเรียนรู้คู่เดิมกลับมาแล้ว
INSERT INTO product_mapping_corrections
    (id, supplier_id, ai_product_name, ai_product_code, user_product_name, user_product_code, product_id, created_at, updated_at)
SELECT id, supplier_id, ai_product_name, ai_product_code, user_product_name, user_product_code, product_id, created_at, updated_at
FROM demo_backup_corrections
ON CONFLICT (supplier_id, ai_product_name, ai_product_code) DO NOTHING;

-- ไม่ให้ลำดับ id ชนกับแถวที่คืนกลับมา
SELECT setval(pg_get_serial_sequence('product_mapping_corrections', 'id'),
              GREATEST((SELECT COALESCE(MAX(id), 1) FROM product_mapping_corrections), 1));

-- เปิดการใช้งานสินค้าที่ถูกปิดไว้ตอนเตรียมสาธิต
UPDATE products p SET is_active = b.is_active
FROM demo_backup_products b
WHERE p.id = b.product_id;

-- เคลียร์ตารางสำรองและแคชเวกเตอร์ ai-service จะสร้างใหม่ตอนสตาร์ต
DELETE FROM demo_backup_corrections;
DELETE FROM demo_backup_products;
DELETE FROM product_embeddings;

COMMIT;

\echo ''
\echo '── คืนสภาพเรียบร้อย ──'
SELECT
    (SELECT count(*) FROM product_mapping_corrections)                  AS "คู่ที่เคยยืนยัน",
    (SELECT count(*) FROM products WHERE is_active AND deleted_at IS NULL) AS "สินค้าที่ใช้งานอยู่";
\echo ''
\echo 'ขั้นต่อไป: รีสตาร์ต ai-service  (pm2 restart ai-fastapi-api)'
\echo ''
