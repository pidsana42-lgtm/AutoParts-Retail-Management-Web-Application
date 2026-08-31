import apiClient from "../apiClient";

// ประเภทเหตุการณ์ในฟีด "การเคลื่อนไหวของสินค้า" — ชุดนี้เป็นฝั่ง WMS ที่ดึงข้อมูลจริงแล้ว
// ส่วนขาย/คืน-เคลม/พรีออเดอร์ เป็นของทีมอื่นตาม work.md จะต่อเพิ่มเป็นประเภทใหม่ทีหลังได้โดยไม่ต้องแก้โครงสร้างนี้
export type MovementFeedType =
  | "PRODUCT_ADDED"
  | "STOCK_IN"
  | "CHECK_FLAGGED"
  | "STOCK_ADJUSTED"
  | "LOW_STOCK";

export interface MovementFeedItem {
  type: MovementFeedType;
  occurred_at: string;
  ref_id: number;

  product_id?: number;
  product_code?: string;
  product_name?: string;
  quantity?: number;

  actor_name?: string;
  supplier_name?: string;

  title: string;
  detail?: string;
}

export const movementFeedService = {
  getFeed: async (): Promise<MovementFeedItem[]> => {
    const res = await apiClient.get<MovementFeedItem[]>("/wms/movement-feed");
    return res.data;
  },
};
