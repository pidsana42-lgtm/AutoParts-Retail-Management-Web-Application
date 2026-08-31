import Fuse, { type IFuseOptions } from "fuse.js";
import type { StockItem } from "../interface/wms/product";

// ค้นหาสินค้าแบบ fuzzy (พิมพ์ผิด/สลับตัวอักษร/ขาดตัวอักษรบางส่วนก็ยังเจอได้) ใช้ร่วมกันทุกช่องค้นหาสินค้าในระบบ
// (Navbar ค้นหาข้ามระบบ, หน้ารายการสินค้า, หน้าถังขยะ) — ทำงานฝั่ง client ล้วนๆ จากรายการสินค้าที่โหลดมาอยู่แล้ว
const FUSE_OPTIONS: IFuseOptions<StockItem> = {
  keys: [
    { name: "Name", weight: 3 },
    { name: "ProductCode", weight: 2.5 },
    { name: "PartNo", weight: 2 },
    { name: "Barcode", weight: 1.5 },
    { name: "Models.model_name", weight: 1.5 },
    { name: "Models.brand_name", weight: 1 },
  ],
  threshold: 0.35, // 0 = ต้องตรงเป๊ะ, 1 = จับคู่ทุกอย่าง — 0.35 คือพิมพ์ผิด/พลาดได้บ้างแต่ไม่หลวมจนขึ้นสินค้าไม่เกี่ยวข้อง
  ignoreLocation: true, // ไม่สนใจว่าคำค้นอยู่ตำแหน่งไหนของข้อความ (ตรงต้น/กลาง/ท้ายก็เจอ)
  minMatchCharLength: 1, // ต้องเป็น 1 ไม่ใช่ 2 — ไม่งั้นพิมพ์ตัวอักษรเดียวจะไม่เจออะไรเลย (Fuse จะข้ามคำค้นที่สั้นกว่าค่านี้ทันที)
};

// แยกขั้นตอน "สร้าง index" ออกจาก "ค้นหา" เพราะ index (Fuse instance) ควรสร้างใหม่แค่ตอนรายการสินค้าเปลี่ยน
// (เช่น โหลดข้อมูลเสร็จ) ไม่ใช่สร้างใหม่ทุกครั้งที่พิมพ์แต่ละตัวอักษร — ผู้เรียกควร useMemo ตัว index แยกจาก query
export function buildProductSearchIndex(products: StockItem[]): Fuse<StockItem> {
  return new Fuse(products, FUSE_OPTIONS);
}

export function searchProductIndex(index: Fuse<StockItem>, query: string, products: StockItem[]): StockItem[] {
  const q = query.trim();
  if (!q) return products;
  return index.search(q).map((result) => result.item);
}
