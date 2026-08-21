package catalog

import (
	"io"
	"net/http"
	"time"

	controller "backend/internal/app/controller/catalog"
	repo "backend/internal/app/repository/catalog"
	service "backend/internal/app/service/catalog"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupCatalogRoutes(r *gin.Engine, db *gorm.DB) {
	repository := repo.NewCatalogRepository(db)
	svc := service.NewCatalogService(repository)
	ctrl := controller.NewCatalogController(svc)

	catalogGroup := r.Group("/api/catalogs")
	{
		catalogGroup.GET("", ctrl.ListCatalogs)
		catalogGroup.GET("/items/search", ctrl.SearchItems)
		catalogGroup.GET("/:id", ctrl.GetCatalogByID)
		catalogGroup.POST("", ctrl.CreateCatalog)
		catalogGroup.PUT("/:id", ctrl.UpdateCatalog)
		catalogGroup.DELETE("/:id", ctrl.DeleteCatalog)

		// Proxy route for AI catalog image extraction
		catalogGroup.POST("/extract-image", func(c *gin.Context) {
			proxyReq, err := http.NewRequest(http.MethodPost, "http://127.0.0.1:8000/api/extract-catalog", c.Request.Body)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create AI proxy request: " + err.Error()})
				return
			}
			proxyReq.Header = c.Request.Header.Clone()

			client := &http.Client{Timeout: 300 * time.Second}
			resp, err := client.Do(proxyReq)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to connect to Python AI service (port 8000): " + err.Error()})
				return
			}
			defer resp.Body.Close()

			body, err := io.ReadAll(resp.Body)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read AI response: " + err.Error()})
				return
			}

			c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
		})
	}
}
