import { chromium } from 'playwright';
import fs from 'fs';
fs.mkdirSync('docs/screenshots', { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const errors = [];
async function clearToasts(page) {
  const closers = page.locator('.toast__close');
  const count = await closers.count();
  for (let i = 0; i < count; i++) { try { await closers.nth(0).click({ timeout: 400 }); } catch {} }
}
async function skipAuth(page) {
  const btn = page.getByRole('button', { name: 'Lanjut tanpa akun' });
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(450);
  }
}
async function prep(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(550);
  await clearToasts(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
}
// Mobile
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await skipAuth(page);
  await page.screenshot({ path: 'docs/screenshots/welcome-mobile.png' });
  await page.getByRole('button', { name: 'Coba dengan data contoh' }).click();
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  await clearToasts(page);
  await page.screenshot({ path: 'docs/screenshots/dashboard-mobile.png' });
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('caca-bumbu:state:v1')));
  const active = state.consignments.filter(c => c.status === 'aktif').sort((a,b) => b.items.length - a.items.length)[0];
  await prep(page, 'http://127.0.0.1:4173/#/jual');
  await page.locator('.add-product-btn:not([disabled])').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/screenshots/sale-mobile.png' });
  await prep(page, 'http://127.0.0.1:4173/#/titip/' + active.id);
  await page.screenshot({ path: 'docs/screenshots/consignment-mobile.png' });
  await prep(page, 'http://127.0.0.1:4173/#/analisa');
  await page.screenshot({ path: 'docs/screenshots/analysis-mobile.png' });
  await prep(page, 'http://127.0.0.1:4173/#/pengaturan');
  await page.locator('#settings-wa').fill('081234567890');
  await page.getByRole('button', { name: 'Simpan pengaturan' }).click();
  await page.waitForTimeout(500);
  await prep(page, 'http://127.0.0.1:4173/#/katalog');
  await page.screenshot({ path: 'docs/screenshots/catalog-mobile.png' });
  await page.goto('http://127.0.0.1:4173/#/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await clearToasts(page);
  await page.screenshot({ path: 'docs/screenshots/dashboard-full-mobile.png', fullPage: true });
  await context.close();
}
// Desktop
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await skipAuth(page);
  await page.screenshot({ path: 'docs/screenshots/welcome-desktop.png' });
  await page.getByRole('button', { name: 'Coba dengan data contoh' }).click();
  await page.waitForTimeout(700);
  await clearToasts(page);
  await page.screenshot({ path: 'docs/screenshots/dashboard-desktop.png' });
  await prep(page, 'http://127.0.0.1:4173/#/jual');
  await page.screenshot({ path: 'docs/screenshots/sale-desktop.png' });
  await prep(page, 'http://127.0.0.1:4173/#/analisa');
  await page.screenshot({ path: 'docs/screenshots/analysis-desktop.png' });
  await prep(page, 'http://127.0.0.1:4173/#/titip');
  await page.screenshot({ path: 'docs/screenshots/consignments-desktop.png' });
  await context.close();
}
console.log('screenshots done, errors:', errors);
await browser.close();
