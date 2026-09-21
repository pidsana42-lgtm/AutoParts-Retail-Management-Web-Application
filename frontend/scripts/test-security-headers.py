"""Test the production Nginx config in an isolated container (no exposed ports).

Run after npm run build: python3 scripts/test-security-headers.py
Requires Docker, openssl, and nginx:alpine. The API is a local fixture; no real
backend, database, credentials or production service is used.
"""
from pathlib import Path
import argparse
import re
import subprocess
import tempfile
import time


ROOT = Path(__file__).resolve().parents[1]


def run(*args, check=True):
    return subprocess.run(args, check=check, text=True, capture_output=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", help="Test a pre-built frontend image without overriding its app/config")
    args = parser.parse_args()
    dist = ROOT / "dist"
    assert (dist / "index.html").is_file(), "Run npm run build first"
    js = next((dist / "assets").glob("index-*.js"))
    font = next((dist / "fonts").glob("kanit-*.woff2"))
    with tempfile.TemporaryDirectory(prefix="autoparts-nginx-test-") as directory:
        temp = Path(directory)
        run("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", str(temp / "privkey.pem"), "-out", str(temp / "fullchain.pem"),
            "-days", "1", "-subj", "/CN=localhost")
        fixture = temp / "fixture.conf"
        fixture.write_text('''server {
    listen 8080;
    default_type application/json;
    location /api/ { return 401 '{"error":"test unauthorized"}'; }
    location /uploads/ { return 200 'test-upload'; }
    location / { return 404 '{"error":"test not found"}'; }
}
''')
        app_mounts = [] if args.image else [
            "-v", f"{ROOT / 'nginx.conf'}:/etc/nginx/conf.d/default.conf:ro",
            "-v", f"{dist}:/usr/share/nginx/html:ro",
        ]
        container = run(
            "docker", "run", "--rm", "-d", "--network", "none",
            "--add-host", "backend:127.0.0.1",
            *app_mounts,
            "-v", f"{fixture}:/etc/nginx/conf.d/fixture.conf:ro",
            "-v", f"{temp}:/etc/letsencrypt/live/jjautopart-pakchong.com:ro",
            args.image or "nginx:alpine",
        ).stdout.strip()
        try:
            deadline = time.monotonic() + 30
            while True:
                ready = run("docker", "exec", container, "curl", "--insecure",
                            "--silent", "--show-error", "--max-time", "2",
                            "-o", "/dev/null", "https://127.0.0.1/", check=False)
                if ready.returncode == 0 or time.monotonic() >= deadline:
                    break
                time.sleep(0.2)
            if ready.returncode != 0:
                logs = run("docker", "logs", "--tail", "40", container, check=False)
                raise AssertionError(ready.stderr + logs.stdout + logs.stderr)
            run("docker", "exec", container, "nginx", "-t")
            print("PASS production nginx -t")
            no_cache = "no-cache, no-store, must-revalidate"
            cases = [
                ("/", 200, no_cache),
                ("/owner/pre-orders", 200, no_cache),
                ("/index.html", 200, no_cache),
                ("/fonts/fonts.css", 200, no_cache),
                (f"/assets/{js.name}", 200, "public, max-age=31536000, immutable"),
                (f"/fonts/{font.name}", 200, "public, max-age=31536000, immutable"),
                ("/assets/missing-12345678.js", 404, no_cache),
                ("/fonts/missing-12345678.woff2", 404, no_cache),
                ("/api/security-test", 401, no_cache),
                ("/uploads/security-test.pdf", 200, no_cache),
            ]
            for path, status, cache in cases:
                result = run("docker", "exec", container, "curl", "--insecure",
                             "--silent", "--show-error", "--max-time", "10",
                             "-D", "-", "-o", "/dev/null", f"https://127.0.0.1{path}")
                raw = result.stdout
                assert re.search(rf"HTTP/\S+ {status}\b", raw), (path, raw)
                headers = {}
                for name, value in re.findall(r"^\s*([\w-]+):\s*(.*?)\s*$", raw, re.M):
                    headers.setdefault(name.lower(), []).append(value)
                assert headers.get("cache-control") == [cache], (path, headers)
                assert headers.get("x-content-type-options") == ["nosniff"], path
                assert headers.get("x-frame-options") == ["SAMEORIGIN"], path
                assert headers.get("strict-transport-security"), path
                policies = headers.get("content-security-policy", [])
                assert len(policies) == 1, (path, policies)
                policy = policies[0]
                for directive in ["default-src 'self'", "object-src 'none'",
                                  "frame-ancestors 'self'", "base-uri 'self'",
                                  "form-action 'self'", "worker-src 'self' blob:"]:
                    assert directive in policy, (path, directive)
                script_src = re.search(r"(?:^|; )script-src ([^;]+)", policy)[1]
                assert "'unsafe-inline'" not in script_src, path
                assert "'unsafe-hashes'" in script_src, path
                assert "'sha256-J3nlF6EE2ba/eonWbGGU820R887iSi5IElN4af4iX2E='" in script_src, path
                print(f"PASS {status} {path}: cache and security headers")
            html = (dist / "index.html").read_text()
            assert "fonts.googleapis.com" not in html
            assert 'href="/fonts/fonts.css"' in html
            css = (dist / "fonts/fonts.css").read_text()
            urls = re.findall(r"url\(([^)]+)\)", css)
            assert urls and all(url.startswith("/fonts/") for url in urls)
            for url in set(urls):
                assert (dist / url.lstrip("/")).read_bytes().startswith(b"wOF2"), url
            for family in ("inter", "kanit", "sarabun"):
                assert "SIL OPEN FONT LICENSE" in (dist / f"fonts/{family}-OFL.txt").read_text()
            print(f"PASS local fonts: {len(set(urls))} files, 3 licenses, no external root stylesheet")
        finally:
            run("docker", "stop", container, check=False)


if __name__ == "__main__":
    main()
