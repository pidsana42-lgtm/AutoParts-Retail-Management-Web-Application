package purchaseorders

import (
	"errors"
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
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized: missing user profile"})
		return
	}

	var CreatorID uint
	if idFloat, ok := userID.(float64); ok {
		// ถ้าค่าที่ได้มาเป็น float64 จริง ให้แปลงเป็น uint
		CreatorID = uint(idFloat)
	} else {
		// กันเหนียวเผื่อในอนาคตค่าที่ได้มาไม่ใช่ตัวเลข
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user id type in token"})
		return
	}

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

// ฟังก์ชันเรียกดูลิสต์ PO ทั้งหมดของแต่ละ ID
func (ctrl *PurchaseOrderController) ListPOs(c *gin.Context) {
	var query poDto.ListPOQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid query parameters"})
		return
	}
	// หลังจากถอด Token จาก JWT ตัวเลขจะถูกแปลงเป็น float64 
	// พอจะแปลงให้เป็น uint ตรง ๆ GO มันก็มองว่า Data Type ไม่ตรงกันเลยพ่น 401 ออกมา
	userIDValue, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	// ต้อง cast เป็น float64 ก่อน
	userIDFloat, ok := userIDValue.(float64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id type"})
		return
	}
	
	userID := uint(userIDFloat)

	if query.Page <= 0 {
		query.Page = 1
	}
	if query.Limit <= 0 {
		query.Limit = 10
	}

	res, err := ctrl.poService.ListPOs(c.Request.Context(), userID, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (ctrl *PurchaseOrderController) GetSummary(c *gin.Context) {
	// ดึง userID จาก Context
	userIDValue, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	userIDFloat, ok := userIDValue.(float64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id type"})
		return
	}
	userID := uint(userIDFloat)

	// ดึง Role จาก Context (ที่ Auth Middleware ยัดไว้ให้)
	roleValue, exists := c.Get("role")
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "role not found in token"})
		return
	}
	
	role, ok := roleValue.(string)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid role type"})
		return
	}

	// ส่ง role เข้าไปใน Service ด้วย
	res, err := ctrl.poService.GetPOSummary(c.Request.Context(), userID, role)
	if err != nil {
		// ถ้ามี Error จาก Business Logic (เช่น สิทธิ์ไม่ถึง) ให้ส่ง 403 Forbidden กลับไป
		if err.Error() == "forbidden: only owner can view PO summary" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch PO summary"})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (ctrl *PurchaseOrderController) DeletePO(c *gin.Context) {
	var req poDto.DeletePORequest

	if err := c.ShouldBindUri(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase order id"})
		return
	}

	err := ctrl.poService.Delete(c.Request.Context(), req.ID)
	if err != nil {
		// ใช้ errors.Is เทียบกับตัวแปร Error จาก Service ตรงๆ
		switch {
		case errors.Is(err, poSvc.ErrPONotFound): // กรณีหาข้อมูลไม่เจอ
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		case errors.Is(err, poSvc.ErrPOCannotDelete): // กรณีติด Business Logic (ห้ามลบ)
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()}) // ใช้ 409 Conflict หรือ 400 ก็ได้
			return
		default: // กรณี Server มีปัญหา (DB ล่ม ฯลฯ)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "purchase order deleted successfully"})
}