package monitoring

import (
	"context"
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const namespace = "autoparts"

// HTTPMetrics contains bounded-cardinality metrics for the Gin HTTP server.
// Route labels use Gin route templates (for example /api/products/:id), never
// raw request paths, so customer and order identifiers are not exported.
type HTTPMetrics struct {
	requestsTotal    *prometheus.CounterVec
	requestDuration  *prometheus.HistogramVec
	responseSize     *prometheus.HistogramVec
	requestsInFlight prometheus.Gauge
}

// NewRegistry creates an isolated registry for this application. Keeping it
// isolated avoids accidental registration of metrics from unrelated packages.
func NewRegistry(database *sql.DB) (*prometheus.Registry, *HTTPMetrics) {
	registry := prometheus.NewRegistry()
	registry.MustRegister(
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
	)

	if database != nil {
		registry.MustRegister(
			collectors.NewDBStatsCollector(database, "autoparts"),
			prometheus.NewGaugeFunc(
				prometheus.GaugeOpts{
					Namespace: namespace,
					Subsystem: "database",
					Name:      "up",
					Help:      "Whether the backend can ping the database (1 = reachable, 0 = unreachable).",
				},
				func() float64 {
					ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
					defer cancel()
					if err := database.PingContext(ctx); err != nil {
						return 0
					}
					return 1
				},
			),
		)
	}

	httpMetrics := NewHTTPMetrics(registry)
	return registry, httpMetrics
}

// NewHTTPMetrics registers application HTTP metrics with the provided registry.
func NewHTTPMetrics(registerer prometheus.Registerer) *HTTPMetrics {
	metrics := &HTTPMetrics{
		requestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: "http",
				Name:      "requests_total",
				Help:      "Total number of HTTP requests processed by the backend.",
			},
			[]string{"method", "route", "status"},
		),
		requestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: "http",
				Name:      "request_duration_seconds",
				Help:      "HTTP request duration in seconds.",
				Buckets:   prometheus.DefBuckets,
			},
			[]string{"method", "route", "status"},
		),
		responseSize: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: "http",
				Name:      "response_size_bytes",
				Help:      "HTTP response size in bytes.",
				Buckets:   prometheus.ExponentialBuckets(256, 4, 8),
			},
			[]string{"method", "route", "status"},
		),
		requestsInFlight: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: "http",
				Name:      "requests_in_flight",
				Help:      "Current number of HTTP requests being processed.",
			},
		),
	}

	registerer.MustRegister(
		metrics.requestsTotal,
		metrics.requestDuration,
		metrics.responseSize,
		metrics.requestsInFlight,
	)
	return metrics
}

// RequestStarted records that an application request has begun.
func (m *HTTPMetrics) RequestStarted() {
	m.requestsInFlight.Inc()
}

// RequestFinished records the result of an application request.
func (m *HTTPMetrics) RequestFinished(method, route string, status, size int, duration time.Duration) {
	m.requestsInFlight.Dec()
	statusLabel := strconv.Itoa(status)
	labels := []string{method, route, statusLabel}
	m.requestsTotal.WithLabelValues(labels...).Inc()
	m.requestDuration.WithLabelValues(labels...).Observe(duration.Seconds())
	if size < 0 {
		size = 0
	}
	m.responseSize.WithLabelValues(labels...).Observe(float64(size))
}

// Handler returns the Prometheus exposition handler for this registry.
func Handler(registry *prometheus.Registry) http.Handler {
	return promhttp.HandlerFor(registry, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
	})
}
