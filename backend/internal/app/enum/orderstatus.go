package enum

type OrderStatus string

const (
	OrderPending       OrderStatus = "pending"
	OrderPendingCancel OrderStatus = "pending_cancel"
	OrderCompleted     OrderStatus = "completed"
	OrderCancelled     OrderStatus = "cancelled"
	OrderReturned      OrderStatus = "returned"
	// OrderPartialReturned: คืนสินค้าไปแล้วบางส่วน ยังมีของในออเดอร์ที่ยังไม่ถูกคืน
	// ค่าที่เก็บจริงเป็นตัวพิมพ์ใหญ่ตามข้อมูลเดิมในฐานข้อมูล จุดที่นำไปเทียบจึงต้องผ่าน LOWER() เสมอ
	OrderPartialReturned OrderStatus = "PARTIAL_RETURNED"
	OrderRefunded        OrderStatus = "refunded"
	OrderClaimed         OrderStatus = "claimed"
)
