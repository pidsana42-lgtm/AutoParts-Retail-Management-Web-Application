#!/bin/bash
set -e

echo "=== 1. Stopping frontend container to free port 80 ==="
docker compose stop frontend || true

echo "=== 2. Requesting SSL certificate via Docker Certbot ==="
docker run --rm -p 80:80 \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  certbot/certbot certonly --standalone \
  -d jjautopart-pakchong.com \
  -d www.jjautopart-pakchong.com \
  -d api.jjautopart-pakchong.com \
  --agree-tos \
  --register-unsafely-without-email \
  --non-interactive

echo "=== 3. Starting all containers with HTTPS and Python FastAPI ==="
docker compose up -d --build

echo "=== Done! Your website is now live with HTTPS (https://jjautopart-pakchong.com) ==="
