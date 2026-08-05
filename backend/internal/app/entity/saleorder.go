package entity

import (
	"backend/internal/app/enum"
	"gorm.io/gorm"
	"time"
)

type SaleOrder struct {
	gorm.Model
	// User ส่งมา
	OrderNumber string    `gorm:"type:varchar(100);not null;unique" json:"order_number" binding:"required"`
	OrderDate   time.Time `gorm:"type:timestamptz;not null" json:"order_date" binding:"required"`

	// FK
	CustomerID *uint    `gorm:"column:customer_id;default:null" json:"customer_id"`
	Customer   Customer `gorm:"foreignKey:CustomerID" json:"customer"`

	// Optional ข้อมูลลูกค้าแบบชั่วคราว (กรณีลูกค้า walk-in หรือไม่อยากบันทึกลงฐานข้อมูล)
	CustomerNameTemp    *string `gorm:"type:varchar(100)" json:"customer_name_temp"`
	CustomerPhoneTemp   *string `gorm:"type:varchar(20)" json:"customer_phone_temp"`
	CustomerAddressTemp string  `gorm:"type:varchar(255)" json:"customer_address_temp"`

	// ระบบ Set เอง
	Status        enum.OrderStatus   `gorm:"type:varchar(50);not null;default:pending" json:"status"`
	PaymentStatus enum.PaymentStatus `gorm:"type:varchar(50);not null;default:unpaid" json:"payment_status"`

	PaymentMethodID *uint          `gorm:"column:payment_method_id;default:null" json:"payment_method_id"`
	PaymentMethod   *PaymentMethod `gorm:"foreignKey:PaymentMethodID" json:"payment_method"`

	// ระบบคำนวณเอง + เติมฟิลด์จัดการส่วนลดท้ายบิล
	Subtotal           float64 `gorm:"type:decimal(15,2);not null" json:"subtotal"`                          // ยอดรวมสินค้าทุกแถวก่อนหักส่วนลดท้ายบิล
	BillDiscountType   string  `gorm:"type:varchar(20);not null;default:'none'" json:"bill_discount_type"`   // ประเภทส่วนลดท้ายบิล (none, amount, percent)
	BillDiscountValue  float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"bill_discount_value"`  // เพิ่ม: ส่วนลดที่พนักงานคีย์ท้ายบิล
	DiscountAmount     float64 `gorm:"type:decimal(15,2);not null" json:"discount_amount"`                   // มูลค่าส่วนลดท้ายบิล (บาท)
	DiscountPercent    float64 `gorm:"type:decimal(15,2);not null" json:"discount_percent"`                  // มูลค่าส่วนลดท้ายบิล (%)
	TotalDiscountItems float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"total_discount_items"` // เพิ่ม: ผลรวมส่วนลดรายชิ้นสะสมทั้งหมด

	TotalAmount    float64 `gorm:"type:decimal(15,2);not null" json:"total_amount"`                 // ยอดเน็ตสุทธิขวาล่างสุด (Subtotal - DiscountAmount)
	ReceivedAmount float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"received_amount"` // ยอดเงินที่ลูกค้าจ่ายเข้ามา (รวมทุกช่องทาง)
	PaidAmount     float64 `gorm:"type:decimal(15,2);not null" json:"paid_amount"`                  // ยอดเงินสุทธิที่หักเงินทอนแล้วและเข้ากระเป๋าร้านจริง (สูงสุดไม่เกิน TotalAmount เช่น 870.00)
	BalanceDue     float64 `gorm:"type:decimal(15,2);not null" json:"balance_due"`                  // ยอดคงเหลือที่ลูกค้าต้องจ่ายเพิ่ม (TotalAmount - PaidAmount)
	ChangeAmount   float64 `gorm:"type:decimal(15,2);not null" json:"change_amount"`                // ยอดเงินทอนลูกค้า (PaidAmount - TotalAmount)

	// Optional
	DueDate  *time.Time `gorm:"type:date" json:"due_date"`
	PaidDate *time.Time `gorm:"type:date" json:"paid_date"` // วันที่ลูกค้าจ่ายเงินครบถ้วน (PaidAmount >= TotalAmount) หรือจ่ายเงินบางส่วน (PaidAmount < TotalAmount) แต่ไม่เกิน DueDate
	Note     string     `gorm:"type:varchar(255)" json:"note"`

	// ความสัมพันธ์ 1 Order มีได้หลายอัน
	Items    []SaleOrderItem `gorm:"foreignKey:OrderID" json:"items"`
	Payments []Payment       `gorm:"foreignKey:OrderID" json:"payments"`

	// Toto WMS
	StockMovements []StockMovement `gorm:"foreignKey:SaleOrderID" json:"stock_movements"`

	// เพิ่ม Field สำหรับระบบ Cancel Workflow
	CancelReason      *string    `gorm:"type:varchar(255)" json:"cancel_reason"`    // เหตุผลที่พนักงานขอยกเลิก
	CancelRequestedAt *time.Time `gorm:"type:timestamp" json:"cancel_requested_at"` // เวลาที่ส่งคำขอยกเลิก
	CancelRemark      *string    `gorm:"type:varchar(255)" json:"cancel_remark"`    // หมายเหตุอนุมัติ/ปฏิเสธจากเจ้าของร้าน
	CancelProcessedAt *time.Time `gorm:"type:timestamp" json:"cancel_processed_at"` // เวลาที่เจ้าของร้านกดจัดการ
}
