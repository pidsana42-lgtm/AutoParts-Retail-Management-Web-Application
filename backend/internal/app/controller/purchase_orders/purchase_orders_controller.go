package purchaseorders

import (
	"net/http"
	poDto 	"backend/internal/app/dto/purchase_orders"
	poEnum 	"backend/internal/app/enum"
	poSvc 	"backend/internal/app/service/purchase_orders"
	"github.com/gin-gonic/gin"
)

type PurchaseOrderController struct {
	poService	poSvc.PurchaseOrderService
}

// ตัวทำ Dependency Injection
func NewPOController(poService poSvc.PurchaseOrderService) *PurchaseOrderController {
	return &PurchaseOrderController{
		poService: poService,
	}
}

// สร้างใบสั่งซื้อใหม่
func (ctrl *PurchaseOrderController) CreatePO(c *gin.Context) {
	var req poDto.CreatePurchaseOrderRequest

	// ถ้าเกิดว่าไม่ได้รับ JSOn จาก Frontend
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ตรวจสอบ ID ของ User ที่สั่งสร้างใบสั่งซื้อจาก JWT Token
	// userID, exists := c.Get("userID")
	// if !exists {
	// 	c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized: missing user profile"})
	// 	return
	// }

	userID := uint(1)
	CreatorID := userID
	// CreatorID := userID.(uint)

	// เผื่อ server ใช้งานไม่ได้
	res, err := ctrl.poService.CreatePO(c.Request.Context(), &req, CreatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, res)
}

// ดูรายละเอียดใบสั่งซื้อแยกแต่ละ ID ของ Product ใน PO
func (ctrl *PurchaseOrderController) GetByID(c *gin.Context) {
	var uri struct {
		ID 		uint 		`uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid purcahse order ID format"})
		return
	}

	res, err := ctrl.poService.GetPOByID(c.Request.Context(), uri.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "purchase order not found"})
		return
	}

	c.JSON(http.StatusOK, res)
}

// for ตอนที่อัพเดตสถานะที่เจ้าของร้าน
type UpdateStatusInput struct {
	Status poEnum.POStatus `json:"status" binding:"required,oneof=DRAFT PENDING APPROVED REJECTED"`
}

// อัพเดตสถานะ PO 
func (ctrl *PurchaseOrderController) UpdateStatus(c *gin.Context) {
	var uri struct {
		ID 		uint	`uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var input UpdateStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := ctrl.poService.UpdatePOStatus(c.Request.Context(), uri.ID, input.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "purchase order status updated successfully"})
}