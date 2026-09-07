package wms

import "time"

// MovementFeed: รวมเหตุการณ์ "การเคลื่อนไหวของสินค้า" จากหลายตารางมาเรียงเป็นไทม์ไลน์เดียว
// เริ่มจากฝั่ง WMS ก่อน (ตามที่ตกลงกับเจ้าของร้าน) ต่อมาผสานฝั่งการขาย/คืน-เคลม/พรีออเดอร์เข้ามาด้วย
// (อ่านข้อมูลอย่างเดียวจากตารางของทีมนั้นๆ ไม่ยุ่งกับ business logic เดิม) เป็นประเภทใหม่โดยไม่ต้องแก้โครงสร้าง MovementFeedItem นี้เลย
const (
	MovementFeedProductAdded  = "PRODUCT_ADDED"   // สินค้าถูกเพิ่มเข้าระบบใหม่
	MovementFeedStockIn       = "STOCK_IN"        // สินค้าถูกนำเข้า/รับเพิ่มจากบริษัท
	MovementFeedCheckFlagged  = "CHECK_FLAGGED"   // สินค้าถูกแจ้งเช็คสต็อก
	MovementFeedStockAdjusted = "STOCK_ADJUSTED"  // สต็อกถูกปรับหลังอนุมัติผลเช็คสต็อก (นับได้ไม่ตรงกับระบบ)
	MovementFeedLowStock      = "LOW_STOCK"       // สินค้าใกล้หมด (คงเหลือต่ำกว่าจุดสั่งซื้อ)
	MovementFeedSaleOut       = "SALE_OUT"        // สินค้าถูกขายออกผ่าน POS (ออเดอร์สถานะ completed เท่านั้น)
	MovementFeedSalesReturn   = "SALES_RETURN"    // ลูกค้าคืนสินค้า (อ่านจาก stock_movements ที่ movement_type = RETURN)
	MovementFeedCustomerClaim = "CUSTOMER_CLAIM"  // ลูกค้าแจ้งเคลมสินค้า
	MovementFeedPreOrder      = "PRE_ORDER"       // สร้างพรีออเดอร์สั่งจองสินค้ากับบริษัท
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
