#!/usr/bin/env node
/**
 * Terapkan migrasi SQL ke project Supabase lewat Management API.
 * Tidak butuh Docker / Supabase CLI — cukup access token.
 *
 * Pemakaian:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_PROJECT_REF=abcdefghijk pnpm db:apply
 *   node scripts/apply-supabase.mjs --ref abcdefghijk --dry-run
 *
 * Ambil access token di https://supabase.com/dashboard/account/tokens
 * Project ref ada di URL dashboard: https://supabase.com/dashboard/project/<ref>
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const API = 'https://api.supabase.com/v1';

function parseArgs(argv) {
  const options = { ref: process.env.SUPABASE_PROJECT_REF, token: process.env.SUPABASE_ACCESS_TOKEN, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--ref') options.ref = argv[++index];
    else if (arg === '--token') options.token = argv[++index];
    else if (arg === '--dry-run') options.dryRun = true;
    else if (!arg.startsWith('--') && !options.ref) options.ref = arg;
    else if (arg === '--help' || arg === '-h') options.help = true;
  }
  return options;
}

async function runQuery(ref, token, query) {
  const response = await fetch(`${API}/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, read_only: false }),
  });

  const body = await response.text();
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body;
  }

  if (!response.ok) {
    const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
    throw new Error(`HTTP ${response.status} ${response.statusText}\n${detail}`);
  }
  return parsed;
}

async function main() {
  const { ref, token, dryRun, help } = parseArgs(process.argv.slice(2));

  if (help) {
    console.log('Pemakaian: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... pnpm db:apply [--dry-run]');
    return;
  }
  if (!ref) throw new Error('Project ref belum diisi. Set SUPABASE_PROJECT_REF atau pakai --ref <ref>.');
  if (!token) throw new Error('Access token belum diisi. Set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens).');

  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();
  if (files.length === 0) throw new Error(`Tidak ada file SQL di ${MIGRATIONS_DIR}`);

  console.log(`Project: ${ref}`);
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    if (dryRun) {
      console.log(`· ${file} (${sql.length} karakter) — dilewati (--dry-run)`);
      continue;
    }
    process.stdout.write(`→ ${file} … `);
    const result = await runQuery(ref, token, sql);
    console.log(`OK${Array.isArray(result) ? ` (${result.length} baris)` : ''}`);
  }

  if (!dryRun) {
    const tables = await runQuery(
      ref,
      token,
      `select table_name, (select count(*) from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name) as columns
         from information_schema.tables t
        where table_schema = 'public'
          and table_name in ('products','warungs','sales','consignments','payments','ingredients','purchases','stock_moves','app_settings','app_meta')
        order by table_name;`,
    );
    console.log('\nTabel yang tersedia:');
    for (const row of tables) {
      console.log(`  ✓ ${row.table_name} (${row.columns} kolom)`);
    }
    if (tables.length < 10) console.warn('\nPerhatian: jumlah tabel belum lengkap, periksa pesan error di atas.');
  }

  console.log('\nSelesai.');
}

main().catch((error) => {
  console.error(`\nGagal: ${error.message}`);
  process.exit(1);
});
