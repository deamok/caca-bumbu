import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const BASE = 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
const page = await context.newPage();
const request = context.request;
for (const asset of ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'sw.js']) {
  const response = await request.get(BASE + asset);
  assert.equal(response.status(), 200, asset + ' harus tersedia');
  console.log(asset, response.status(), response.headers()['content-type']);
}
const manifest = await (await request.get(BASE + 'manifest.webmanifest')).json();
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.icons.length, 3);
console.log('manifest OK', manifest.name);
await page.goto(BASE, { waitUntil: 'networkidle' });
const swReady = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return { supported: false };
  const reg = await navigator.serviceWorker.ready;
  return { supported: true, scope: reg.scope, active: Boolean(reg.active) };
});
assert.equal(swReady.active, true, 'service worker aktif');
console.log('service worker active', swReady);
await page.reload({ waitUntil: 'networkidle' });
const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
console.log('controlled after reload', controlled);
await page.getByRole('button', { name: 'Coba dengan data contoh' }).click();
await page.waitForTimeout(500);
// ensure assets cached during online render
await page.goto(BASE + '#/analisa', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
const offline = await page.evaluate(() => ({
  title: document.title,
  hasRoot: Boolean(document.querySelector('#root')?.children.length),
  online: navigator.onLine,
  text: document.body.innerText.slice(0, 120),
}));
console.log('offline state', offline);
assert.equal(offline.hasRoot, true, 'aplikasi tampil saat offline');
assert.ok(offline.text.includes('Tumbuh dengan angka') || offline.text.includes('Caca'), 'UI offline termuat');
await context.setOffline(false);
console.log('PWA OFFLINE OK');
await browser.close();
