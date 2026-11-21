/**
 * Uji alur cloud (login, unggah awal, diff, antrean luring, perangkat kedua)
 * memakai Supabase tiruan di dalam Playwright — tanpa jaringan dan tanpa akun.
 *
 * Prasyarat: build dengan kredensial dummy, mis.
 *   VITE_SUPABASE_URL=https://demo-project.supabase.co VITE_SUPABASE_ANON_KEY=xxx \
 *     pnpm exec vite build --outDir dist-auth
 *   pnpm exec vite preview --outDir dist-auth --port 4180
 * lalu:
 *   node scripts/cloud-e2e.mjs
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.CLOUD_BASE || 'http://127.0.0.1:4180/';
const ORIGIN = new URL(BASE).origin;
const PROJECT = 'https://demo-project.supabase.co';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const TABLES = ['products', 'warungs', 'sales', 'consignments', 'payments', 'ingredients', 'purchases', 'stock_moves', 'app_settings', 'app_meta'];
const USER_TABLES = new Set(['app_settings', 'app_meta']);

/* ------------------------------- Supabase tiruan ---------------------------- */

const db = new Map(TABLES.map((table) => [table, new Map()]));
const stats = { requests: 0, writes: 0, deletes: 0, auth: 0 };

function rowKey(table, row) {
  return USER_TABLES.has(table) ? String(row.user_id) : `${row.user_id}::${row.id}`;
}

function rowsOf(table) {
  return [...db.get(table).values()];
}

function corsHeaders() {
  return {
    'access-control-allow-origin': ORIGIN,
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, apikey, content-type, prefer, range, x-client-info, accept, x-supabase-api-version',
    'access-control-expose-headers': 'content-range, content-profile, x-supabase-api-version',
    'access-control-max-age': '86400',
  };
}

function fulfillJson(route, status, body, extra = {}) {
  return route.fulfill({
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(),
      ...extra,
    },
    body: body === undefined ? '' : JSON.stringify(body),
  });
}

function matchesFilters(row, searchParams) {
  for (const [key, value] of searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
    if (value.startsWith('eq.')) {
      if (String(row[key]) !== value.slice(3)) return false;
    } else if (value.startsWith('in.(')) {
      const list = value.slice(4, -1).split(',').map((item) => decodeURIComponent(item.replace(/^"|"$/g, '')));
      if (!list.includes(String(row[key]))) return false;
    }
  }
  return true;
}

function parseRange(request) {
  const header = request.headers()['range'];
  if (!header) return null;
  const [from, to] = header.split('-').map(Number);
  return { from, to };
}

const SESSION = {
  access_token: `header.${Buffer.from(JSON.stringify({ sub: USER_ID, exp: 4102444800 })).toString('base64url')}.signature`,
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock-refresh-token',
  user: {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'caca@example.com',
    email_confirmed_at: '2026-11-20T10:00:00.000Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: '2026-11-20T10:00:00.000Z',
    updated_at: '2026-11-20T10:00:00.000Z',
  },
};

async function handle(route) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  stats.requests += 1;

  if (method === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: corsHeaders() });
    return;
  }

  // ------------------------------- Auth (GoTrue) -------------------------------
  if (url.pathname.startsWith('/auth/v1/')) {
    stats.auth += 1;
    if (url.pathname === '/auth/v1/token') {
      await fulfillJson(route, 200, { ...SESSION, expires_at: Math.floor(Date.now() / 1000) + 3600 });
      return;
    }
    if (url.pathname === '/auth/v1/logout') {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }
    if (url.pathname === '/auth/v1/user') {
      await fulfillJson(route, 200, SESSION.user);
      return;
    }
    if (url.pathname === '/auth/v1/settings') {
      await fulfillJson(route, 200, { external: {}, disable_signup: false, mailer_autoconfirm: true });
      return;
    }
    await fulfillJson(route, 200, {});
    return;
  }

  // ------------------------------ REST (PostgREST) ------------------------------
  const table = url.pathname.replace('/rest/v1/', '');
  if (!db.has(table)) {
    await fulfillJson(route, 404, { code: '42P01', message: `relation "public.${table}" does not exist` });
    return;
  }

  const rows = db.get(table);

  if (method === 'GET') {
    let result = rowsOf(table).filter((row) => matchesFilters(row, url.searchParams));
    const order = url.searchParams.get('order');
    if (order) {
      const [column, direction = 'asc'] = order.split('.');
      result = result.sort((a, b) => {
        const left = String(a[column] ?? '');
        const right = String(b[column] ?? '');
        return direction.startsWith('desc') ? right.localeCompare(left) : left.localeCompare(right);
      });
    }
    const range = parseRange(request);
    if (range) result = result.slice(range.from, range.to + 1);

    const wantsObject = (request.headers()['accept'] || '').includes('application/vnd.pgrst.object+json');
    if (wantsObject) {
      if (result.length === 1) await fulfillJson(route, 200, result[0]);
      else await fulfillJson(route, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
      return;
    }
    await fulfillJson(route, 200, result, { 'content-range': `0-${Math.max(result.length - 1, 0)}/${result.length}` });
    return;
  }

  if (method === 'POST') {
    const payload = JSON.parse(request.postData() || 'null');
    const incoming = Array.isArray(payload) ? payload : [payload];
    let written = 0;
    for (const row of incoming) {
      if (!row || typeof row !== 'object') continue;
      const key = rowKey(table, row);
      rows.set(key, { ...rows.get(key), ...row });
      written += 1;
    }
    stats.writes += written;
    await fulfillJson(route, 201, [], { preference_applied: 'resolution=merge-duplicates' });
    return;
  }

  if (method === 'DELETE') {
    let removed = 0;
    for (const [key, row] of [...rows.entries()]) {
      if (matchesFilters(row, url.searchParams)) {
        rows.delete(key);
        removed += 1;
      }
    }
    stats.deletes += removed;
    await route.fulfill({ status: 204, headers: corsHeaders() });
    return;
  }

  await fulfillJson(route, 405, { message: 'metode tidak didukung' });
}

