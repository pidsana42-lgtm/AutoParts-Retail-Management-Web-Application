package import_bill

import (
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	billCtrl "backend/internal/app/controller/import_data"
	billRepo "backend/internal/app/repository/import_data"
	billSvc "backend/internal/app/service/import_data"
	svcNotification "backend/internal/app/service/notification"

	"backend/internal/app/entity"
	"backend/internal/app/enum"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupBillRoutes(r *gin.Engine, db *gorm.DB, notificationService svcNotification.NotificationService) {
	// 1. Repository
	repo := billRepo.NewImportBillRepository(db)

	// 2. Service
	svc := billSvc.NewImportBillService(repo, notificationService)

	// 3. Controller
	ctrl := billCtrl.NewBillController(svc)

	importDataGroup := r.Group("/api/import-data")
	importDataGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleManager)),
	)
	{
		importDataGroup.POST("/bill-images", ctrl.CreateBillImage)
		importDataGroup.POST("/bill-import-jobs", ctrl.CreateBillImportJob)
		importDataGroup.GET("/bill-import-jobs/:id", ctrl.GetBillImportJob)
		importDataGroup.POST("/bill-import-jobs/:id/confirm", ctrl.ConfirmBillImport)
		importDataGroup.POST("/bills", ctrl.CreateBill)
		importDataGroup.GET("/bills", ctrl.ListBills)
		importDataGroup.PUT("/bills/:id", ctrl.UpdateBill)
		importDataGroup.DELETE("/bills/:id", ctrl.DeleteBill)
		importDataGroup.POST("/bill-items", ctrl.CreateBillItem)
		importDataGroup.GET("/purchase-orders", ctrl.ListPurchaseOrders)
		importDataGroup.GET("/purchase-orders/:id", ctrl.GetPurchaseOrderById)

		// Custom route for WMS Import Bill flow to fetch categories with preloaded subcategories (Keeps friend's files untouched)
		importDataGroup.GET("/categories-tree", func(c *gin.Context) {
			var categories []entity.Category
			if err := db.Preload("SubCategories").Find(&categories).Error; err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, categories)
		})
	}

	// Owner/Admin-only: แก้ไขและปรับราคาสินค้าในหน้า "แก้ไขและปรับราคาสินค้า" (edit-stock-bill)
	// ให้ตรงกับสิทธิ์ฝั่ง frontend (isAdminOrOwner) — พนักงานเรียก endpoint นี้ตรงๆ ไม่ได้อีกต่อไป
	ownerAdminGroup := r.Group("/api/import-data")
	ownerAdminGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleAdmin)),
	)
	{
		ownerAdminGroup.PUT("/products/:id", ctrl.UpdateProduct)
	}

	// Owner-only: ปรับราคาทุนสินค้าเมื่อราคาในบิลไม่ตรงกับระบบ — เฉพาะเจ้าของเท่านั้น
	ownerOnlyGroup := r.Group("/api/import-data")
	ownerOnlyGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner)),
	)
	{
		ownerOnlyGroup.PUT("/products/:id/cost-price", func(c *gin.Context) {
			var uri struct {
				ID uint `uri:"id" binding:"required"`
			}
			if err := c.ShouldBindUri(&uri); err != nil {
				c.JSON(400, gin.H{"error": "invalid product ID format"})
				return
			}
			var req struct {
				CostPrice float64 `json:"cost_price" binding:"required,gt=0"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := db.Model(&entity.Product{}).Where("id = ?", uri.ID).Update("cost_price", req.CostPrice).Error; err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "product cost price updated successfully"})
		})
	}

	// Mobile image upload routes (no auth — session token acts as access control)
	mobileGroup := r.Group("/api/mobile")
	{
		mobileGroup.POST("/upload-image", ctrl.UploadMobileImage)
		mobileGroup.GET("/images", ctrl.GetMobileImages)
		mobileGroup.DELETE("/images", ctrl.ClearMobileImages)
	}

	// Fallback route alias for purchase-orders directly under /api/
	apiGroup := r.Group("/api")
	apiGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleManager)),
	)
	{
		apiGroup.GET("/purchase-orders", ctrl.ListPurchaseOrders)
		apiGroup.GET("/purchase-orders/:id", ctrl.GetPurchaseOrderById)
	}

	// OCR Proxy route: forwards frontend requests through the Go backend.
	// OCR_SERVICE_URL can be overridden locally when port 8000 is used by another service.
	ocrServiceURL := strings.TrimRight(os.Getenv("OCR_SERVICE_URL"), "/")
	if ocrServiceURL == "" {
		ocrServiceURL = "http://127.0.0.1:8000"
	}
	ocrUploadURL := ocrServiceURL + "/api/extract-invoice/upload"

	ocrProxyHandler := func(c *gin.Context) {
		proxyReq, err := http.NewRequest(http.MethodPost, ocrUploadURL, c.Request.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create proxy request: " + err.Error()})
			return
		}
		proxyReq.Header = c.Request.Header.Clone()

		client := &http.Client{Timeout: 300 * time.Second}
		resp, err := client.Do(proxyReq)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to connect to OCR service: " + err.Error()})
			return
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read OCR response: " + err.Error()})
			return
		}

		c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
	}

	// Every compatibility URL must enforce the same staff access as bill import.
	ocrGroup := r.Group("")
	ocrGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleManager)),
	)
	ocrGroup.POST("/api/ocr/extract-invoice/upload", ocrProxyHandler)
	ocrGroup.POST("/api/ocr/api/extract-invoice/upload", ocrProxyHandler)
	ocrGroup.POST("/ocr/api/extract-invoice/upload", ocrProxyHandler)
}
