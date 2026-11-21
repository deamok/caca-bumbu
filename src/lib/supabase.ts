import type { SupabaseClient } from '@supabase/supabase-js';

function readEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

const url = readEnv(import.meta.env.VITE_SUPABASE_URL);
const anonKey = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

/**
 * Aplikasi tetap bisa dipakai 100% luring bila kredensial Supabase belum diisi
 * (mis. build lama atau pengembangan tanpa jaringan). Semua fitur cloud
 * otomatis disembunyikan saat `cloudEnabled` bernilai false.
 */
export const cloudEnabled = Boolean(url && anonKey);

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * Klien Supabase dimuat belakangan (code-split) supaya pengguna yang memakai
 * mode lokal tidak perlu mengunduh pustaka auth/realtime. Build tanpa
 * kredensial tidak pernah memuat potongan kode ini.
 */
export function getSupabase(): Promise<SupabaseClient> {
  if (!url || !anonKey) {
    return Promise.reject(new Error('Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.'));
  }
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'caca-bumbu:auth:v1',
        },
        global: {
          headers: { 'x-application-name': 'caca-bumbu' },
        },
      }),
    );
  }
  return clientPromise;
}
