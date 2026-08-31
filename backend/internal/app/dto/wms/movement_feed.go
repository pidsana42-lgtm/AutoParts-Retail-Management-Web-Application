package wms

import "time"

// MovementFeed: รวมเหตุการณ์ "การเคลื่อนไหวของสินค้า" จากหลายตารางมาเรียงเป็นไทม์ไลน์เดียว
// เริ่มจากฝั่ง WMS ก่อน (ตามที่ตกลงกับเจ้าของร้าน) — ส่วนของทีมอื่น เช่น การขาย/ใบสั่งซื้อ/เคลม/พรีออเดอร์
// จะต่อเพิ่มเป็นประเภทใหม่ทีหลังได้ โดยไม่ต้องแก้โครงสร้าง MovementFeedItem นี้เลย
const (
	MovementFeedProductAdded  = "PRODUCT_ADDED"  // สินค้าถูกเพิ่มเข้าระบบใหม่
	MovementFeedStockIn       = "STOCK_IN"       // สินค้าถูกนำเข้า/รับเพิ่มจากบริษัท
	MovementFeedCheckFlagged  = "CHECK_FLAGGED"  // สินค้าถูกแจ้งเช็คสต็อก
	MovementFeedStockAdjusted = "STOCK_ADJUSTED" // สต็อกถูกปรับหลังอนุมัติผลเช็คสต็อก (นับได้ไม่ตรงกับระบบ)
	MovementFeedLowStock      = "LOW_STOCK"      // สินค้าใกล้หมด (คงเหลือต่ำกว่าจุดสั่งซื้อ)
)

type MovementFeedItem struct {
	Type       string    `json:"type"`
	OccurredAt time.Time `json:"occurred_at"`
	RefID      uint      `json:"ref_id"` // id ของ record ต้นทาง (product/stock_movement/check_stock_schedule) ใช้ทำ key หรือลิงก์ต่อ

	ProductID   *uint  `json:"product_id,omitempty"`
	ProductCode string `json:"product_code,omitempty"`
	ProductName string `json:"product_name,omitempty"`
	Quantity    *int   `json:"quantity,omitempty"`

	ActorName    string `json:"actor_name,omitempty"`
	SupplierName string `json:"supplier_name,omitempty"`

	Title  string `json:"title"`
	Detail string `json:"detail,omitempty"`
}
