package wms

import (
	"net/http"

	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
)

type MovementFeedController struct {
	service wmsSvc.MovementFeedService
}

func NewMovementFeedController(service wmsSvc.MovementFeedService) *MovementFeedController {
	return &MovementFeedController{service: service}
}

// List: ไทม์ไลน์การเคลื่อนไหวของสินค้ารวมทุกประเภท (ฝั่ง WMS) เรียงใหม่สุดก่อน
// การกรองตามประเภท/ช่วงวันที่/ค้นหา ทำที่ฝั่ง frontend เหมือนหน้าจัดการตารางเช็คสต็อก
func (ctrl *MovementFeedController) List(c *gin.Context) {
	res, err := ctrl.service.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}
