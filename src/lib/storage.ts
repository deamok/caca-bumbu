import type { AppState } from '../types';
import { createInitialState } from '../data/seed';

export const STORAGE_KEY = 'caca-bumbu:state:v1';

function sanitize(input: unknown): AppState | null {
  if (!input || typeof input !== 'object') return null;
  const parsed = input as Partial<AppState>;
  if (parsed.version !== 1 || !Array.isArray(parsed.products) || !Array.isArray(parsed.warungs)) return null;
  const initial = createInitialState();
  return {
    ...initial,
    ...parsed,
    products: parsed.products,
    warungs: parsed.warungs,
    sales: Array.isArray(parsed.sales) ? parsed.sales : [],
    consignments: Array.isArray(parsed.consignments) ? parsed.consignments : [],
    payments: Array.isArray(parsed.payments) ? parsed.payments : [],
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
    purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
    stockMoves: Array.isArray(parsed.stockMoves) ? parsed.stockMoves : [],
    settings: { ...initial.settings, ...(parsed.settings ?? {}) },
    meta: { ...initial.meta, ...(parsed.meta ?? {}) },
    version: 1,
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    return sanitize(JSON.parse(raw)) ?? createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Gagal menyimpan data lokal', error);
  }
}

export function clearStoredState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function exportState(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `caca-bumbu-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File backup tidak bisa dibaca.');
  }
  const state = sanitize(parsed);
  if (!state) throw new Error('File bukan backup Caca Bumbu yang valid.');
  return state;
}
