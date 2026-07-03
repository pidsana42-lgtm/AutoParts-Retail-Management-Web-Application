package oa

import (
	ctrl "backend/internal/app/controller/oa"
	repo "backend/internal/app/repository/oa"
	service "backend/internal/app/service/oa"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupOARoutes(r *gin.Engine, db *gorm.DB) {
	repository := repo.NewRepository(db)
	svc := service.NewService(repository)
	controller := ctrl.NewController(svc)

	// Also support root-level /webhook for easier LINE Developers Console setup
	r.POST("/webhook", controller.Webhook)

	oaGroup := r.Group("/api/oa")
	{
		oaGroup.POST("/webhook", controller.Webhook)
		oaGroup.GET("/users", controller.GetLineUsers)
		oaGroup.GET("/users/:line_user_id/messages", controller.GetLineMessages)
		oaGroup.POST("/send-message", controller.SendMessage)
		oaGroup.POST("/users/:line_user_id/link-customer", controller.LinkCustomer)
		oaGroup.POST("/simulate", controller.SimulateUserWebhook)
	}
}
