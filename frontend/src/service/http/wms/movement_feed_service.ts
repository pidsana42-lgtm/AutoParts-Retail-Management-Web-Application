import apiClient from "../apiClient";

// ประเภทเหตุการณ์ในฟีด "การเคลื่อนไหวของสินค้า" — ครอบคลุมทั้งฝั่ง WMS และฝั่งขาย/คืน-เคลม/พรีออเดอร์แล้ว
export type MovementFeedType =
  | "PRODUCT_ADDED"
  | "STOCK_IN"
  | "CHECK_FLAGGED"
  | "STOCK_ADJUSTED"
  | "LOW_STOCK"
  | "SALE_OUT"
  | "SALES_RETURN"
  | "CUSTOMER_CLAIM"
  | "PRE_ORDER";

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

  // link_path: URL หน้ารายละเอียดของเหตุการณ์นี้ — backend คำนวณมาให้เสร็จแล้ว (รู้ id เอกสารหลักจริงอยู่แล้ว
  // ไม่ใช่แค่ ref_id ที่อาจเป็นแค่ id รายการย่อย) ไม่ต้องมาคำนวณ/รู้จัก route ของแต่ละโดเมนเองฝั่งนี้อีก
  // ว่างเปล่า/ไม่มีค่า = ไม่มีหน้ารายละเอียดให้กด
  link_path?: string;
  // link_state: state เสริมที่ต้องส่งไปพร้อม navigate() เช่น {"from":"movement"} ให้หน้าปลายทางปรับเกล็ดขนมปัง
  link_state?: Record<string, string>;

  title: string;
  detail?: string;
}

export const movementFeedService = {
  getFeed: async (): Promise<MovementFeedItem[]> => {
    const res = await apiClient.get<MovementFeedItem[]>("/wms/movement-feed");
    return res.data;
  },
};
