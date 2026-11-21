import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = `${(process.env.APP_URL || 'https://caca-bumbu.netlify.app').replace(/\/$/, '')}/`;
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

console.log('live base:', BASE);
for (const path of ['', 'manifest.webmanifest', 'sw.js', 'icons/icon-192.png', 'icons/icon-512.png']) {
  const res = await context.request.get(BASE + path, { headers: { 'Cache-Control': 'no-cache' } });
  console.log(path || 'index', res.status(), res.headers()['content-type']);
  assert.equal(res.status(), 200, 'asset harus 200: ' + path);
}

await page.goto(BASE + '?v=' + Date.now(), { waitUntil: 'networkidle' });
console.log('title', await page.title());

// Bila build memakai Supabase, halaman login tampil lebih dulu.
const offlineButton = page.getByRole('button', { name: 'Lanjut tanpa akun' });
if (await offlineButton.count()) {
  console.log('auth gate terdeteksi, memakai mode lokal untuk uji');
  await offlineButton.click();
  await page.waitForTimeout(400);
}

await page.getByRole('button', { name: 'Coba dengan data contoh' }).click();
await page.waitForTimeout(900);
assert.ok(await page.getByText(/Selamat (pagi|siang|sore|malam), Caca/).isVisible(), 'dashboard tampil');
console.log('demo dashboard OK');
const state = await page.evaluate(() => JSON.parse(localStorage.getItem('caca-bumbu:state:v1')));
assert.ok(state.products.length === 10, '10 produk');

// Buat link katalog snapshot lalu buka di konteks "perangkat warung"
await page.goto(BASE + '#/pengaturan', { waitUntil: 'networkidle' });
await page.locator('#settings-wa').fill('081234567890');
await page.getByRole('button', { name: 'Simpan pengaturan' }).click();
await page.waitForTimeout(400);
const sharedLink = (await page.locator('.catalog-preview code').innerText()).trim();
assert.ok(sharedLink.includes('#/katalog?d='), 'link katalog membawa snapshot');
console.log('shared link length', sharedLink.length);

const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
const customerPage = await customerContext.newPage();
customerPage.on('pageerror', e => errors.push('customer: ' + e.message));
customerPage.on('console', m => { if (m.type() === 'error') errors.push('customer: ' + m.text()); });
await customerPage.goto(BASE + '#/katalog', { waitUntil: 'networkidle' });
assert.ok(await customerPage.getByText('Katalog belum dibagikan').isVisible(), 'katalog tanpa snapshot ditolak');
await customerPage.goto(sharedLink, { waitUntil: 'networkidle' });
assert.ok(await customerPage.getByText('Dapur Caca').first().isVisible(), 'identitas penjual terbaca');
assert.ok(await customerPage.getByText('Tanya penjual').isVisible(), 'WhatsApp penjual terbaca');
await customerPage.locator('.catalog-add').first().click();
await customerPage.getByRole('button', { name: 'Pesan sekarang' }).click();
await customerPage.getByLabel('Nama pemesan').fill('Bu Sari');
await customerPage.evaluate(() => { window.__waUrl = ''; window.open = (url) => { window.__waUrl = String(url); return null; }; });
await customerPage.getByRole('button', { name: 'Kirim lewat WhatsApp' }).click();
await customerPage.waitForTimeout(200);
const waUrl = await customerPage.evaluate(() => window.__waUrl);
assert.ok(waUrl.includes('wa.me/6281234567890'), 'nomor WhatsApp tujuan benar');
assert.ok(decodeURIComponent(waUrl).includes('Bu Sari'), 'nama pemesan pada pesan');
console.log('LIVE SHARED CATALOG OK');
await customerContext.close();

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const sw = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.ready;
  return { scope: registration.scope, active: Boolean(registration.active), controller: Boolean(navigator.serviceWorker.controller) };
});
console.log('service worker', sw);
assert.equal(sw.active, true);
assert.ok(sw.scope.endsWith('/'), 'scope PWA di root');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
console.log('controlled', controlled);
assert.equal(controlled, true);
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
assert.ok(await page.getByText(/Selamat (pagi|siang|sore|malam), Caca/).isVisible(), 'offline tampil');
console.log('OFFLINE LIVE OK');
await context.setOffline(false);
assert.deepEqual(errors, []);
console.log('LIVE DEPLOY OK');
await browser.close();
