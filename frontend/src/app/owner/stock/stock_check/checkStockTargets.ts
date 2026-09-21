import type { CascaderOption } from "../../../../components/elements/cascader";
import type { StockItem } from "../../../../interface/wms/product";
import type { CheckStockSchedule } from "../../../../service/http/wms/stock_check_service";

// เช็คว่า timestamp ที่ backend ส่งมาเป็นค่าจริงหรือเป็นค่าว่าง (Go zero value "0001-01-01T00:00:00Z")
// ตารางเก่าบางอันที่ยังไม่เคยตั้งเวลาสิ้นสุดไว้จะได้ค่านี้มา ถ้าเอาไปเทียบเวลาตรงๆ จะเข้าใจผิดว่า "หมดเขตไปแล้ว" ตลอดกาล
export function isValidScheduleDate(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !isNaN(d.getTime()) && d.getFullYear() > 1970;
}

// ตารางเลยเวลาสิ้นสุดที่กำหนดไว้แล้ว แต่พนักงานยังไม่ส่งผลนับมา (ค้างอยู่ที่ "กำลังเช็ค") — ใช้ร่วมกันทั้งฝั่ง
// เจ้าของร้าน (โชว์ตัวเตือน + ปลดล็อกให้แก้ไข/สั่งงานซ้ำได้) และฝั่งพนักงาน (ปิดปุ่มเริ่มนับสต็อก)
export function isScheduleOverdue(sc: Pick<CheckStockSchedule, "status" | "scheduled_end_datetime">): boolean {
  return sc.status === "กำลังเช็ค" && isValidScheduleDate(sc.scheduled_end_datetime) && new Date() > new Date(sc.scheduled_end_datetime);
}

// สี badge ของสถานะตารางเช็คสต็อก ใช้ร่วมกันทั้งฝั่งเจ้าของร้านและพนักงาน กันลืมอัพเดตไม่ครบตอนเพิ่มสถานะใหม่
export const CHECK_STATUS_BADGE_VARIANT: Record<string, "neutral" | "error" | "info" | "success"> = {
  "รอดำเนินการ": "neutral",
  "กำลังเช็ค": "error",
  "รอตรวจสอบ": "info",
  "เสร็จสิ้น": "success",
};

// สร้าง cascader tree: โซน -> ตู้/ชั้นวาง -> ระดับชั้น (ใช้ร่วมกันทั้งหน้าเพิ่ม/แก้ไขตารางเช็คสต็อก)
export function buildZoneTree(zones: any[]): CascaderOption[] {
  return zones.map((z: any) => ({
    value: `zone-${z.ID || z.id}`,
    label: z.zone_name,
    children: z.shelves?.map((s: any) => ({
      value: `shelf-${s.ID || s.id}`,
      label: s.shelf_name,
      children: s.shelf_levels?.map((l: any) => ({
        value: `level-${l.ID || l.id}`,
        label: l.level_name,
      })),
    })),
  }));
}

// สร้าง cascader tree: ประเภทหลัก -> ประเภทย่อย -> ประเภทย่อยย่อย
export function buildCategoryTree(categories: any[]): CascaderOption[] {
  return categories.map((c: any) => ({
    value: `category-${c.ID || c.id}`,
    label: c.category_name,
    children: c.sub_categories?.map((sc: any) => ({
      value: `subcategory-${sc.ID || sc.id}`,
      label: sc.sub_category_name,
      children: sc.sub_sub_categories?.map((ssc: any) => ({
        value: `subsubcategory-${ssc.ID || ssc.id}`,
        label: ssc.sub_sub_category_name,
      })),
    })),
  }));
}

// resolveLocationPath/resolveCategoryPath: หาสินค้าที่ตรงกับเป้าหมาย 1 จุด (path เดียว) — getRelatedProducts
// ด้านล่าง union ผลลัพธ์จากหลาย path เข้าด้วยกัน เพื่อรองรับเลือกได้หลายโซน/หลายหมวดหมู่พร้อมกันในตารางเดียว
function resolveLocationPath(path: string, products: StockItem[], zones: any[]): StockItem[] {
  if (path.startsWith("level-")) {
    const id = parseInt(path.replace("level-", ""));
    let levelName = "";
    zones.forEach((z: any) =>
      z.shelves?.forEach((s: any) =>
        s.shelf_levels?.forEach((l: any) => {
          if ((l.ID || l.id) === id) levelName = l.level_name;
        })
      )
    );
    return products.filter((p) => p.ShelfLevel === levelName);
  }
  if (path.startsWith("shelf-")) {
    const id = parseInt(path.replace("shelf-", ""));
    let shelfName = "";
    zones.forEach((z: any) =>
      z.shelves?.forEach((s: any) => {
        if ((s.ID || s.id) === id) shelfName = s.shelf_name;
      })
    );
    return products.filter((p) => p.Shelf === shelfName);
  }
  if (path.startsWith("zone-")) {
    const id = parseInt(path.replace("zone-", ""));
    const shelfNames: string[] = [];
    zones.forEach((z: any) => {
      if ((z.ID || z.id) === id) z.shelves?.forEach((s: any) => shelfNames.push(s.shelf_name));
    });
    return products.filter((p) => shelfNames.includes(p.Shelf || ""));
  }
  return [];
}

