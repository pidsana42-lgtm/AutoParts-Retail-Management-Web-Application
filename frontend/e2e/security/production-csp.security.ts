import { test, expect, type Page } from '@playwright/test';
import { jsPDF } from 'jspdf';
import { readFile } from 'node:fs/promises';

const fixturePdf = new jsPDF();
fixturePdf.text('Synthetic security test - no customer data', 20, 20);
const pdfBytes = Buffer.from(fixturePdf.output('arraybuffer'));

type BrowserEvidence = { violations: string[]; errors: string[]; external: string[]; calls: string[] };
let evidence: BrowserEvidence;

test.beforeEach(async ({ context, baseURL }) => {
  evidence = { violations: [], errors: [], external: [], calls: [] };
  await context.exposeBinding('recordCspViolation', (_source, value: string) => evidence.violations.push(value));
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      (window as any).recordCspViolation(`${event.effectiveDirective}: ${event.blockedURI}`);
    });
  });
  context.on('page', page => page.on('pageerror', error => evidence.errors.push(error.message)));
  await context.routeWebSocket('**/*', () => { /* Isolated mock, no upstream connection. */ });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    // Chrome's built-in PDF viewer reads its bundled CSS from this extension.
    // This is a browser-local resource, not an outbound HTTP request.
    if ((url.protocol === 'chrome-extension:' && url.hostname === 'mhjfbmdgcfjbbpaeojofohoefgiehjai') ||
        (url.protocol === 'chrome:' && url.hostname === 'resources')) {
      return route.continue();
    }
    if (url.origin !== baseURL) {
      evidence.external.push(url.origin + url.pathname);
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/api/')) {
      evidence.calls.push(`${request.method()} ${url.pathname}`);
      if (url.pathname === '/api/auth/login') {
        const role = request.postDataJSON().username === 'security-employee' ? 'Employee' : 'Owner';
        return route.fulfill({ json: { token: 'synthetic-browser-test-token', role, id: 99999,
          username: `security-${role.toLowerCase()}`, first_name: 'Security', last_name: 'Fixture' } });
      }
      if (url.pathname === '/api/ocr/extract-invoice/upload') {
        expect(request.headers().authorization).toBe('Bearer synthetic-browser-test-token');
        return route.fulfill({ status: 403, json: { error: 'Security fixture: denied' } });
      }
      if (url.pathname === '/api/mobile/images') return route.fulfill({ json: { images: [] } });
      if (url.pathname === '/api/claims/customer-claims/export/checklist-pdf') {
        expect(request.headers().authorization).toBe('Bearer synthetic-browser-test-token');
        return route.fulfill({ contentType: 'application/pdf', body: pdfBytes });
      }
      // Empty list fixtures for read-only page rendering. Writes fail closed.
      if (request.method() !== 'GET') return route.fulfill({ status: 403, json: { error: 'Fixture write blocked' } });
      return route.fulfill({ json: { data: [], items: [], notifications: [], total: 0 } });
    }
    if (request.method() !== 'GET' || /^\/(uploads|barcode|qrcode|ws)(\/|$)/.test(url.pathname)) {
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
});

