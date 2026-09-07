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

  title: string;
  detail?: string;
}

export const movementFeedService = {
  getFeed: async (): Promise<MovementFeedItem[]> => {
    const res = await apiClient.get<MovementFeedItem[]>("/wms/movement-feed");
    return res.data;
  },
};
