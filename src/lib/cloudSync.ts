import type { SupabaseClient } from '@supabase/supabase-js';
import {
  STATE_TABLES,
  TABLE_NAMES,
  rowsToState,
  stateToRows,
  type CloudRow,
  type RowChangeSet,
  type StateRows,
  emptyStateRows,
} from './cloudSchema';

const PAGE_SIZE = 1000;
const UPSERT_CHUNK = 200;
const DELETE_CHUNK = 100;

export class CloudError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'CloudError';
  }
}

function describe(error: { message?: string; details?: string; hint?: string; code?: string } | null): string {
  if (!error) return 'Kesalahan tidak diketahui';
  return [error.message, error.details, error.hint, error.code].filter(Boolean).join(' · ');
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

async function selectAll(client: SupabaseClient, table: string, userId: string): Promise<CloudRow[]> {
  const rows: CloudRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new CloudError(`Gagal membaca ${table}: ${describe(error)}`, error);
    const page = (data ?? []) as CloudRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function fetchRemoteRows(client: SupabaseClient, userId: string): Promise<StateRows> {
  const rows = emptyStateRows();

  for (const table of STATE_TABLES) {
    rows[table] = await selectAll(client, TABLE_NAMES[table], userId);
  }

  const settings = await client.from('app_settings').select('*').eq('user_id', userId).maybeSingle();
  if (settings.error) throw new CloudError(`Gagal membaca pengaturan: ${describe(settings.error)}`, settings.error);
  rows.settings = (settings.data as CloudRow | null) ?? null;

  const meta = await client.from('app_meta').select('*').eq('user_id', userId).maybeSingle();
  if (meta.error) throw new CloudError(`Gagal membaca status usaha: ${describe(meta.error)}`, meta.error);
  rows.meta = (meta.data as CloudRow | null) ?? null;

  // Kanonikalisasi: samakan bentuk baris dengan yang akan kita tulis kembali
  // (format tanggal UTC, angka, urutan kolom) supaya pembandingan diff stabil
  // dan tidak mengunggah ulang semua baris setiap kali menarik data.
  return stateToRows(rowsToState(rows), userId);
}

export async function pushChanges(client: SupabaseClient, userId: string, changes: RowChangeSet): Promise<void> {
  for (const table of STATE_TABLES) {
    const upserts = changes.upserts[table] ?? [];
    for (const group of chunk(upserts, UPSERT_CHUNK)) {
      const { error } = await client.from(TABLE_NAMES[table]).upsert(group, { onConflict: 'user_id,id' });
      if (error) throw new CloudError(`Gagal menyimpan ${table}: ${describe(error)}`, error);
    }

    const deletes = changes.deletes[table] ?? [];
    for (const group of chunk(deletes, DELETE_CHUNK)) {
      const { error } = await client.from(TABLE_NAMES[table]).delete().eq('user_id', userId).in('id', group);
      if (error) throw new CloudError(`Gagal menghapus ${table}: ${describe(error)}`, error);
    }
  }

  if (changes.settings) {
    const { error } = await client.from('app_settings').upsert(changes.settings, { onConflict: 'user_id' });
    if (error) throw new CloudError(`Gagal menyimpan pengaturan: ${describe(error)}`, error);
  }

  if (changes.meta) {
    const { error } = await client.from('app_meta').upsert(changes.meta, { onConflict: 'user_id' });
    if (error) throw new CloudError(`Gagal menyimpan status usaha: ${describe(error)}`, error);
  }
}

export async function deleteAllRows(client: SupabaseClient, userId: string): Promise<void> {
  for (const table of STATE_TABLES) {
    const { error } = await client.from(TABLE_NAMES[table]).delete().eq('user_id', userId);
    if (error) throw new CloudError(`Gagal mengosongkan ${table}: ${describe(error)}`, error);
  }
  for (const table of ['app_settings', 'app_meta']) {
    const { error } = await client.from(table).delete().eq('user_id', userId);
    if (error) throw new CloudError(`Gagal mengosongkan ${table}: ${describe(error)}`, error);
  }
}

/** Cek cepat apakah kredensial & skema siap dipakai (dipanggil dari Pengaturan). */
export async function pingCloud(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.from('app_meta').select('user_id').eq('user_id', userId).limit(1);
  if (error) throw new CloudError(describe(error), error);
}
