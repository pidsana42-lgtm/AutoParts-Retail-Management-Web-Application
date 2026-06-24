package pos

import (
	posDto "backend/internal/app/dto/pos"
	posSvc "backend/internal/app/service/pos" 
	"net/http"
	"github.com/gin-gonic/gin"
)

type StoreConfigController struct {
	svc posSvc.StoreConfigService 
}

func NewStoreConfigController(svc posSvc.StoreConfigService) *StoreConfigController {
	return &StoreConfigController{svc: svc}
}

func (ctrl *StoreConfigController) GetStoreConfig(c *gin.Context) {
	config, err := ctrl.svc.GetStoreConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, config)
}

func (ctrl *StoreConfigController) UpdateStoreConfig(c *gin.Context) {
	var req posDto.StoreConfigRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบข้อมูล JSON ไม่ถูกต้อง: " + err.Error()})
		return
	}

	if err := ctrl.svc.UpdateStoreConfig(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "อัปเดตการตั้งค่าร้านค้าสำเร็จเรียบร้อยแล้ว"})
}