function resolveCategoryPath(path: string, products: StockItem[], categories: any[]): StockItem[] {
  if (path.startsWith("subsubcategory-")) {
    const id = parseInt(path.replace("subsubcategory-", ""));
    let sscName = "";
    categories.forEach((c: any) =>
      c.sub_categories?.forEach((sc: any) =>
        sc.sub_sub_categories?.forEach((ssc: any) => {
          if ((ssc.ID || ssc.id) === id) sscName = ssc.sub_sub_category_name;
        })
      )
    );
    return products.filter((p) => p.SubSubCategory === sscName);
  }
  if (path.startsWith("subcategory-")) {
    const id = parseInt(path.replace("subcategory-", ""));
    let scName = "";
    categories.forEach((c: any) =>
      c.sub_categories?.forEach((sc: any) => {
        if ((sc.ID || sc.id) === id) scName = sc.sub_category_name;
      })
    );
    return products.filter((p) => p.SubCategory === scName);
  }
  if (path.startsWith("category-")) {
    const id = parseInt(path.replace("category-", ""));
    let cName = "";
    categories.forEach((c: any) => {
      if ((c.ID || c.id) === id) cName = c.category_name;
    });
    return products.filter((p) => p.Category === cName);
  }
  return [];
}

// หาสินค้าที่เข้าเงื่อนไขพื้นที่จัดเก็บ/หมวดหมู่ที่เลือกไว้ (สำหรับพรีวิว "สินค้าที่เกี่ยวข้อง") — เลือกได้หลายจุด
// พร้อมกัน (selectedZonePaths/categoryPaths เป็น array) ผลลัพธ์คือ union ของทุกจุดที่เลือกไว้ (สินค้าตรงจุดใดจุดหนึ่ง
// ก็ติด ไม่ต้องตรงทุกจุด) — ยังใช้กับกรณีเลือกจุดเดียวได้เหมือนเดิม แค่ส่ง array 1 ช่อง
export function getRelatedProducts(
  checkType: "LOCATION" | "CATEGORY" | "PRODUCT",
  selectedZonePaths: string[],
  categoryPaths: string[],
  products: StockItem[],
  zones: any[],
  categories: any[]
): StockItem[] {
  if (checkType === "LOCATION" && selectedZonePaths.length > 0) {
    const matchedIds = new Set<number>();
    for (const path of selectedZonePaths) {
      resolveLocationPath(path, products, zones).forEach((p) => matchedIds.add(p.ID));
    }
    return products.filter((p) => matchedIds.has(p.ID));
  }
  if (checkType === "CATEGORY" && categoryPaths.length > 0) {
    const matchedIds = new Set<number>();
    for (const path of categoryPaths) {
      resolveCategoryPath(path, products, categories).forEach((p) => matchedIds.add(p.ID));
    }
    return products.filter((p) => matchedIds.has(p.ID));
  }
  return [];
}

// สินค้าที่ตารางเช็คสต็อกที่บันทึกไว้แล้ว "ครอบคลุมจริง" — สร้าง path จาก id ที่เก็บไว้ในตาราง (รองรับหลายเป้าหมาย
// พร้อมกัน) แล้วรียูส getRelatedProducts ตัวเดียวกับตอนสร้าง/แก้ไข จากนั้นหักสินค้าที่เจ้าของร้านเอาออกเองออกไป
// ใช้ทั้งหน้ารายการเช็คสต็อก (ค้นหา/กรองโซน) และหน้ารายละเอียดตาราง
export function getScheduleProducts(
  schedule: Pick<
    CheckStockSchedule,
    | "check_type"
    | "product_ids"
    | "zone_ids"
    | "shelf_ids"
    | "shelf_level_ids"
    | "category_ids"
    | "sub_category_ids"
    | "sub_sub_category_ids"
    | "excluded_product_ids"
  >,
  products: StockItem[],
  zones: any[],
  categories: any[]
): StockItem[] {
  if (schedule.check_type === "PRODUCT") {
    const ids = new Set(schedule.product_ids || []);
    return products.filter((p) => ids.has(p.ID));
  }

  const zonePaths = [
    ...(schedule.shelf_level_ids || []).map((id) => `level-${id}`),
    ...(schedule.shelf_ids || []).map((id) => `shelf-${id}`),
    ...(schedule.zone_ids || []).map((id) => `zone-${id}`),
  ];
  const categoryPaths = [
    ...(schedule.sub_sub_category_ids || []).map((id) => `subsubcategory-${id}`),
    ...(schedule.sub_category_ids || []).map((id) => `subcategory-${id}`),
    ...(schedule.category_ids || []).map((id) => `category-${id}`),
  ];

  const related = getRelatedProducts(schedule.check_type, zonePaths, categoryPaths, products, zones, categories);
  const excluded = schedule.excluded_product_ids;
  if (!excluded || excluded.length === 0) return related;
  const excludedSet = new Set(excluded);
  return related.filter((p) => !excludedSet.has(p.ID));
}
