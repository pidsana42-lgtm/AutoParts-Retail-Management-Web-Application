"""Run isolated Chromium compatibility tests against the production frontend/CSP.

Requires Docker, openssl, installed Google Chrome and frontend node_modules.
Publishes one random loopback HTTPS port. All API/WebSocket requests are mocked
by Playwright; the container's backend resolves to a local deny-all fixture.
"""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]


def run(*args, check=True):
    result = subprocess.run(args, text=True, capture_output=True)
    if check and result.returncode:
        raise RuntimeError(f'{args[0]} failed: {result.stderr}')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', default='autoparts-security-review:2026-09-21')
    parser.add_argument('--grep', help='Run only matching browser tests')
    args = parser.parse_args()
    network = 'autoparts-browser-' + uuid.uuid4().hex[:10]
    container = None
    with tempfile.TemporaryDirectory(prefix='autoparts-browser-') as directory:
        temp = Path(directory)
        run('openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
            '-keyout', str(temp / 'privkey.pem'), '-out', str(temp / 'fullchain.pem'),
            '-days', '1', '-subj', '/CN=jjautopart-pakchong.com')
        fixture = temp / 'fixture.conf'
        fixture.write_text('server { listen 8080; location / { return 503; } }\n')
        run('docker', 'network', 'create', network)
        try:
            container = run('docker', 'run', '--rm', '-d', '--network', network,
                            '--add-host', 'backend:127.0.0.1',
                            '-p', '127.0.0.1::443',
                            '-v', f'{fixture}:/etc/nginx/conf.d/fixture.conf:ro',
                            '-v', f'{temp}:/etc/letsencrypt/live/jjautopart-pakchong.com:ro',
                            args.image).stdout.strip()
            deadline = time.monotonic() + 30
            while True:
                ready = run('docker', 'exec', container, 'curl', '-ksS', '--max-time', '2',
                            '-o', '/dev/null', 'https://127.0.0.1/', check=False)
                if ready.returncode == 0:
                    break
                if time.monotonic() > deadline:
                    raise RuntimeError(run('docker', 'logs', container, check=False).stderr)
                time.sleep(0.2)
            port = run('docker', 'port', container, '443/tcp').stdout.strip().split(':')[-1]
            origin = f'https://jjautopart-pakchong.com:{port}'
            print(f'Testing isolated image {args.image} on loopback port {port}', flush=True)
            result = subprocess.run(
                [str(ROOT / 'node_modules/.bin/playwright'), 'test', '-c', 'playwright.security.config.ts',
                 *(['--grep', args.grep] if args.grep else [])],
                cwd=ROOT, env={**os.environ, 'SECURITY_TEST_ORIGIN': origin},
            )
            return result.returncode
        finally:
            if container:
                run('docker', 'stop', container, check=False)
            run('docker', 'network', 'rm', network, check=False)


if __name__ == '__main__':
    raise SystemExit(main())
