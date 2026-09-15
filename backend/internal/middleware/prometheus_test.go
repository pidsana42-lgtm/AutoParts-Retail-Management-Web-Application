package middleware_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"backend/internal/middleware"
	"backend/internal/pkg/monitoring"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
)

func TestPrometheusMetricsRecordsRouteTemplateAndSkipsScrape(t *testing.T) {
	gin.SetMode(gin.TestMode)
	registry := prometheus.NewRegistry()
	httpMetrics := monitoring.NewHTTPMetrics(registry)

	router := gin.New()
	router.Use(middleware.PrometheusMetrics(httpMetrics))
	router.GET("/orders/:id", func(c *gin.Context) {
		c.Status(http.StatusCreated)
	})
	router.GET("/metrics", gin.WrapH(monitoring.Handler(registry)))

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/orders/12345", nil))
	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, response.Code)
	}

	metricsResponse := httptest.NewRecorder()
	router.ServeHTTP(metricsResponse, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body, err := io.ReadAll(metricsResponse.Body)
	if err != nil {
		t.Fatalf("read metrics response: %v", err)
	}
	metricsText := string(body)

	expected := `autoparts_http_requests_total{method="GET",route="/orders/:id",status="201"} 1`
	if !strings.Contains(metricsText, expected) {
		t.Fatalf("expected metrics to contain %q, got:\n%s", expected, metricsText)
	}
	if strings.Contains(metricsText, `route="/orders/12345"`) {
		t.Fatal("raw request path must not be used as a metric label")
	}
	if strings.Contains(metricsText, `route="/metrics"`) {
		t.Fatal("metrics scrapes must not instrument themselves")
	}
}
