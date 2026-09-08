package preorder

import (
	"testing"
	"time"

	preOrderDTO "backend/internal/app/dto/pre_oder"
	"backend/internal/app/entity"
	preOrderRepo "backend/internal/app/repository/pre_oder"
	preOrderService "backend/internal/app/service/pre_oder"

	"github.com/stretchr/testify/require"
)

// TestCreatePreOrder_AutoCreatesCustomerWhenIDIsZero: จำลองบั๊กที่รายงานมาจริง —
// "ตอนสร้างพรีออเดอร์ เพิ่มชื่อลูกค้าใหม่ไม่ได้" เพราะเดิม customer_id=0 ถูก backend ปฏิเสธ
// เทสนี้ใช้ repository จริง (sqlite in-memory) ไม่ mock เพื่อยืนยัน flow เต็มรูปแบบ
func TestCreatePreOrder_AutoCreatesCustomerWhenIDIsZero(t *testing.T) {
	db := setupPreOrderRepoTestDB(t)
	require.NoError(t, db.AutoMigrate(&entity.PreOrder{}, &entity.PreOrderItem{}))

	repo := preOrderRepo.NewPreOrderRepository(db)
	svc := preOrderService.NewPreOrderService(repo)

	input := preOrderDTO.CreatePreOrderDTO{
		PreOrderType:  "WALK_IN",
		CustomerID:    0, // พิมพ์ชื่อเองไม่ได้เลือกจาก dropdown
		CustomerName:  "ลูกค้าใหม่ หน้าร้าน",
		CustomerPhone: "0898765432",
		Status:        "PENDING",
		OrderDate:     time.Now(),
		PreOrderItems: []preOrderDTO.CreatePreOrderItemDTO{
			{ProductID: 0, Quantity: 1, UnitPrice: 100, ProductName: "อะไหล่ทดสอบ"},
		},
	}

	res, err := svc.CreatePreOrder(input)
	require.NoError(t, err, "ต้องสร้างพรีออเดอร์ให้ลูกค้าใหม่ที่พิมพ์ชื่อเองได้ ไม่ error 400/500")
	require.NotZero(t, res.CustomerID, "ต้องได้ customer_id ของลูกค้าที่ถูกสร้างอัตโนมัติ")

	var customer entity.Customer
	require.NoError(t, db.First(&customer, res.CustomerID).Error)
	require.Equal(t, "ลูกค้าใหม่ หน้าร้าน", customer.CustomerName)
	require.Equal(t, "0898765432", customer.PhoneNumber)
}

func TestCreatePreOrder_MissingCustomerIDAndName_ReturnsError(t *testing.T) {
	db := setupPreOrderRepoTestDB(t)
	require.NoError(t, db.AutoMigrate(&entity.PreOrder{}, &entity.PreOrderItem{}))

	repo := preOrderRepo.NewPreOrderRepository(db)
	svc := preOrderService.NewPreOrderService(repo)

	input := preOrderDTO.CreatePreOrderDTO{
		PreOrderType: "WALK_IN",
		CustomerID:   0,
		CustomerName: "   ", // ว่างจริงๆ หลัง trim
		Status:       "PENDING",
		OrderDate:    time.Now(),
		PreOrderItems: []preOrderDTO.CreatePreOrderItemDTO{
			{ProductID: 0, Quantity: 1, UnitPrice: 100, ProductName: "อะไหล่ทดสอบ"},
		},
	}

	_, err := svc.CreatePreOrder(input)
	require.Error(t, err, "ต้อง error ถ้าไม่มีทั้ง customer_id และชื่อลูกค้า")
}
