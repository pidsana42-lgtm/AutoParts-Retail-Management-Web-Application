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

// หาสินค้าที่เข้าเงื่อนไขพื้นที่จัดเก็บ/หมวดหมู่ที่เลือกไว้ (สำหรับพรีวิว "สินค้าที่เกี่ยวข้อง")
export function getRelatedProducts(
  checkType: "LOCATION" | "CATEGORY" | "PRODUCT",
  selectedZonePath: string,
  categoryId: string,
  products: StockItem[],
  zones: any[],
  categories: any[]
): StockItem[] {
  if (checkType === "LOCATION" && selectedZonePath) {
    if (selectedZonePath.startsWith("level-")) {
      const id = parseInt(selectedZonePath.replace("level-", ""));
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
    if (selectedZonePath.startsWith("shelf-")) {
      const id = parseInt(selectedZonePath.replace("shelf-", ""));
      let shelfName = "";
      zones.forEach((z: any) =>
        z.shelves?.forEach((s: any) => {
          if ((s.ID || s.id) === id) shelfName = s.shelf_name;
        })
      );
      return products.filter((p) => p.Shelf === shelfName);
    }
    if (selectedZonePath.startsWith("zone-")) {
      const id = parseInt(selectedZonePath.replace("zone-", ""));
      const shelfNames: string[] = [];
      zones.forEach((z: any) => {
        if ((z.ID || z.id) === id) z.shelves?.forEach((s: any) => shelfNames.push(s.shelf_name));
      });
      return products.filter((p) => shelfNames.includes(p.Shelf || ""));
    }
  } else if (checkType === "CATEGORY" && categoryId) {
    if (categoryId.startsWith("subsubcategory-")) {
      const id = parseInt(categoryId.replace("subsubcategory-", ""));
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
    if (categoryId.startsWith("subcategory-")) {
      const id = parseInt(categoryId.replace("subcategory-", ""));
      let scName = "";
      categories.forEach((c: any) =>
        c.sub_categories?.forEach((sc: any) => {
          if ((sc.ID || sc.id) === id) scName = sc.sub_category_name;
        })
      );
      return products.filter((p) => p.SubCategory === scName);
    }
    if (categoryId.startsWith("category-")) {
      const id = parseInt(categoryId.replace("category-", ""));
      let cName = "";
      categories.forEach((c: any) => {
        if ((c.ID || c.id) === id) cName = c.category_name;
      });
      return products.filter((p) => p.Category === cName);
    }
  }
  return [];
}

// สินค้าที่ตารางเช็คสต็อกที่บันทึกไว้แล้ว "ครอบคลุมจริง" — สร้าง path จาก id ที่เก็บไว้ในตาราง
// (zone_id/shelf_id/shelf_level_id/category_id/...) แล้วรียูส getRelatedProducts ตัวเดียวกับตอนสร้าง/แก้ไข
// ใช้ทั้งหน้ารายการเช็คสต็อก (ค้นหา/กรองโซน) และหน้ารายละเอียดตาราง
export function getScheduleProducts(
  schedule: Pick<
    CheckStockSchedule,
    "check_type" | "product_id" | "zone_id" | "shelf_id" | "shelf_level_id" | "category_id" | "sub_category_id" | "sub_sub_category_id"
  >,
  products: StockItem[],
  zones: any[],
  categories: any[]
): StockItem[] {
  if (schedule.check_type === "PRODUCT") {
    const p = products.find((p) => p.ID === schedule.product_id);
    return p ? [p] : [];
  }

  const selectedZonePath = schedule.shelf_level_id
    ? `level-${schedule.shelf_level_id}`
    : schedule.shelf_id
      ? `shelf-${schedule.shelf_id}`
      : schedule.zone_id
        ? `zone-${schedule.zone_id}`
        : "";

  const categoryId = schedule.sub_sub_category_id
    ? `subsubcategory-${schedule.sub_sub_category_id}`
    : schedule.sub_category_id
      ? `subcategory-${schedule.sub_category_id}`
      : schedule.category_id
        ? `category-${schedule.category_id}`
        : "";

  return getRelatedProducts(schedule.check_type, selectedZonePath, categoryId, products, zones, categories);
}
