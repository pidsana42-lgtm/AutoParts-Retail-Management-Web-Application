package pos

import "backend/internal/app/entity"
import "time"

type CreateSaleOrderRequest struct {
	CustomerID      uint       `json:"customer_id"`                          // ID ของลูกค้าที่เลือก
	PaymentMethodID uint       `json:"payment_method_id" binding:"required"` // ID วิธีชำระเงิน (1=เงินสด, 2=QR, 3=เงินเชื่อ)
	DueDate         *time.Time `gorm:"type:datetime" json:"due_date"`

	CustomerNameTemp  string `json:"customer_name_temp"`
	CustomerPhoneTemp string `json:"customer_phone_temp"`
	// ส่วนลดท้ายบิลรวม (จากแถบสีดำตรงกลางจอ)
	BillDiscountType  string  `json:"bill_discount_type" binding:"required"` // 'none' (ไม่ลด), 'percentage' (ลด%), 'amount' (ลดบาท)
	BillDiscountValue float64 `json:"bill_discount_value"`                   // ค่าตัวเลขส่วนลดท้ายบิลที่พนักงานคีย์ลงไป

	ReceivedAmount float64 `json:"received_amount"`

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

type PaymentMethodResponse struct {
	ID         int    `json:"id"`
	MethodName string `json:"method_name"`
}

func ToPaymentMethodResponseList(methods []entity.PaymentMethod) []PaymentMethodResponse {
	list := []PaymentMethodResponse{}
	for _, m := range methods {
		list = append(list, PaymentMethodResponse{
			ID:         int(m.ID),
			MethodName: m.MethodName,
		})
	}
	return list
}

// DTO สำหรับรายการสินค้าแต่ละชิ้นในบิล (Item Detail)
type SaleHistoryItemDetail struct {
	ID          uint   `json:"id"`
	ProductID   uint   `json:"product_id"`
	PartNumber  string `json:"part_number"`
	ProductName string `json:"product_name"`
	Qty         int    `json:"qty"`
	Unit        string `json:"unit"`
	//CostPrice             float64 `json:"cost_price"` น่าจะไม่ต้องใส่เพราะก็ไม่ควรมีใครเห็นรึเปล่า
	UnitPrice             float64 `json:"unit_price"`
	DiscountType          string  `json:"discount_type"`
	DiscountValue         float64 `json:"discount_value"`
	DiscountPercent       float64 `json:"discount_percent"`
	DiscountAmount        float64 `json:"discount_amount"`
	FinalUnitPrice        float64 `json:"final_unit_price"`
	Subtotal              float64 `json:"subtotal"`
	AllocatedBillDiscount float64 `json:"allocated_bill_discount"`
	NetSubtotal           float64 `json:"net_subtotal"`
	Note                  string  `json:"note"`
}

// DTO สำหรับตอบกลับภาพรวมทั้งบิลตาม ID
type GetSaleHistoryByIDResponse struct {
	ID          uint      `json:"id"`
	OrderNumber string    `json:"order_number"`
	OrderDate   time.Time `json:"order_date"`

	CustomerID        *uint   `json:"customer_id"`
	CustomerName      string  `json:"customer_name"`
	CustomerNameTemp  *string `json:"customer_name_temp"`
	CustomerPhoneTemp *string `json:"customer_phone_temp"`

	Subtotal           float64 `json:"subtotal"`             // ยอดรวมก่อนหักส่วนลดบิล
	BillDiscountType   string  `son:"bill_discount_type"`    // ประเภทส่วนลดท้ายบิล (none, amount, percent)
	BillDiscountValue  float64 `json:"bill_discount_value"`  // ส่วนลดท้ายบิล
	DiscountAmount     float64 `json:"discount_amount"`      // มูลค่าส่วนลดท้ายบิล (บาท)
	DiscountPercent    float64 `json:"discount_percent"`     // มูลค่าส่วนลดท้ายบิล (%)
	TotalDiscountItems float64 `json:"total_discount_items"` // เพิ่ม: ผลรวมส่วนลดรายชิ้นสะสมทั้งหมด
	TotalAmount        float64 `json:"total_amount"`         // ยอดเน็ตสุทธิ (Subtotal - DiscountAmount)
	ReceivedAmount     float64 `json:"received_amount"`      // ยอดเงินที่ลูกค้าจ่ายเข้ามา (รวมทุกช่องทาง)
	PaidAmount         float64 `json:"paid_amount"`          // ยอดเงินสุทธิที่หักเงินทอนแล้วและเข้ากระเป๋าร้านจริง (สูงสุดไม่เกิน TotalAmount เช่น 870.00)
	BalanceDue         float64 `json:"balance_due"`          // ยอดคงเหลือที่ลูกค้าต้องจ่ายเพิ่ม (TotalAmount - PaidAmount)
	ChangeAmount       float64 `json:"change_amount"`        // ยอดเงินทอนลูกค้า (PaidAmount - TotalAmount)

	DueDate  *time.Time `json:"due_date"`
	PaidDate *time.Time `json:"paid_date"` // วันที่ลูกค้าจ่ายเงินครบถ้วน (PaidAmount >= TotalAmount) หรือจ่ายเงินบางส่วน (PaidAmount < TotalAmount) แต่ไม่เกิน DueDate
	Note     string     `json:"note"`

	PaymentMethodName string                  `json:"payment_method_name"`
	PaymentStatus     string                  `json:"payment_status"`
	Items             []SaleHistoryItemDetail `json:"items"`
}
