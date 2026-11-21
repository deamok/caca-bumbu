# Migrasi ke Supabase

Dokumen ini menjelaskan apa yang berubah dari versi 1.0 (lokal murni) ke versi 2.0 (Supabase + Netlify), bentuk skema database, aturan akses, dan cara kerja sinkronisasi.

## Ringkasan perubahan

| Bagian | Versi 1.0 | Versi 2.0 |
| --- | --- | --- |
| Penyimpanan | `localStorage` saja | Supabase Postgres + cache `localStorage` |
| Akun | Tidak ada | Email + password (Supabase Auth) |
| Perangkat | Satu | Banyak perangkat, satu akun |
| Luring | Ya | Ya (baca + tulis, dikirim saat online) |
| Hosting | GitHub Pages (`gh-pages`) | Netlify (Git deploy dari `main`) |
| Data tidak sengaja hilang | Bergantung backup manual | Cloud + backup manual |

## Tabel database

Semua tabel memakai pola yang sama:

- kunci utama gabungan `(user_id, id)` — `id` dibuat di klien (`prod_…`, `sale_…`, `tt_…`);
- `user_id` default `auth.uid()` dan `on delete cascade` ke `auth.users`;
- RLS aktif dengan policy `for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)`;
- grant `select/insert/update/delete` hanya untuk role `authenticated`; role `anon` dicabut.

| Tabel | Isi | Kolom penting |
| --- | --- | --- |
| `products` | Bumbu & stok | `name`, `price`, `hpp`, `stock`, `unit`, `tone`, `active` |
| `warungs` | Warung langganan | `name`, `owner`, `phone`, `address`, `notes` |
| `sales` | Penjualan langsung | `code`, `date`, `warung_id`, `buyer_name`, `items` (jsonb), `total` |
| `consignments` | Titipan | `code`, `warung_id`, `date`, `due_date`, `items` (jsonb), `status`, `closed_at` |
| `payments` | Pembayaran/piutang | `ref_type` (`sale`/`consignment`), `ref_id`, `amount`, `date`, `method` |
| `ingredients` | Bahan baku | `name`, `unit`, `category` |
| `purchases` | Belanja pasar | `code`, `date`, `supplier`, `items` (jsonb), `total` |
| `stock_moves` | Riwayat stok | `date`, `product_id`, `qty`, `type`, `ref_id`, `note` |
| `app_settings` | Profil usaha | `business_name`, `owner_name`, `phone`, `whatsapp`, `address`, `low_stock_threshold` |
| `app_meta` | Status onboarding | `onboarded`, `demo`, `created_at` |

`items` disimpan sebagai `jsonb` karena isinya selalu dibaca bersama dokumen induknya (tidak pernah di-query terpisah). Index dibuat untuk `user_id`, tanggal transaksi, status titipan, dan `product_id` pada riwayat stok.

Skema lengkap: [supabase/migrations/20261121090000_init.sql](../supabase/migrations/20261121090000_init.sql).

## Pemetaan data (`cloudSchema.ts`)

`AppState` di aplikasi memakai camelCase; tabel memakai snake_case. Modul [src/lib/cloudSchema.ts](../src/lib/cloudSchema.ts) mengurus semuanya:

- `stateToRows(state, userId)` — AppState → baris per tabel;
- `rowsToState(rows)` — baris → AppState (termasuk normalisasi tanggal ke ISO UTC dan urutan tampilan);
- `diffStateRows(base, next)` — perubahan saja: upsert untuk baris baru/berubah, hapus untuk id yang hilang;
- `mergeStates(local, remote)` — penggabungan saat perangkat pertama kali tersambung (per id, timestamp terbaru menang);
- `isEmptyRows`, `isEmptyState` — penentu apakah perlu unggah awal atau unduh awal.

Karena fungsi-fungsi ini murni, semuanya diuji tanpa jaringan di [src/lib/cloudSchema.test.ts](../src/lib/cloudSchema.test.ts).

## Alur sinkronisasi (`SyncContext.tsx`)

