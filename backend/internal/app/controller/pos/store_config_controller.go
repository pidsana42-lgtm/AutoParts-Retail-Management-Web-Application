package pos

import (
	storeconfigDto "backend/internal/app/dto/pos"
	storeconfigSvc "backend/internal/app/service/pos" 
	"net/http"
	"github.com/gin-gonic/gin"
)

type StoreConfigController struct {
	svc storeconfigSvc.StoreConfigService 
}

func NewStoreConfigController(svc storeconfigSvc.StoreConfigService) *StoreConfigController {
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

func (ctrl *StoreConfigController) CreateStoreConfig(c *gin.Context) {
	var req storeconfigDto.StoreConfigRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบข้อมูล JSON ไม่ถูกต้อง: " + err.Error()})
		return
	}

	if err := ctrl.svc.CreateStoreConfig(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "สร้างการตั้งค่าร้านค้าสำเร็จเรียบร้อยแล้ว"})
}

func (ctrl *StoreConfigController) UpdateStoreConfig(c *gin.Context) {
	var req storeconfigDto.StoreConfigRequest

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