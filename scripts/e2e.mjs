import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const getState = () => page.evaluate(() => JSON.parse(localStorage.getItem('caca-bumbu:state:v1')));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Coba dengan data contoh' }).click();
await page.waitForTimeout(500);
let state = await getState();
assert.equal(state.meta.demo, true, 'mode demo aktif');
assert.equal(state.products.length, 10, '10 produk dari CSV');
console.log('onboarding + demo OK');

// Penjualan langsung
await page.goto(BASE + '#/jual', { waitUntil: 'networkidle' });
const stockBefore = (await getState()).products.find(product => product.id === 'p-rendang').stock;
await page.locator('.add-product-btn').first().click();
await page.locator('.cart-bar .btn').click();
await page.getByRole('button', { name: 'Simpan penjualan' }).click();
await page.waitForTimeout(500);
state = await getState();
assert.equal(state.sales.length, 10, 'penjualan baru tersimpan');
assert.equal(state.products.find(product => product.id === 'p-rendang').stock, stockBefore - 1, 'stok turun 1');
assert.ok(state.sales[0].code.startsWith('JL-'), 'kode penjualan benar');
console.log('sale flow OK', state.sales[0].code);

// Tutup sheet sukses
const newTx = page.getByRole('button', { name: 'Transaksi baru' });
if (await newTx.count()) await newTx.click();

// Rekonsiliasi titipan
state = await getState();
const active = state.consignments.filter(item => item.status === 'aktif').sort((a, b) => b.items.length - a.items.length)[0];
assert.ok(active, 'ada titipan aktif');
await page.goto(BASE + '#/titip/' + active.id, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Semua laku' }).click();
await page.waitForTimeout(300);
const totalText = await page.locator('.confirm-card h2').innerText();
const total = Number(totalText.replace(/[^0-9]/g, ''));
assert.ok(total > 0, 'total penjualan titipan terhitung');
await page.locator('#settlement').fill(String(Math.floor(total / 2)));
await page.getByRole('switch', { name: 'Langsung titip bumbu baru' }).click();
await page.waitForTimeout(200);
const nextPlus = page.locator('.next-drop__row .stepper button').last();
await nextPlus.click();
await page.getByRole('button', { name: 'Selesaikan kunjungan' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Ya, simpan kunjungan' }).click();
await page.waitForTimeout(800);
state = await getState();
const closed = state.consignments.find(item => item.id === active.id);
assert.equal(closed.status, 'selesai', 'titipan lama selesai');
assert.ok(closed.items.every(item => item.soldQty === item.sentQty), 'semua laku tersimpan');
assert.equal(state.consignments.filter(item => item.status === 'aktif').length, 3, 'titipan baru + 2 lama aktif');
const ccPayments = state.payments.filter(p => p.refType === 'consignment' && p.refId === active.id);
assert.equal(ccPayments.reduce((s, p) => s + p.amount, 0), Math.floor(total / 2), 'setoran sebagian tercatat');
console.log('consignment reconciliation OK', active.code);

// Belanja bahan
await page.goto(BASE + '#/bahan/beli', { waitUntil: 'networkidle' });
await page.getByLabel('Nama bahan').fill('Cabai rawit');
await page.getByLabel('Jumlah').fill('2');
await page.getByLabel('Total harga').fill('90000');
await page.locator('.form-dock .btn').click();
await page.waitForTimeout(700);
state = await getState();
assert.equal(state.purchases[0].total, 90000, 'belanja tersimpan');
assert.ok(state.ingredients.some(item => item.name.toLowerCase() === 'cabai rawit'), 'bahan baru terdaftar');
console.log('purchase flow OK');

// Pengaturan WhatsApp + link katalog lintas perangkat
await page.goto(BASE + '#/pengaturan', { waitUntil: 'networkidle' });
await page.locator('#settings-wa').fill('081234567890');
await page.getByRole('button', { name: 'Simpan pengaturan' }).click();
await page.waitForTimeout(400);
state = await getState();
assert.equal(state.settings.whatsapp, '081234567890', 'nomor WhatsApp tersimpan');
const sharedLink = (await page.locator('.catalog-preview code').innerText()).trim();
assert.ok(sharedLink.includes('#/katalog?d='), 'link katalog membawa snapshot: ' + sharedLink.slice(0, 80));
console.log('shared catalog link length', sharedLink.length);

const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
const customerPage = await customerContext.newPage();
customerPage.on('pageerror', error => errors.push('customer: ' + error.message));
customerPage.on('console', message => { if (message.type() === 'error') errors.push('customer: ' + message.text()); });
await customerPage.goto(BASE + '#/katalog', { waitUntil: 'networkidle' });
assert.ok(await customerPage.getByText('Katalog belum dibagikan').isVisible(), 'link tanpa snapshot tidak menampilkan katalog kosong');
await customerPage.goto(sharedLink, { waitUntil: 'networkidle' });
assert.ok(await customerPage.getByText('Dapur Caca').first().isVisible(), 'nama penjual terbawa ke perangkat warung');
assert.ok(await customerPage.getByText('Tanya penjual').isVisible(), 'katalog WhatsApp aktif di perangkat warung');
await customerPage.locator('.catalog-add').first().click();
await customerPage.getByRole('button', { name: 'Pesan sekarang' }).click();
await customerPage.getByLabel('Nama pemesan').fill('Bu Sari');
await customerPage.evaluate(() => { window.__waUrl = ''; window.open = (url) => { window.__waUrl = String(url); return null; }; });
await customerPage.getByRole('button', { name: 'Kirim lewat WhatsApp' }).click();
await customerPage.waitForTimeout(200);
const waUrl = await customerPage.evaluate(() => window.__waUrl);
assert.ok(waUrl.includes('wa.me/6281234567890'), 'nomor WhatsApp tujuan benar: ' + waUrl);
assert.ok(decodeURIComponent(waUrl).includes('Bu Sari'), 'nama pemesan pada pesan WA');
console.log('cross-device catalog order OK', waUrl.slice(0, 60) + '...');
await customerContext.close();

// Simpan data setelah reload
await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
assert.ok(await page.getByText(/Selamat (pagi|siang|sore|malam), Caca/).isVisible(), 'data dan sesi bertahan setelah reload');
console.log('persistence OK');

assert.deepEqual(errors, [], 'tidak ada console error');
console.log('ALL E2E OK');
await browser.close();