/* --------------------------------- helpers ---------------------------------- */

function count(table) {
  return db.get(table).size;
}

async function waitFor(predicate, timeout = 12000, label = 'kondisi') {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`timeout menunggu ${label}`);
}

async function login(page, email = 'caca@example.com', password = 'rahasia123') {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  // Akun baru mendarat di halaman sambutan; akun yang sudah punya data langsung ke dashboard.
  await waitFor(async () => {
    const welcome = await page.getByRole('button', { name: 'Coba dengan data contoh' }).count();
    const shell = await page.locator('.mobile-topbar, .sidebar').count();
    return welcome > 0 || shell > 0;
  }, 15000, 'halaman setelah login');
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('caca-bumbu:state:v1') || 'null'));
}

async function syncBadge(page) {
  return page.locator('.desktop-topbar .online-dot, .mobile-topbar__brand small').first().innerText().catch(() => '');
}

/* ---------------------------------- skenario -------------------------------- */

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});

const contextOptions = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta',
};

const deviceA = await browser.newContext(contextOptions);
await deviceA.route(`${PROJECT}/**`, handle);
const pageA = await deviceA.newPage();
const errors = [];
const isNetworkNoise = (text) => /Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|net::|NetworkError|fetch failed/i.test(text);
pageA.on('pageerror', (error) => errors.push('A: ' + error.message));
pageA.on('console', (message) => {
  if (message.type() === 'error' && !isNetworkNoise(message.text())) errors.push('A: ' + message.text());
});

await login(pageA);
console.log('✓ login perangkat A');

await pageA.getByRole('button', { name: 'Coba dengan data contoh' }).click();
await pageA.waitForTimeout(400);
await waitFor(() => count('products') === 10, 15000, 'unggah awal products');
await waitFor(() => count('sales') === 9, 15000, 'unggah awal sales');
assert.equal(count('warungs'), 4, 'warung ikut terunggah');
assert.equal(count('app_settings'), 1, 'pengaturan ikut terunggah');
assert.equal(count('app_meta'), 1, 'meta ikut terunggah');
const settings = [...db.get('app_settings').values()][0];
assert.equal(settings.business_name, 'Dapur Caca');
console.log('✓ unggah awal lengkap:', count('products'), 'produk,', count('sales'), 'penjualan,', count('stock_moves'), 'mutasi stok');

const before = await readState(pageA);
assert.equal(before.sales.length, 9);

// Jual langsung → diff terkirim
await pageA.goto(BASE + '#/jual', { waitUntil: 'networkidle' });
await pageA.locator('.add-product-btn').first().click();
await pageA.locator('.cart-bar .btn').click();
await pageA.getByRole('button', { name: 'Simpan penjualan' }).click();
await waitFor(() => count('sales') === 10, 15000, 'diff penjualan terkirim');
const newTxButton = pageA.getByRole('button', { name: 'Transaksi baru' });
if (await newTxButton.count()) await newTxButton.click();
assert.equal(count('products'), 10, 'tidak ada baris produk ganda');
const afterSale = await readState(pageA);
const newestSale = afterSale.sales[0];
const saleRow = [...db.get('sales').values()].find((row) => row.id === newestSale.id);
assert.ok(saleRow, 'baris penjualan tersimpan di cloud');
assert.equal(saleRow.items.length, newestSale.items.length, 'items jsonb terkirim');
console.log('✓ diff penjualan terkirim:', saleRow.code, '|', await syncBadge(pageA));

