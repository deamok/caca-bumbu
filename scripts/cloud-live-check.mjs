/**
 * Uji integrasi ke project Supabase ASLI (bukan tiruan).
 * Membuat akun uji, memakai data contoh, membuat penjualan, memeriksa baris
 * tabel lewat Management API, lalu menghapus akun uji (cascade).
 *
 * Hanya untuk dijalankan lokal. Butuh environment:
 *   SUPABASE_ACCESS_TOKEN   token Management API (jangan di-commit)
 *   SUPABASE_PROJECT_REF    ref project
 *   APP_URL                 default http://127.0.0.1:4173/
 *   SUPABASE_ANON_KEY       anon key project (untuk cek isolasi RLS)
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import process from 'node:process';

const BASE = process.env.APP_URL || 'http://127.0.0.1:4173/';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
const ANON = process.env.SUPABASE_ANON_KEY;
if (!TOKEN || !REF) {
  console.error('Set SUPABASE_ACCESS_TOKEN dan SUPABASE_PROJECT_REF lebih dulu.');
  process.exit(1);
}

const EMAIL = process.env.TEST_EMAIL || `uji.caca.${Date.now()}@example.com`;
const PASSWORD = 'rahasia123';
const PROJECT_URL = `https://${REF}.supabase.co`;

async function sql(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: false }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`SQL gagal (${response.status}): ${text}`);
  return text ? JSON.parse(text) : [];
}

const countQuery = (table) =>
  `select count(*)::int as n from public.${table} where user_id = (select id from auth.users where email = '${EMAIL}')`;

async function countRows(table) {
  const rows = await sql(countQuery(table));
  return rows[0]?.n ?? 0;
}

async function waitForCount(table, expected, label, timeout = 25000) {
  const started = Date.now();
  let last = -1;
  while (Date.now() - started < timeout) {
    last = await countRows(table);
    if (last === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label}: ${table} = ${last}, seharusnya ${expected}`);
}

const getState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('caca-bumbu:state:v1') || 'null'));

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});

// Netlify free plan menyisipkan iframe badge di sudut bawah; dibuang hanya
// selama pengujian agar klik tidak terhalang (tidak menyentuh kode aplikasi).
const removeNetlifyBadge = () => {
  const start = () => {
    setInterval(() => document.getElementById('nl-badge-frame')?.remove(), 250);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
};
const contextOptions = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta',
};
const errors = [];
const isNoise = (text) => /Failed to load resource|ERR_INTERNET|net::|favicon/i.test(text);

let exitCode = 0;
try {
  console.log('project :', REF, `(${PROJECT_URL})`);
  console.log('akun uji:', EMAIL);

  // 1. Isolasi: anon tanpa login tidak boleh membaca tabel
  if (ANON) {
    const anonResponse = await fetch(`${PROJECT_URL}/rest/v1/products?select=id`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    console.log('anon tanpa login →', anonResponse.status);
    assert.ok(anonResponse.status === 401 || anonResponse.status === 403, 'anon ditolak RLS/grant');
  }

  const deviceA = await browser.newContext(contextOptions);
  await deviceA.addInitScript(removeNetlifyBadge);
  const pageA = await deviceA.newPage();
  pageA.on('pageerror', (error) => errors.push('A: ' + error.message));
  pageA.on('console', (message) => {
    if (message.type() === 'error' && !isNoise(message.text())) errors.push('A: ' + message.text());
  });

  // 2. Daftar akun baru (email confirm dimatikan sebelumnya)
  await pageA.goto(BASE, { waitUntil: 'networkidle' });
  await pageA.getByRole('tab', { name: 'Daftar' }).click();
  await pageA.locator('#auth-email').fill(EMAIL);
  await pageA.locator('#auth-password').fill(PASSWORD);
  await pageA.getByRole('button', { name: 'Daftar', exact: true }).click();
  await pageA.getByRole('button', { name: 'Coba dengan data contoh' }).waitFor({ timeout: 20000 });
  console.log('✓ daftar + masuk');

  // 3. Data contoh terunggah ke tabel asli
  await pageA.getByRole('button', { name: 'Coba dengan data contoh' }).click();
  await pageA.waitForTimeout(800);
  await waitForCount('products', 10, 'unggah produk');
  await waitForCount('sales', 9, 'unggah penjualan');
  await waitForCount('warungs', 4, 'unggah warung');
  await waitForCount('app_settings', 1, 'unggah pengaturan');
  await waitForCount('app_meta', 1, 'unggah meta');
  console.log('✓ unggah awal ke Supabase asli: 10 produk, 9 penjualan, 4 warung');

  const settingsRows = await sql(
    `select business_name, low_stock_threshold from public.app_settings where user_id = (select id from auth.users where email = '${EMAIL}')`,
  );
  assert.equal(settingsRows[0].business_name, 'Dapur Caca');

  // 4. Penjualan baru → baris baru di cloud
  await pageA.goto(BASE + '#/jual', { waitUntil: 'networkidle' });
  await pageA.locator('.add-product-btn').first().click();
  await pageA.locator('.cart-bar .btn').click();
  await pageA.getByRole('button', { name: 'Simpan penjualan' }).click();
  await waitForCount('sales', 10, 'diff penjualan');
  const newTx = pageA.getByRole('button', { name: 'Transaksi baru' });
  if (await newTx.count()) await newTx.click();
  const saleItems = await sql(
    `select code, jsonb_array_length(items) as lines from public.sales where user_id = (select id from auth.users where email = '${EMAIL}') order by created_at desc limit 1`,
  );
  assert.ok(saleItems[0].lines >= 1, 'items jsonb tersimpan');
  console.log('✓ diff penjualan tersimpan:', saleItems[0].code, '|', saleItems[0].lines, 'baris item');

  // 5. Perangkat kedua: masuk dengan akun yang sama → menerima data cloud
  const deviceB = await browser.newContext(contextOptions);
  await deviceB.addInitScript(removeNetlifyBadge);
  const pageB = await deviceB.newPage();
  pageB.on('pageerror', (error) => errors.push('B: ' + error.message));
  pageB.on('console', (message) => {
    if (message.type() === 'error' && !isNoise(message.text())) errors.push('B: ' + message.text());
  });
  await pageB.goto(BASE, { waitUntil: 'networkidle' });
  await pageB.locator('#auth-email').fill(EMAIL);
  await pageB.locator('#auth-password').fill(PASSWORD);
  await pageB.getByRole('button', { name: 'Masuk', exact: true }).click();
  await pageB.getByText(/Selamat (pagi|siang|sore|malam), Caca/i).first().waitFor({ timeout: 20000 });
  await pageB.waitForTimeout(1500);
  const stateB = await getState(pageB);
  assert.ok(stateB, 'perangkat B punya state');
  assert.equal(stateB.sales.length, 10, 'perangkat B menerima 10 penjualan');
  assert.equal(stateB.products.length, 10, 'perangkat B menerima produk');
  assert.equal(stateB.meta.onboarded, true, 'status onboarding ikut tersinkron');
  console.log('✓ perangkat kedua menerima data cloud:', stateB.sales.length, 'penjualan,', stateB.warungs.length, 'warung');

  // 6. Reload perangkat A tidak menggandakan data
  await pageA.reload({ waitUntil: 'networkidle' });
  await pageA.waitForTimeout(1500);
  assert.equal(await countRows('sales'), 10, 'reload tidak menggandakan penjualan');
  console.log('✓ reload aman tanpa duplikasi');

  assert.deepEqual(errors, [], 'tidak ada error console');
  console.log('\nSEMUA UJI SUPABASE ASLI LULUS');
} catch (error) {
  exitCode = 1;
  console.error('\nGAGAL:', error.message);
} finally {
  try {
    await sql(`delete from auth.users where email = '${EMAIL}'`);
    console.log('akun uji dihapus (data ikut terhapus lewat cascade)');
  } catch (error) {
    console.error('peringatan: gagal menghapus akun uji:', error.message);
  }
  await browser.close();
  process.exit(exitCode);
}
