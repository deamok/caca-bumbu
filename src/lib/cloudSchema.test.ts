import { describe, expect, it } from 'vitest';
import {
  diffStateRows,
  emptyStateRows,
  isEmptyChangeSet,
  isEmptyRows,
  isEmptyState,
  mergeStates,
  rowsToState,
  stateToRows,
} from './cloudSchema';
import { createDemoState, createInitialState } from '../data/seed';
import type { AppState } from '../types';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function collections(state: AppState) {
  return {
    products: sortById(state.products),
    warungs: sortById(state.warungs),
    sales: sortById(state.sales),
    consignments: sortById(state.consignments),
    payments: sortById(state.payments),
    ingredients: sortById(state.ingredients),
    purchases: sortById(state.purchases),
    stockMoves: sortById(state.stockMoves),
  };
}

describe('cloudSchema', () => {
  it('bolak-balik demo state ke tabel dan kembali tanpa kehilangan data', () => {
    const original = createDemoState();
    const rows = stateToRows(original, USER_ID);
    const restored = rowsToState(rows);

    expect(collections(restored)).toEqual(collections(original));
    expect(restored.settings).toEqual(original.settings);
    expect(restored.meta.onboarded).toBe(true);
    expect(restored.meta.demo).toBe(true);
    expect(restored.version).toBe(1);
  });

  it('menulis kolom snake_case dan user_id untuk setiap baris', () => {
    const rows = stateToRows(createDemoState(), USER_ID);
    for (const row of rows.products) {
      expect(row.user_id).toBe(USER_ID);
      expect(typeof row.created_at).toBe('string');
      expect(row).not.toHaveProperty('low_stock_threshold');
    }
    expect(rows.settings).toMatchObject({ user_id: USER_ID, business_name: 'Dapur Caca' });
    expect(rows.meta).toMatchObject({ user_id: USER_ID, onboarded: true });
    expect(rows.sales[0]).toHaveProperty('buyer_name');
    expect(rows.consignments[0]).toHaveProperty('due_date');
    expect(rows.stockMoves.every((move) => 'product_id' in move)).toBe(true);
  });

  it('menghitung perubahan hanya untuk baris yang berubah, ditambah dan dihapus', () => {
    const base = createDemoState();
    const baseRows = stateToRows(base, USER_ID);

    expect(isEmptyChangeSet(diffStateRows(baseRows, baseRows))).toBe(true);

    const removedWarungId = base.warungs[0]?.id;
    const next: AppState = {
      ...base,
      products: base.products.map((product) =>
        product.id === 'p-rendang' ? { ...product, price: 7500, updatedAt: new Date().toISOString() } : product,
      ),
      warungs: base.warungs.filter((warung) => warung.id !== removedWarungId),
    };

    const changes = diffStateRows(baseRows, stateToRows(next, USER_ID));
    const changedProductIds = (changes.upserts.products ?? []).map((row) => row.id);
    expect(changedProductIds).toEqual(['p-rendang']);
    expect(changes.upserts.products?.[0].price).toBe(7500);
    expect(changes.deletes.warungs).toContain(removedWarungId);
    expect(changes.settings).toBeUndefined();
    expect(changes.meta).toBeUndefined();
  });

  it('mengirim semua baris saat belum ada basis sinkronisasi', () => {
    const state = createDemoState();
    const changes = diffStateRows(null, stateToRows(state, USER_ID));
    expect(changes.upserts.products).toHaveLength(state.products.length);
    expect(changes.upserts.sales).toHaveLength(state.sales.length);
    expect(changes.deletes).toEqual({});
    expect(changes.settings).toBeTruthy();
    expect(changes.meta).toBeTruthy();
  });

  it('menggabungkan data lokal dan cloud tanpa membuang salah satu sisi', () => {
    const local: AppState = {
      ...createInitialState(),
      meta: { onboarded: true, demo: false, createdAt: '2026-01-01T00:00:00.000Z' },
      settings: { ...createInitialState().settings, businessName: 'Dapur Lokal' },
      products: [
        {
          id: 'p-lokal',
          name: 'Produk Lokal',
          price: 5000,
          hpp: 2000,
          stock: 10,
          unit: 'pack',
          tone: 'leaf',
          active: true,
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-02T00:00:00.000Z',
        },
        {
          id: 'p-bersama',
          name: 'Versi Lokal',
          price: 6000,
          hpp: 2000,
          stock: 4,
          unit: 'pack',
          tone: 'leaf',
          active: true,
          createdAt: '2026-01-05T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      warungs: [],
    };

    const remote: AppState = {
      ...createInitialState(),
      meta: { onboarded: true, demo: false, createdAt: '2026-01-02T00:00:00.000Z' },
      settings: { ...createInitialState().settings, businessName: 'Dapur Cloud' },
      products: [
        {
          id: 'p-clod',
          name: 'Produk Cloud',
          price: 9000,
          hpp: 3000,
          stock: 2,
          unit: 'pack',
          tone: 'chili',
          active: true,
          createdAt: '2026-02-10T00:00:00.000Z',
          updatedAt: '2026-02-10T00:00:00.000Z',
        },
        {
          id: 'p-bersama',
          name: 'Versi Cloud',
          price: 5000,
          hpp: 2000,
          stock: 4,
          unit: 'pack',
          tone: 'leaf',
          active: true,
          createdAt: '2026-01-05T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
      warungs: [],
    };

    const merged = mergeStates(local, remote);
    const ids = merged.products.map((product) => product.id).sort();
    expect(ids).toEqual(['p-bersama', 'p-clod', 'p-lokal']);
    // Produk yang sama memakai versi dengan updatedAt lebih baru (lokal).
    expect(merged.products.find((product) => product.id === 'p-bersama')?.name).toBe('Versi Lokal');
    expect(merged.settings.businessName).toBe('Dapur Lokal');
    expect(merged.meta.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('mengenali state kosong dan tabel kosong', () => {
    expect(isEmptyState(createInitialState())).toBe(true);
    expect(isEmptyState(createDemoState())).toBe(false);
    expect(isEmptyRows(emptyStateRows())).toBe(true);
    expect(isEmptyRows(stateToRows(createInitialState(), USER_ID))).toBe(false);
  });
});
