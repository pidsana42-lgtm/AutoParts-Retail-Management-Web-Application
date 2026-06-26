package claim

import (
	"backend/internal/app/entity"
)

// CreateCustomerClaimItemDTO ใช้สำหรับรับข้อมูลสินค้า 1 ชิ้นที่จะเคลม
type CreateCustomerClaimItemDTO struct {
	// CustomerClaimID ไม่ต้อง `binding:"required"` เพราะถ้าส่งมาพร้อม CreateCustomerClaimDTO จะยังไม่มี ID
	CustomerClaimID *uint   `json:"customer_claim_id"` 
	ReturnItemID    *uint   `json:"return_item_id"`                  // โยงกับรายการที่รับคืน
	ProductID       uint    `json:"product_id" binding:"required"`   // รหัสสินค้าที่พัง/ต้องการเคลม
	Qty             float64 `json:"qty" binding:"required,gt=0"`     // จำนวนที่เคลม (ต้องมากกว่า 0)
	Reason          string  `json:"reason" binding:"required"`       // เหตุผล เช่น "เปิดไม่ติด", "ชำรุดจากการขนส่ง"
	Resolution      string  `json:"resolution"`                      // ข้อเสนอการแก้ปัญหา เช่น "เปลี่ยนสินค้า", "คืนเงิน"
}

// UpdateCustomerClaimItemDTO ใช้สำหรับอัปเดตรายการสินค้า (เช่น แก้ไขจำนวน หรือสรุปวิธีแก้ปัญหา)
type UpdateCustomerClaimItemDTO struct {
	Qty        float64 `json:"qty"`
	Reason     string  `json:"reason"`
	Resolution string  `json:"resolution"` // พนักงานอาจจะเป็นคนมาอัปเดตฟิลด์นี้ภายหลัง
}


// CustomerClaimItemResponseDTO ใช้แสดงผลรายการเคลม
type CustomerClaimItemResponseDTO struct {
	ID              uint    `json:"id"`
	CustomerClaimID uint    `json:"customer_claim_id"`
	ReturnItemID    *uint   `json:"return_item_id"`
	ProductID       uint    `json:"product_id"`
	ProductName     string  `json:"product_name"` // มักจะ Join เพื่อดึงชื่อสินค้ามาแสดงให้ User ดูง่ายๆ
	Qty             float64 `json:"qty"`
	Reason          string  `json:"reason"`
	Resolution      string  `json:"resolution"`
}

func (d *CreateCustomerClaimItemDTO) ToEntity() entity.CustomerClaimItem {
	var returnedItemID uint
	if d.ReturnItemID != nil {
		returnedItemID = *d.ReturnItemID
	}
	var customerClaimID uint
	if d.CustomerClaimID != nil {
		customerClaimID = *d.CustomerClaimID
	}
	return entity.CustomerClaimItem{
		CustomerClaimID: customerClaimID,
		ReturnedItemID:  returnedItemID,
		ProductID:       d.ProductID,
		Qty:             uint(d.Qty),
		Reason:          d.Reason,
		Resolution:      d.Resolution,
	}
}

func ToCustomerClaimItemResponseDTO(m *entity.CustomerClaimItem) CustomerClaimItemResponseDTO {
	var returnedItemID *uint
	if m.ReturnedItemID != 0 {
		returnedItemID = &m.ReturnedItemID
	}
	var productName string
	if m.Product != nil {
		productName = m.Product.Product_Name
	}
	return CustomerClaimItemResponseDTO{
		ID:              m.ID,
		CustomerClaimID: m.CustomerClaimID,
		ReturnItemID:    returnedItemID,
		ProductID:       m.ProductID,
		ProductName:     productName,
		Qty:             float64(m.Qty),
		Reason:          m.Reason,
		Resolution:      m.Resolution,
	}
}