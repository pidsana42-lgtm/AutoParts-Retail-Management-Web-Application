package wms

import (
	wmsCtrl "backend/internal/app/controller/wms"
	wmsRepo "backend/internal/app/repository/wms"
	wmsSvc "backend/internal/app/service/wms"

	"backend/internal/app/enum"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupMovementFeedRoutes(r *gin.Engine, db *gorm.DB) {
	repo := wmsRepo.NewMovementFeedRepository(db)
	service := wmsSvc.NewMovementFeedService(repo)
	controller := wmsCtrl.NewMovementFeedController(service)

	// ฟีดนี้เห็นได้เฉพาะเจ้าของร้าน/ผู้จัดการเท่านั้น (ตรงกับเมนู "การเคลื่อนไหวของคลังสินค้า" ที่พนักงานไม่มี)
	// ต้องมี AuthMiddleware ก่อน ไม่งั้น controller จะไม่รู้ role เลยไปคำนวณ link_path ผิด role ไม่ได้
	wms := r.Group("/api/wms/movement-feed")
	wms.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleManager)),
	)
	{
		wms.GET("", controller.List)
	}
}