1. **Login** → `initialize()` menarik semua baris akun.
2. **Pertama kali** (penanda sinkron belum ada):
   - cloud kosong & lokal ada data → unggah seluruh data lokal (migrasi otomatis);
   - lokal kosong & cloud ada data → pakai data cloud (perangkat baru);
   - keduanya berisi → gabungkan per id lalu unggah hasilnya.
3. **Perubahan pengguna** → state lokal berubah → penanda `dirty` disimpan → diff dihitung dari `base` terakhir → dikirim setelah 900 ms (digabung bila beruntun).
4. **Setelah kirim sukses** → `base` diperbarui, lalu tarik data terbaru (agar perubahan perangkat lain masuk).
5. **Kembali online / fokus / tiap 60 detik** → tarik data bila tidak ada perubahan tertunda; bila ada, kirim dulu.
6. **Gagal kirim** → status `error`/`offline`, perubahan tetap tersimpan lokal, dicoba ulang tiap 12 detik selama online.

`localStorage` menyimpan `caca-bumbu:sync:v1` berisi `{ userId, base, syncedAt, dirty }`. `base` adalah salinan baris terakhir yang diketahui sama dengan cloud, sehingga diff tetap benar setelah aplikasi ditutup. Bila kuota `localStorage` habis, `base` tidak tersimpan dan sinkronisasi berikutnya berjalan dalam mode *upsert saja* (penghapusan baru terkirim saat sesi berjalan).

## Aturan konflik

- Per baris: perubahan terakhir yang berhasil dikirim menang (last-write-wins).
- Untuk dokumen transaksi, hal ini aman karena satu transaksi biasanya dibuat di satu perangkat.
- Bila stok sempat berubah di dua perangkat sekaligus, angka stok bisa mengikuti perangkat yang terakhir mengirim. Sinkronisasi berikutnya memperbaiki tampilan, bukan riwayat.
- Untuk koreksi manual, gunakan **Pengaturan → Akun & sinkronisasi → Unggah data HP ini / Ambil dari cloud** (dengan konfirmasi, karena menimpa sisi lain).

## Keamanan

- Hanya `anon key` yang ada di aplikasi web. Kunci ini tidak memberi akses ke data akun lain karena RLS memeriksa `auth.uid()`.
- Jangan pernah memakai `service_role key` di frontend atau menyimpannya di Netlify sebagai `VITE_*` (semua `VITE_*` ikut ter-bundle ke browser).
- Access token Supabase (untuk `pnpm db:apply`) hanya dipakai di komputer pengembang dan tidak boleh di-commit.
- Katalog publik (`#/katalog?d=…`) tidak membaca database; ia memakai snapshot yang dikodekan di URL, jadi tetap aman dibagikan ke warung tanpa login.

## Perintah berguna

```bash
# terapkan / ulangi migrasi (idempoten)
supabase db push --linked                       # bila memakai Supabase CLI
SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... pnpm db:apply

# cek cepat isi cloud via SQL editor
select count(*) from public.sales;

# uji lokal tanpa cloud
unset VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY && pnpm dev
```

## Pemecahan masalah

| Gejala | Penyebab umum | Tindakan |
| --- | --- | --- |
| Halaman login muncul terus setelah submit | Email belum dikonfirmasi | Buka email konfirmasi, atau matikan **Confirm email** di Supabase Auth |
| "relation does not exist" / error 404 di REST | Migrasi belum dijalankan | Jalankan file SQL, lalu **Sinkronkan sekarang** |
| Data tidak muncul di perangkat kedua | Salah akun, atau `user_id` berbeda | Pastikan login dengan email yang sama, cek **Pengaturan → Akun** |
| Status "Sinkron gagal" terus | `anon key` salah / RLS belum aktif / offline | Cek Network tab ke `/rest/v1/...`, pastikan `VITE_*` benar saat build |
| Perubahan dari HP lain tidak masuk | Aplikasi di latar belakang | Buka kembali aplikasi (fokus) atau tekan **Sinkronkan sekarang** |
| Build Netlify sukses tapi login tidak muncul | Environment variable belum diisi | Tambahkan `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, lalu redeploy |
