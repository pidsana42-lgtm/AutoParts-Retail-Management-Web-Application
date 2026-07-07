package pos

type CreateSaleOrderRequest struct {
	CustomerID        uint   `json:"customer_id"`      // ID ของลูกค้าที่เลือก 
	PaymentMethodID   uint   `json:"payment_method_id" binding:"required"` // ID วิธีชำระเงิน (1=เงินสด, 2=QR, 3=เงินเชื่อ)
	
	CustomerNameTemp        string `json:"customer_name"`         // ชื่อลูกค้า (สำหรับบิลใบเสร็จ)
	CustomerPhoneTemp       string `json:"customer_phone"`        // เบอร์โทรลูกค้า (สำหรับบิลใบเสร็จ)
	// ส่วนลดท้ายบิลรวม (จากแถบสีดำตรงกลางจอ)
	BillDiscountType  string  `json:"bill_discount_type" binding:"required"` // 'none' (ไม่ลด), 'percentage' (ลด%), 'amount' (ลดบาท)
	BillDiscountValue float64 `json:"bill_discount_value"`                   // ค่าตัวเลขส่วนลดท้ายบิลที่พนักงานคีย์ลงไป

	Note string `json:"note"` // หมายเหตุเพิ่มเติม 

	// ตะกร้าสินค้า มัดรวมรายการอะไหล่ทั้งหมดที่กำลังจะขายส่งมาเป็น Array
	Items []SaleOrderItemRequest `json:"items" binding:"required,gt=0"` // binding gt=0 บังคับว่าต้องมีสินค้าอย่างน้อย 1 ชิ้นในบิล
}

// โครงสร้างของสินค้าแต่ละบรรทัดในตะกร้า
type SaleOrderItemRequest struct {
	ProductID   uint    `json:"product_id" binding:"required"`   // ID สินค้าในเบส เพื่อเอาไปเช็คสต็อกและราคาทุน
	ProductName string  `json:"product_name" binding:"required"` // ชื่อสินค้า
	Qty         int     `json:"qty" binding:"required,min=1"`    // จำนวนที่ซื้อ บังคับขั้นต่ำ 1 ชิ้น
	UnitPrice   float64 `json:"unit_price" binding:"required"`   // ราคาขายต่อหน่วย ณ ตอนนั้น

	// ส่วนลดรายบรรทัด (จากช่องติ๊กถูก DISC? ในตาราง)
	DiscountType  string  `json:"discount_type" binding:"required"` // 'none', 'percentage', 'amount'
	DiscountValue float64 `json:"discount_value"`                   // ค่าตัวเลขส่วนลดรายชิ้นที่พนักงานกรอก
}