// Luring: perubahan menunggu, lalu terkirim saat online
await deviceA.setOffline(true);
await pageA.waitForTimeout(300);
const salesBeforeOffline = count('sales');
await pageA.locator('.add-product-btn').first().click();
await pageA.locator('.cart-bar .btn').click();
await pageA.getByRole('button', { name: 'Simpan penjualan' }).click();
await pageA.waitForTimeout(600);
const offlineNewTx = pageA.getByRole('button', { name: 'Transaksi baru' });
if (await offlineNewTx.count()) await offlineNewTx.click();
const localAfterOffline = await readState(pageA);
assert.equal(localAfterOffline.sales.length, salesBeforeOffline + 1, 'penjualan luring tersimpan lokal');
assert.equal(count('sales'), salesBeforeOffline, 'cloud belum berubah saat luring');
await deviceA.setOffline(false);
await pageA.evaluate(() => window.dispatchEvent(new Event('online')));
await waitFor(() => count('sales') === salesBeforeOffline + 1, 20000, 'antrean luring terkirim');
console.log('✓ antrean luring terkirim otomatis');

// Perangkat B: login → pakai data cloud
const deviceB = await browser.newContext(contextOptions);
await deviceB.route(`${PROJECT}/**`, handle);
const pageB = await deviceB.newPage();
pageB.on('pageerror', (error) => errors.push('B: ' + error.message));
pageB.on('console', (message) => {
  if (message.type() === 'error' && !isNetworkNoise(message.text())) errors.push('B: ' + message.text());
});
await login(pageB);
await pageB.waitForTimeout(800);
const stateB = await readState(pageB);
assert.ok(stateB, 'perangkat B punya state');
assert.equal(stateB.meta.onboarded, true, 'perangkat B mewarisi status onboarding');
assert.equal(stateB.sales.length, salesBeforeOffline + 1, 'perangkat B menerima semua penjualan');
assert.equal(stateB.products.length, 10, 'produk ikut tersinkron');
assert.equal(stateB.warungs.length, 4, 'warung ikut tersinkron');
await pageB.goto(BASE + '#/', { waitUntil: 'networkidle' });
await pageB.waitForTimeout(400);
assert.ok(await pageB.getByText(/Selamat (pagi|siang|sore|malam), Caca/i).isVisible(), 'dashboard perangkat B tampil');
console.log('✓ perangkat B menerima data cloud:', stateB.sales.length, 'penjualan');

// Konflik: perangkat B mengubah produk, perangkat A harus menerima saat fokus
await pageB.goto(BASE + '#/produk', { waitUntil: 'networkidle' });
await pageB.waitForTimeout(400);
await pageB.goto(BASE + '#/pengaturan', { waitUntil: 'networkidle' });
await pageB.locator('#settings-threshold').fill('7');
await pageB.getByRole('button', { name: 'Simpan pengaturan' }).click();
await waitFor(() => [...db.get('app_settings').values()].some((row) => row.low_stock_threshold === 7), 15000, 'perubahan pengaturan terkirim');
await pageA.goto(BASE + '#/pengaturan', { waitUntil: 'networkidle' });
await pageA.waitForTimeout(500);
await pageA.getByRole('button', { name: 'Sinkronkan sekarang' }).click();
await waitFor(async () => (await pageA.evaluate(() => JSON.parse(localStorage.getItem('caca-bumbu:state:v1')).settings.lowStockThreshold)) === 7, 20000, 'perangkat A menerima perubahan');
console.log('✓ perubahan perangkat B masuk ke perangkat A');

// Reload perangkat A: tidak ada duplikasi setelah muat ulang
const beforeReload = count('sales');
await pageA.reload({ waitUntil: 'networkidle' });
await pageA.waitForTimeout(1200);
assert.equal(count('sales'), beforeReload, 'reload tidak membuat baris ganda');
assert.equal(count('products'), 10);
console.log('✓ reload aman, tanpa duplikasi');

// Hapus semua data: cloud dikosongkan lalu diisi state awal lagi
await pageB.goto(BASE + '#/pengaturan', { waitUntil: 'networkidle' });
await pageB.waitForTimeout(400);
await pageB.getByRole('button', { name: 'Hapus semua data' }).click();
await pageB.getByRole('button', { name: 'Ya, hapus semua' }).click();
await waitFor(() => count('sales') === 0 && count('consignments') === 0, 20000, 'data cloud dikosongkan');
await waitFor(() => count('products') === 10 && count('app_meta') === 1, 20000, 'state awal diunggah kembali');
assert.equal(count('warungs'), 0, 'warung ikut terhapus');
assert.ok(stats.deletes > 0, 'jalur hapus terpakai');
console.log('✓ hapus semua data membersihkan cloud dan mengunggah state awal');

assert.deepEqual(errors, [], 'tidak ada error console');
console.log('\nSEMUA UJI CLOUD LULUS — request:', stats.requests, '| tulis:', stats.writes, '| hapus:', stats.deletes);
await browser.close();
