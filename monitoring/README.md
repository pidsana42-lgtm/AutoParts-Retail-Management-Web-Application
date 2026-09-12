# AutoParts Monitoring

This stack collects backend HTTP, Go runtime, process, and database connection-pool metrics with Prometheus and displays them in a provisioned Grafana dashboard.

## Prerequisites

- The Go backend is running on port `3000` (the value currently configured in `backend/.env`).
- Docker Engine with Docker Compose is installed.

## Start locally

From the repository root:

```powershell
Copy-Item .env.monitoring.example .env.monitoring
```

Change `GRAFANA_ADMIN_PASSWORD` in `.env.monitoring`, then start the stack:

```powershell
docker compose --env-file .env.monitoring -f docker-compose.monitoring.yml up -d
```

Open:

- Grafana: <http://localhost:3001>
- Prometheus targets: <http://localhost:9090/targets>
- Backend metrics: <http://localhost:3000/metrics>

Grafana provisions the Prometheus data source and the **AutoParts Backend Overview** dashboard automatically. No manual import is required.

## Stop locally

```powershell
docker compose --env-file .env.monitoring -f docker-compose.monitoring.yml down
```

Prometheus and Grafana data remain in named Docker volumes. To intentionally delete those volumes as well, append `--volumes` to the command.

## Backend target

The default target is `host.docker.internal:3000`, which works when the backend runs on the host and Prometheus runs in Docker. Nginx can continue serving the application on port `8080`; Prometheus intentionally scrapes the Go backend directly so Nginx does not need a public `/metrics` route. If the backend later becomes a container on the same Docker network, change the target in `prometheus/prometheus.yml` to the backend service name, such as `backend:3000`.

After changing Prometheus configuration, validate and reload it:

```powershell
docker compose --env-file .env.monitoring -f docker-compose.monitoring.yml exec prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose --env-file .env.monitoring -f docker-compose.monitoring.yml restart prometheus
```

## Production notes

- Keep Prometheus on a private network. The Compose file binds Prometheus and Grafana to localhost by default.
- Put Grafana behind HTTPS and an authenticated reverse proxy, or reach it through an SSH tunnel.
- Block public access to the backend `/metrics` route at the reverse proxy or firewall while allowing Prometheus to scrape it.
- Set a long random Grafana password in `.env.monitoring`; never commit that file.
- The included rules are evaluated by Prometheus and visible in its Alerts page. Sending notifications to LINE, email, or Slack requires adding Alertmanager separately.
- Running Monitoring on the same server is suitable for development and demonstrations. Use a separate server or external uptime monitor if alerts must continue when the application server itself is down.

## Production: separate application and monitoring servers

The production setup uses two servers and the existing domain:

- Application server: `jjautopart-pakchong.com`
- Monitoring server: `monitor.jjautopart-pakchong.com`

Grafana and Prometheus stay available when the application server is down. Prometheus scrapes the application's HTTPS `/metrics` endpoint using a dedicated password. The local setup remains unchanged and continues to use `host.docker.internal`.

### 1. DNS

Create these records at the DNS provider:

```text
Type: A    Name: @          Value: <application server public IP>
Type: A    Name: monitor    Value: <monitoring server public IP>
```

The two records must point to different public IP addresses.

### 2. Application server

Install the password utility and generate a long random password:

```bash
sudo apt update
sudo apt install -y apache2-utils openssl
METRICS_PASSWORD="$(openssl rand -base64 36)"
printf '%s\n' "$METRICS_PASSWORD"
sudo htpasswd -bc /etc/nginx/.htpasswd-prometheus prometheus "$METRICS_PASSWORD"
sudo chmod 640 /etc/nginx/.htpasswd-prometheus
sudo chown root:www-data /etc/nginx/.htpasswd-prometheus
```

Save the printed password temporarily; it is needed on the monitoring server. Do not put it in Git or in a chat message.

Copy the contents of `monitoring/nginx/app-metrics.conf` into the existing HTTPS `server` block for `jjautopart-pakchong.com`. It must replace any existing `location = /metrics { return 404; }` block. Then validate and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Verify the protection from any machine. The first command must return `401`; the second must return Prometheus metrics:

```bash
curl -o /dev/null -s -w '%{http_code}\n' https://jjautopart-pakchong.com/metrics
curl -u prometheus:'<metrics-password>' https://jjautopart-pakchong.com/metrics
```

Keep the backend port `3000` closed to the public internet. Nginx is the only public entry point.

### 3. Monitoring server

Create the production environment and secret files in the repository root:

```bash
cp .env.monitoring.production.example .env.monitoring.production
nano .env.monitoring.production
printf '%s' '<same-metrics-password>' > monitoring/secrets/prometheus_metrics_password
chmod 600 .env.monitoring.production monitoring/secrets/prometheus_metrics_password
```

Start the stack with both Compose files. The second file switches Prometheus from the local target to the remote HTTPS target:

```bash
docker compose \
  --env-file .env.monitoring.production \
  -f docker-compose.monitoring.yml \
  -f docker-compose.monitoring.production.yml \
  up -d
```

Validate that the target is `UP` from the monitoring server:

```bash
docker compose \
  --env-file .env.monitoring.production \
  -f docker-compose.monitoring.yml \
  -f docker-compose.monitoring.production.yml \
  exec prometheus promtool check config /etc/prometheus/prometheus.yml

curl http://127.0.0.1:9090/api/v1/targets
```

### 4. Grafana domain and HTTPS

On the monitoring server, install the provided Nginx virtual host:

```bash
sudo cp monitoring/nginx/grafana.conf /etc/nginx/sites-available/monitor.jjautopart-pakchong.com
sudo ln -s /etc/nginx/sites-available/monitor.jjautopart-pakchong.com /etc/nginx/sites-enabled/monitor.jjautopart-pakchong.com
sudo nginx -t
sudo systemctl reload nginx
```

After DNS resolves to the monitoring server, issue the HTTPS certificate and force redirects:

```bash
sudo certbot --nginx -d monitor.jjautopart-pakchong.com --redirect
```

Open <https://monitor.jjautopart-pakchong.com> and sign in with the credentials from `.env.monitoring.production`.

The Compose file publishes Grafana only on `127.0.0.1:3001`, so it is reachable through Nginx but not directly from the internet. Prometheus remains bound to `127.0.0.1:9090` and must not be exposed publicly.

## Metrics

The backend exports:

- `autoparts_http_requests_total`
- `autoparts_http_request_duration_seconds`
- `autoparts_http_response_size_bytes`
- `autoparts_http_requests_in_flight`
- `autoparts_database_up`
- Go runtime metrics prefixed with `go_`
- Process metrics prefixed with `process_`
- SQL connection-pool metrics prefixed with `go_sql_`

HTTP route labels use Gin route templates rather than raw paths. IDs and other customer-specific URL values are therefore not stored in Prometheus labels.
