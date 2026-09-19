package middleware

import (
	"time"

	"backend/internal/pkg/monitoring"

	"github.com/gin-gonic/gin"
)

// PrometheusMetrics records application requests without exposing raw URL
// paths. The /metrics scrape itself is intentionally excluded.
func PrometheusMetrics(metrics *monitoring.HTTPMetrics) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		startedAt := time.Now()
		metrics.RequestStarted()
		defer func() {
			route := c.FullPath()
			if route == "" {
				route = "unmatched"
			}
			metrics.RequestFinished(
				c.Request.Method,
				route,
				c.Writer.Status(),
				c.Writer.Size(),
				time.Since(startedAt),
			)
		}()

		c.Next()
	}
}
