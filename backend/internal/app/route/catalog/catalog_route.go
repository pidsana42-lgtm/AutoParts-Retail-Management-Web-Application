package catalog

import (
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	controller "backend/internal/app/controller/catalog"
	"backend/internal/app/enum"
	repo "backend/internal/app/repository/catalog"
	service "backend/internal/app/service/catalog"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupCatalogRoutes(r *gin.Engine, db *gorm.DB) {
	repository := repo.NewCatalogRepository(db)
	svc := service.NewCatalogService(repository)
	ctrl := controller.NewCatalogController(svc)
	aiServiceURL := strings.TrimRight(os.Getenv("OCR_SERVICE_URL"), "/")
	if aiServiceURL == "" {
		aiServiceURL = "http://127.0.0.1:8000"
	}
	catalogExtractURL := aiServiceURL + "/api/extract-catalog"

	catalogGroup := r.Group("/api/catalogs")
	catalogGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleManager)),
	)
	{
		catalogGroup.GET("", ctrl.ListCatalogs)
		catalogGroup.GET("/items/search", ctrl.SearchItems)
		catalogGroup.GET("/:id", ctrl.GetCatalogByID)
		catalogGroup.POST("", ctrl.CreateCatalog)
		catalogGroup.PUT("/:id", ctrl.UpdateCatalog)
		catalogGroup.DELETE("/:id", ctrl.DeleteCatalog)

		// Proxy route for AI catalog image extraction
		catalogGroup.POST("/extract-image", func(c *gin.Context) {
			proxyReq, err := http.NewRequest(http.MethodPost, catalogExtractURL, c.Request.Body)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create AI proxy request: " + err.Error()})
				return
			}
			proxyReq.Header = c.Request.Header.Clone()

			client := &http.Client{Timeout: 300 * time.Second}
			resp, err := client.Do(proxyReq)
			if err != nil {
				c.JSON(http.StatusBadGateway, gin.H{"error": "failed to connect to catalog AI service: " + err.Error()})
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
