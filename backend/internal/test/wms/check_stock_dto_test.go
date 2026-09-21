package wms

import (
	"testing"
	"time"

	wmsDTO "backend/internal/app/dto/wms"

	"github.com/gin-gonic/gin/binding"
	"github.com/stretchr/testify/require"
)

// Old_Quantity/New_Quantity เคยมี binding:"required" ติดอยู่ ทำให้พนักงานนับสินค้าได้ 0 จริงๆ (ของหมดสต็อกพอดี)
// ส่งไม่ผ่าน validator ของ Gin เลย เพราะ "required" มองว่า 0 คือ zero value ของ int แปลว่า "ไม่ได้กรอก" เสมอ
// ทดสอบผ่าน binding.Validator ตัวเดียวกับที่ ShouldBindJSON ใช้จริงตอน bind request เข้า controller
func TestCheckStockRequestDTO_ZeroQuantities_PassValidation(t *testing.T) {
	dto := wmsDTO.CheckStockRequestDTO{
		Old_Quantity:        0,
		New_Quantity:        0,
		Adjustment_DateTime: time.Now(),
		ProductID:           1,
		UserID:              1,
	}
	require.NoError(t, binding.Validator.ValidateStruct(&dto), "counting 0 units should be a valid submission, not rejected as missing")
}

func TestCheckStockRequestDTO_NegativeQuantity_StillFailsValidation(t *testing.T) {
	dto := wmsDTO.CheckStockRequestDTO{
		Old_Quantity:        0,
		New_Quantity:        -1,
		Adjustment_DateTime: time.Now(),
		ProductID:           1,
		UserID:              1,
	}
	require.Error(t, binding.Validator.ValidateStruct(&dto), "min=0 should still reject a negative counted quantity")
}

func TestCheckStockRequestDTO_MissingProductID_StillFailsValidation(t *testing.T) {
	dto := wmsDTO.CheckStockRequestDTO{
		Old_Quantity:        0,
		New_Quantity:        0,
		Adjustment_DateTime: time.Now(),
		UserID:              1,
	}
	require.Error(t, binding.Validator.ValidateStruct(&dto), "required should still reject an actually-missing ProductID (0 is never a valid id)")
}
