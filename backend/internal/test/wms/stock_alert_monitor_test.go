package wms

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"backend/internal/app/cron"
	"backend/internal/app/entity"
	notifRepo "backend/internal/app/repository/notification"
	wmsRepo "backend/internal/app/repository/wms"
	wmsRoute "backend/internal/app/route/wms"
	notifSvc "backend/internal/app/service/notification"
	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newStockMonitorDB(t *testing.T) (*gorm.DB, wmsSvc.StockAlertService, notifSvc.NotificationService) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent), DisableForeignKeyConstraintWhenMigrating: true})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	require.NoError(t, db.AutoMigrate(&entity.Product{}, &entity.StockAlert{}, &entity.Unit{}, &entity.Inventory{}, &entity.Supplier{}, &entity.Notification{}))
	return db, wmsSvc.NewStockAlertService(wmsRepo.NewStockAlertRepository(db)), notifSvc.NewNotificationService(notifRepo.NewNotificationRepository(db))
}

func TestStockMonitorRefreshAllAuthenticatedRoles(t *testing.T) {
	_, service, notifications := newStockMonitorDB(t)
	const secret = "stock-refresh-test-only"
	t.Setenv("JWT_SECRET", secret)
	router := gin.New()
	wmsRoute.RegisterStockAlertRoutes(router, service, notifications)
	for _, role := range []string{"Owner", "Manager", "Admin", "Employee", "Staff", "anonymous", "invalid-token"} {
		t.Run(role, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/wms/stock-alerts/refresh", nil)
			wantStatus := http.StatusOK
			if role == "anonymous" {
				wantStatus = http.StatusUnauthorized
			} else if role == "invalid-token" {
				req.Header.Set("Authorization", "Bearer invalid-test-token")
				wantStatus = http.StatusUnauthorized
			} else {
				token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
					"role": role, "user_id": 1, "exp": time.Now().Add(time.Hour).Unix(),
				}).SignedString([]byte(secret))
				require.NoError(t, err)
				req.Header.Set("Authorization", "Bearer "+token)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, req)
			require.Equal(t, wantStatus, response.Code, response.Body.String())
			if wantStatus == http.StatusOK {
				require.JSONEq(t, "[]", response.Body.String())
			}
		})
	}
}

func TestStockMonitorThresholdLifecycle(t *testing.T) {
	db, service, notifications := newStockMonitorDB(t)
	p := entity.Product{Product_Code: "TEST-STOCK", Product_Name: "ผ้าเบรก", Quantity: 6, Limit_Quantity: 5}
	require.NoError(t, db.Create(&p).Error)
	for _, step := range []struct {
		name              string
		quantity, notices int
		active            bool
		kind              string
	}{
		{"above threshold", 6, 0, false, ""},
		{"at threshold", 5, 1, true, "LOW_STOCK"},
		{"unchanged does not repeat", 5, 1, true, "LOW_STOCK"},
		{"lower updates snapshot", 2, 1, true, "LOW_STOCK"},
		{"out of stock escalates", 0, 2, true, "OUT_OF_STOCK"},
		{"still out does not repeat", 0, 2, true, "OUT_OF_STOCK"},
		{"restocked closes alert", 8, 2, false, ""},
		{"new crossing notifies again", 4, 3, true, "LOW_STOCK"},
	} {
		t.Run(step.name, func(t *testing.T) {
			require.NoError(t, db.Model(&p).Update("quantity", step.quantity).Error)
			require.NoError(t, cron.CheckLowStockAndNotify(service, notifications))
			var notices []entity.Notification
			require.NoError(t, db.Find(&notices).Error)
			require.Len(t, notices, step.notices)
			for _, n := range notices {
				require.True(t, n.ForOwners)
				require.Contains(t, n.Link, "stock-alerts=1")
			}
			var alerts []entity.StockAlert
			require.NoError(t, db.Where("is_resolved = ?", "false").Find(&alerts).Error)
			if step.active {
				require.Len(t, alerts, 1)
				require.Equal(t, step.quantity, alerts[0].Quantity_At_Alert)
				require.Equal(t, step.kind, alerts[0].Alert_type)
			} else {
				require.Empty(t, alerts)
			}
		})
	}
}

func TestStockMonitorDisabledThresholdAndConcurrentChecks(t *testing.T) {
	db, service, _ := newStockMonitorDB(t)
	p := entity.Product{Product_Code: "TEST-STOCK", Quantity: 0, Limit_Quantity: 0}
	require.NoError(t, db.Create(&p).Error)
	created, err := service.CheckAndCreateAlerts()
	require.NoError(t, err)
	require.Empty(t, created)
	require.NoError(t, db.Model(&p).Update("limit_quantity", 5).Error)
	var wg sync.WaitGroup
	errors := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, err := service.CheckAndCreateAlerts(); errors <- err }()
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}
	var count int64
	require.NoError(t, db.Model(&entity.StockAlert{}).Count(&count).Error)
	require.EqualValues(t, 1, count)
	require.NoError(t, db.Model(&p).Update("limit_quantity", 0).Error)
	_, err = service.CheckAndCreateAlerts()
	require.NoError(t, err)
	require.NoError(t, db.Model(&entity.StockAlert{}).Where("is_resolved = ?", "false").Count(&count).Error)
	require.Zero(t, count)
}

func TestStockMonitorAfterCommittedRequest(t *testing.T) {
	db, service, notifications := newStockMonitorDB(t)
	p := entity.Product{Product_Code: "TEST-STOCK", Quantity: 8, Limit_Quantity: 5}
	require.NoError(t, db.Create(&p).Error)
	router := gin.New()
	router.Use(wmsRoute.StockAlertCheckMiddleware(service, notifications))
	router.POST("/api/test-sale", func(c *gin.Context) {
		err := db.Transaction(func(tx *gorm.DB) error { return tx.Model(&p).Update("quantity", 5).Error })
		require.NoError(t, err)
		c.Status(http.StatusCreated)
	})
	router.POST("/api/test-failed", func(c *gin.Context) { c.AbortWithStatus(http.StatusBadRequest) })
	router.GET("/api/test-read", func(c *gin.Context) { c.Status(http.StatusOK) })
	for _, request := range []struct {
		method, path    string
		status, notices int
	}{
		{http.MethodPost, "/api/test-failed", 400, 0},
		{http.MethodGet, "/api/test-read", 200, 0},
		{http.MethodPost, "/api/test-sale", 201, 1},
		{http.MethodPost, "/api/test-sale", 201, 1},
	} {
		res := httptest.NewRecorder()
		router.ServeHTTP(res, httptest.NewRequest(request.method, request.path, nil))
		require.Equal(t, request.status, res.Code)
		var count int64
		require.NoError(t, db.Model(&entity.Notification{}).Count(&count).Error)
		require.EqualValues(t, request.notices, count)
	}
}
