import Fuse, { type IFuseOptions } from "fuse.js";

// ค้นหาแบบ fuzzy (พิมพ์ผิด/สลับตัวอักษร/ขาดตัวอักษรบางส่วนก็ยังเจอได้) แบบทั่วไป
// ใช้กับข้อมูลตั้งค่าต่างๆ (หน่วยสินค้า, โซน/ชั้นวาง, บริษัทสั่งซื้อ, เกรด, ประเภทสินค้า, แบรนด์/รุ่นรถ)
// ต่างจาก utils/productSearch.ts ตรงที่ตัวนี้ generic ใช้ได้กับ entity อะไรก็ได้ที่มี `id`
const DEFAULT_OPTIONS: IFuseOptions<any> = {
  threshold: 0.35, // 0 = ต้องตรงเป๊ะ, 1 = จับคู่ทุกอย่าง — 0.35 คือพิมพ์ผิด/พลาดได้บ้างแต่ไม่หลวมเกินไป
  ignoreLocation: true,
  minMatchCharLength: 1, // ต้องเป็น 1 ไม่ใช่ 2 — ไม่งั้นพิมพ์ตัวอักษรเดียวจะไม่เจออะไรเลย (Fuse จะข้ามคำค้นที่สั้นกว่าค่านี้ทันที)
};

// สร้าง index ไว้แค่ตอนรายการเปลี่ยน (ผู้เรียกควร useMemo แยกจาก query กันสร้างใหม่ทุกครั้งที่พิมพ์)
export function buildFuzzyIndex<T>(items: T[], keys: string[]): Fuse<T> {
  return new Fuse(items, { ...DEFAULT_OPTIONS, keys });
}

// คืนชุด id ของรายการที่ตรงกับคำค้นหา (คืน null เมื่อไม่มีคำค้นหา เพื่อให้ผู้เรียกรู้ว่า "ไม่ได้กรอง" ต่างจาก "กรองแล้วไม่เจอ")
export function fuzzyMatchIds<T extends { id: number }>(index: Fuse<T>, query: string): Set<number> | null {
  const q = query.trim();
  if (!q) return null;
  return new Set(index.search(q).map((r) => r.item.id));
}
