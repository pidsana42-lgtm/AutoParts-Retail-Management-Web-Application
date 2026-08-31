package entity

import "gorm.io/gorm"

type POItems struct {
	gorm.Model
	POID                         uint     `gorm:"column:po_id;not null" json:"po_id"`
	PO                           *PO      `gorm:"foreignKey:POID" json:"po,omitempty"`
	ProductID                    uint     `gorm:"column:product_id;not null" json:"product_id"`
	Product                      *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Product_name_snapshot        string   `gorm:"type:varchar(255);not null" json:"product_name_snapshot"`
	Supply_product_code_snapshot string   `gorm:"type:varchar(100);not null" json:"product_name_code_snapshot"`
	Quantity                     float64  `gorm:"type:decimal(10,2);not null" json:"quantity"`
	Unit                         string   `gorm:"type:varchar(50);not null" json:"unit"`
	UnitPrice                    float64  `gorm:"type:decimal(10,2);not null" json:"unit_price"`
	SubTotal                     float64  `gorm:"type:decimal(10,2);not null" json:"sub_total"`
	Notes                        *string  `gorm:"type:text" json:"notes"`
	AlertID                      *uint    `json:"alert_id"`
	PreOrderItemID               *uint    `json:"pre_order_item_id"`

	// ใส่ * เพราะว่า ID เป็น Pointer มีโอกาสเป็น NULL
	Alert        *StockAlert   `gorm:"foreignKey:AlertID" json:"alert,omitempty"`
	PreOrderItem *PreOrderItem `gorm:"foreignKey:PreOrderItemID" json:"pre_order_item,omitempty"`
}

func (POItems) TableName() string {
	return "purchase_order_items"
}
