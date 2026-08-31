package wms

import (
	"strconv"

	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type InventoryLotController struct {
	svc wmsSvc.InventoryLotService
}

func NewInventoryLotController(svc wmsSvc.InventoryLotService) *InventoryLotController {
	return &InventoryLotController{svc: svc}
}

// ListLots GET /api/wms/inventory-lots?product_id=1
func (ctrl *InventoryLotController) ListLots(c *gin.Context) {
	productID, err := strconv.ParseUint(c.Query("product_id"), 10, 32)
	if err != nil || productID == 0 {
		c.JSON(400, gin.H{"error": "product_id is required"})
		return
	}

	lots, err := ctrl.svc.ListByProduct(uint(productID))
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to list inventory lots: " + err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": lots})
}

// ResolveCode GET /api/wms/inventory-lots/resolve?code=BP-123-SU3
func (ctrl *InventoryLotController) ResolveCode(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(400, gin.H{"error": "code is required"})
		return
	}

	lot, err := ctrl.svc.ResolveCode(code)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(404, gin.H{"error": "ไม่พบรหัสล็อตนี้ในระบบ"})
			return
		}
		c.JSON(500, gin.H{"error": "failed to resolve variant code: " + err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": lot})
}

// BackfillCodes POST /api/wms/inventory-lots/generate-codes  { "product_id": 1 } หรือ { "all": true }
func (ctrl *InventoryLotController) BackfillCodes(c *gin.Context) {
	var req struct {
		ProductID uint `json:"product_id"`
		All       bool `json:"all"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid input: " + err.Error()})
		return
	}
	if !req.All && req.ProductID == 0 {
		c.JSON(400, gin.H{"error": "ต้องระบุ product_id หรือ all=true"})
		return
	}

	res, err := ctrl.svc.BackfillMissingCodes(req.ProductID, req.All)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to generate codes: " + err.Error()})
		return
	}
	c.JSON(200, gin.H{
		"message": "ออกรหัสล็อตสำเร็จ",
		"data":    res,
	})
}
