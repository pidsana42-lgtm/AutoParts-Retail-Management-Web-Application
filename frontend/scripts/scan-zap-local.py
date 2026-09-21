"""Passive ZAP baseline against production Nginx/dist, with no production traffic.

Run after npm run build: python3 scripts/scan-zap-local.py
Requires Docker images nginx:alpine and ghcr.io/zaproxy/zaproxy:stable.
Containers communicate only over a temporary internal network; no host ports,
real backend, credentials, browser automation or database are used.
"""
from datetime import date
import argparse
from pathlib import Path
import json
import shutil
import subprocess
import tempfile
import uuid


ROOT = Path(__file__).resolve().parents[1]


def run(*args, check=True):
    return subprocess.run(args, check=check, text=True, capture_output=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", help="Scan a pre-built frontend image without overriding its app/config")
    args = parser.parse_args()
    assert (ROOT / "dist/index.html").is_file(), "Run npm run build first"
    output = ROOT.parent / "docs/security"
    output.mkdir(parents=True, exist_ok=True)
    prefix = "zap-local-" + date.today().isoformat()
    network = "autoparts-zap-" + uuid.uuid4().hex[:10]
    nginx = None
    scanner = network + "-scanner"
    with tempfile.TemporaryDirectory(prefix="autoparts-zap-") as directory:
        temp = Path(directory)
        reports = temp / "reports"
        reports.mkdir(mode=0o777)
        reports.chmod(0o777)  # Disposable, non-sensitive output for the zap user.
        run("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", str(temp / "privkey.pem"), "-out", str(temp / "fullchain.pem"),
            "-days", "1", "-subj", "/CN=autoparts-security-web")
        fixture = temp / "fixture.conf"
        fixture.write_text('''server {
    listen 8080;
    default_type application/json;
    location / { return 401 '{"error":"isolated test backend"}'; }
}
''')
        run("docker", "network", "create", "--internal", network)
        try:
            app_mounts = [] if args.image else [
                "-v", f"{ROOT / 'nginx.conf'}:/etc/nginx/conf.d/default.conf:ro",
                "-v", f"{ROOT / 'dist'}:/usr/share/nginx/html:ro",
            ]
            nginx = run(
                "docker", "run", "--rm", "-d", "--network", network,
                "--network-alias", "autoparts-security-web",
                "--add-host", "backend:127.0.0.1",
                *app_mounts,
                "-v", f"{fixture}:/etc/nginx/conf.d/fixture.conf:ro",
                "-v", f"{temp}:/etc/letsencrypt/live/jjautopart-pakchong.com:ro",
                args.image or "nginx:alpine",
            ).stdout.strip()
            run("docker", "exec", nginx, "nginx", "-t")
            print("Scanning isolated https://autoparts-security-web/ (no browser/active scan)", flush=True)
            scan = subprocess.run([
                "docker", "run", "--rm", "--name", scanner, "--network", network,
                "-v", f"{reports}:/zap/wrk:rw", "ghcr.io/zaproxy/zaproxy:stable",
                "zap-baseline.py", "-t", "https://autoparts-security-web/",
                "-m", "1", "-T", "3", "-s", "--autooff",
                "-z", "-config autoupdate.checkOnStart=false -config autoupdate.installAddonUpdates=false",
                "-r", prefix + ".html", "-J", prefix + ".json",
            ], timeout=420)
            for suffix in (".html", ".json"):
                report = reports / (prefix + suffix)
                assert report.is_file(), f"ZAP did not produce {report.name}; exit {scan.returncode}"
                shutil.copyfile(report, output / report.name)
            data = json.loads((output / (prefix + ".json")).read_text())
            for site in data.get("site", []):
                for alert in site.get("alerts", []):
                    print(f"{alert['riskdesc']}: {alert['name']} ({alert['count']} instances)")
            print(f"Reports saved to {output / prefix}")
            if scan.returncode not in (0, 2):
                raise RuntimeError(f"ZAP failed with exit {scan.returncode}")
        finally:
            # Remove only this invocation's disposable containers/network.
            run("docker", "rm", "-f", scanner, check=False)
            if nginx:
                run("docker", "stop", nginx, check=False)
            run("docker", "network", "rm", network, check=False)


if __name__ == "__main__":
    main()