test.afterEach(async ({}, testInfo) => {
  await testInfo.attach('browser-security-evidence', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  expect(evidence.external, 'No third-party or live backend requests').toEqual([]);
  expect(evidence.errors, 'No uncaught browser errors').toEqual([]);
  expect(evidence.violations, 'No unexpected CSP violations').toEqual([]);
});

async function login(page: Page, role: 'owner' | 'employee') {
  await page.goto('/login');
  await page.locator('#username').fill(`security-${role}`);
  await page.locator('#password').fill('synthetic-password');
  await page.getByRole('button', { name: /เข้าสู่ระบบ/ }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}/`));
}

for (const role of ['owner', 'employee'] as const) {
  test(`${role}: login, import, preorder, claims and returns under production CSP`, async ({ page }) => {
    await login(page, role);
    const routes = [
      [role === 'owner' ? 'import-bills' : 'import', /นำเข้า/],
      ['pre-orders', /ระบบจัดการสั่งจองสินค้าล่วงหน้า/],
      ['claims', /จัดการเคลมสินค้า/],
      ['returns', /คืนสินค้า/],
    ] as const;
    for (const [path, title] of routes) {
      await page.goto(`/${role}/${path}`);
      await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(title);
    }
    for (const endpoint of ['/api/import-data/bills', '/api/wms/pre-orders', '/api/claims/customer-claims', '/api/returns']) {
      expect(evidence.calls).toContain(`GET ${endpoint}`);
    }
  });

  test(`${role}: image preview and denied OCR never bypass the backend`, async ({ page }) => {
    await login(page, role);
    await page.goto(`/${role}/${role === 'owner' ? 'import-bills' : 'import'}/scan`);
    await page.locator('input[type=file]').first().setInputFiles({ name: 'fixture.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9V8AAAAASUVORK5CYII=', 'base64') });
    await expect(page.locator('img[src^="blob:"]').first()).toBeVisible();
    await expect.poll(() => page.locator('img[src^="blob:"]').first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'สแกนข้อมูลบิล', exact: true }).click();
    await expect(page.getByText(/Security fixture: denied/).first()).toBeVisible();
    expect(evidence.calls.filter(call => call.includes('ocr'))).toEqual(['POST /api/ocr/extract-invoice/upload']);
  });

  test(`${role}: HEIC decodes in the production worker and mobile QR renders`, async ({ page }) => {
    await login(page, role);
    await page.goto(`/${role}/${role === 'owner' ? 'import-bills' : 'import'}/scan`);
    await page.locator('input[type=file]').first().setInputFiles('e2e/security/fixtures/red-square.heic');
    const preview = page.getByRole('img', { name: 'Invoice Preview' });
    await expect(preview).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(32);
    await page.getByRole('button', { name: 'เปิดบนมือถือ', exact: true }).click();
    await expect(page.getByText('สแกนด้วยมือถือ', { exact: true })).toBeVisible();
    await expect(page.locator('svg[width="220"][height="220"]')).toBeVisible();
  });

  test(`${role}: claim PDF download preserves the server document`, async ({ page }) => {
    await login(page, role);
    await page.goto(`/${role}/claims`);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'พิมพ์ใบเช็คลิสต์เคลม (PDF)', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^Claim_Checklist_\d{8}\.pdf$/);
    expect(await download.failure()).toBeNull();
    expect(await readFile((await download.path())!)).toEqual(pdfBytes);
  });

  test(`${role}: PDF import previews the document under CSP`, async ({ page }, testInfo) => {
    await login(page, role);
    await page.goto(`/${role}/${role === 'owner' ? 'import-bills' : 'import'}/scan`);
    await page.locator('input[type=file]').first().setInputFiles({ name: 'fixture.pdf', mimeType: 'application/pdf', buffer: pdfBytes });
    await expect(page.locator('iframe[title="Invoice PDF Preview"]')).toBeVisible();
    await expect.poll(() => page.frames().some(frame => frame.url().startsWith('blob:'))).toBe(true);
    await expect.poll(() => page.frames().some(frame => frame.url().startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'))).toBe(true);
    const viewer = page.frames().find(frame => frame.url().startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'))!;
    await expect(viewer.locator('pdf-viewer')).toBeVisible();
    await testInfo.attach('PDF preview', { body: await page.screenshot(), contentType: 'image/png' });
    await page.getByRole('button', { name: 'สแกนข้อมูลบิล', exact: true }).click();
    await expect(page.getByText(/Security fixture: denied/).first()).toBeVisible();
  });
}

test('self-hosted fonts render Thai and Latin without Google font requests', async ({ page }) => {
  await page.goto('/login');
  for (const family of ['Inter', 'Sarabun', 'Kanit']) {
    const loaded = await page.evaluate(async family => {
      const faces = await document.fonts.load(`600 16px "${family}"`, 'อะไหล่ ABC');
      return faces.length > 0 && faces.every(face => face.status === 'loaded');
    }, family);
    expect(loaded, family).toBe(true);
  }
});

test('CSP blocks arbitrary inline scripts while allowing the exact existing print handler', async ({ page }) => {
  await page.goto('/login');
  const result = await page.evaluate(async () => {
    const script = document.createElement('script');
    script.textContent = 'window.unapprovedInlineExecuted = true';
    document.body.append(script);
    let printed = false;
    let closed = false;
    window.print = () => { printed = true; };
    window.close = () => { closed = true; };
    const button = document.createElement('button');
    button.setAttribute('onclick', 'window.print();window.close();');
    document.body.append(button);
    button.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    return { arbitrary: !!(window as any).unapprovedInlineExecuted, printed, closed };
  });
  expect(result).toEqual({ arbitrary: false, printed: true, closed: true });
  expect(evidence.violations).toEqual(['script-src-elem: inline']);
  evidence.violations = []; // Only the deliberately injected attack is expected.
});
