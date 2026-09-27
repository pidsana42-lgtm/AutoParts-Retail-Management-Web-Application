package wms

import (
	"net/http"
	"strings"

	"backend/internal/app/enum"
	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
)

type MovementFeedController struct {
	service wmsSvc.MovementFeedService
}

func NewMovementFeedController(service wmsSvc.MovementFeedService) *MovementFeedController {
	return &MovementFeedController{service: service}
}

// basePathForRole: หน้า owner/manager เป็นคนละ path prefix กัน (/owner/... กับ /manager/...) แม้จะเป็นหน้าเดียวกัน
// ทุกประการก็ตาม — ใช้ role จาก JWT (เซ็ตไว้ใน context โดย AuthMiddleware) มาคำนวณ prefix ที่ link_path ควรจะเป็น
func basePathForRole(c *gin.Context) string {
	role, _ := c.Get("role")
	roleStr, _ := role.(string)
	// เช็ค "Admin" ตรงๆ ด้วย (เผื่อ JWT เก่าที่ออกไว้ก่อน seed จะ migrate role นี้เป็น "Manager" — ดู seed/role.go)
	if strings.EqualFold(roleStr, string(enum.RoleManager)) || strings.EqualFold(roleStr, "Admin") {
		return "/manager"
	}
	return "/owner"
}

// List: ไทม์ไลน์การเคลื่อนไหวของสินค้ารวมทุกประเภท (ฝั่ง WMS) เรียงใหม่สุดก่อน
// การกรองตามประเภท/ช่วงวันที่/ค้นหา ทำที่ฝั่ง frontend เหมือนหน้าจัดการตารางเช็คสต็อก
func (ctrl *MovementFeedController) List(c *gin.Context) {
	res, err := ctrl.service.List(basePathForRole(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}
