import type {
  AppMeta,
  AppState,
  Consignment,
  ConsignmentItem,
  ConsignmentStatus,
  Ingredient,
  LineItem,
  Payment,
  PaymentMethod,
  PaymentRefType,
  Product,
  ProductTone,
  Purchase,
  PurchaseItem,
  Sale,
  Settings,
  StockMove,
  StockMoveType,
  Warung,
} from '../types';
import { createInitialState } from '../data/seed';

/**
 * Jembatan antara `AppState` (bentuk yang dipakai seluruh UI dan logika domain)
 * dengan tabel-tabel Supabase. Semua fungsi di sini murni (tanpa jaringan)
 * supaya mudah diuji dan aman dipakai saat luring.
 */

export type CloudRow = Record<string, unknown>;

export const STATE_TABLES = [
  'products',
  'warungs',
  'sales',
  'consignments',
  'payments',
  'ingredients',
  'purchases',
  'stockMoves',
] as const;

export type StateTable = (typeof STATE_TABLES)[number];

export const TABLE_NAMES: Record<StateTable, string> = {
  products: 'products',
  warungs: 'warungs',
  sales: 'sales',
  consignments: 'consignments',
  payments: 'payments',
  ingredients: 'ingredients',
  purchases: 'purchases',
  stockMoves: 'stock_moves',
};

export interface StateRows {
  products: CloudRow[];
  warungs: CloudRow[];
  sales: CloudRow[];
  consignments: CloudRow[];
  payments: CloudRow[];
  ingredients: CloudRow[];
  purchases: CloudRow[];
  stockMoves: CloudRow[];
  settings: CloudRow | null;
  meta: CloudRow | null;
}

export interface RowChangeSet {
  upserts: Partial<Record<StateTable, CloudRow[]>>;
  deletes: Partial<Record<StateTable, string[]>>;
  settings?: CloudRow | null;
  meta?: CloudRow | null;
}

const TONES: readonly ProductTone[] = ['saffron', 'chili', 'leaf', 'clay', 'cocoa', 'ocean'];
const PAYMENT_METHODS: readonly PaymentMethod[] = ['Tunai', 'QRIS', 'Transfer'];
const PAYMENT_REF_TYPES: readonly PaymentRefType[] = ['sale', 'consignment'];
const CONSIGNMENT_STATUSES: readonly ConsignmentStatus[] = ['aktif', 'selesai'];
const STOCK_MOVE_TYPES: readonly StockMoveType[] = ['awal', 'opname', 'jual', 'titip', 'retur', 'rusak'];

/* --------------------------------- helpers --------------------------------- */

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Normalisasi timestamp ke ISO-8601 UTC agar perbandingan string konsisten. */
function iso(value: unknown, fallback = '1970-01-01T00:00:00.000Z'): string {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return fallback;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function compact<T>(items: Array<T | null>): T[] {
  return items.filter((item): item is T => item !== null);
}

function byDateDesc<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.date.localeCompare(a.date));
}

function fingerprint(row: CloudRow): string {
  return JSON.stringify(row);
}

/* ------------------------------ state -> rows ------------------------------ */

function productToRow(product: Product, userId: string): CloudRow {
  return {
    user_id: userId,
    id: product.id,
    name: product.name,
    price: product.price,
    hpp: product.hpp,
    stock: product.stock,
    unit: product.unit,
    tone: product.tone,
    active: product.active,
    image_url: product.imageUrl ?? '',
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  };
}

function warungToRow(warung: Warung, userId: string): CloudRow {
  return {
    user_id: userId,
    id: warung.id,
    name: warung.name,
    owner: warung.owner,
    phone: warung.phone,
    address: warung.address,
    notes: warung.notes,
    created_at: warung.createdAt,
  };
}

function saleToRow(sale: Sale, userId: string): CloudRow {
  return {
    user_id: userId,
    id: sale.id,
    code: sale.code,
    date: sale.date,
    warung_id: sale.warungId,
    buyer_name: sale.buyerName,
    items: sale.items,
    total: sale.total,
    note: sale.note,
    created_at: sale.createdAt,
  };
}

function consignmentToRow(consignment: Consignment, userId: string): CloudRow {
  return {
    user_id: userId,
    id: consignment.id,
    code: consignment.code,
    warung_id: consignment.warungId,
    date: consignment.date,
    due_date: consignment.dueDate,
    items: consignment.items,
    status: consignment.status,
    closed_at: consignment.closedAt,
    note: consignment.note,
    close_note: consignment.closeNote,
    created_at: consignment.createdAt,
  };
}

function paymentToRow(payment: Payment, userId: string): CloudRow {
  return {
    user_id: userId,
    id: payment.id,
    ref_type: payment.refType,
    ref_id: payment.refId,
    amount: payment.amount,
    date: payment.date,
    method: payment.method,
    note: payment.note,
  };
}

function ingredientToRow(ingredient: Ingredient, userId: string): CloudRow {
  return {
    user_id: userId,
    id: ingredient.id,
    name: ingredient.name,
    unit: ingredient.unit,
    category: ingredient.category,
    created_at: ingredient.createdAt,
  };
}

function purchaseToRow(purchase: Purchase, userId: string): CloudRow {
  return {
    user_id: userId,
    id: purchase.id,
    code: purchase.code,
    date: purchase.date,
    supplier: purchase.supplier,
    note: purchase.note,
    items: purchase.items,
    total: purchase.total,
    created_at: purchase.createdAt,
  };
}

function stockMoveToRow(move: StockMove, userId: string): CloudRow {
  return {
    user_id: userId,
    id: move.id,
    date: move.date,
    product_id: move.productId,
    qty: move.qty,
    type: move.type,
    ref_id: move.refId ?? null,
    note: move.note ?? null,
  };
}

function settingsToRow(settings: Settings, userId: string): CloudRow {
  return {
    user_id: userId,
    business_name: settings.businessName,
    owner_name: settings.ownerName,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    address: settings.address,
    low_stock_threshold: settings.lowStockThreshold,
  };
}

function metaToRow(meta: AppMeta, userId: string): CloudRow {
  return {
    user_id: userId,
    onboarded: meta.onboarded,
    demo: meta.demo,
    created_at: meta.createdAt,
  };
}

export function stateToRows(state: AppState, userId: string): StateRows {
  return {
    products: state.products.map((product) => productToRow(product, userId)),
    warungs: state.warungs.map((warung) => warungToRow(warung, userId)),
    sales: state.sales.map((sale) => saleToRow(sale, userId)),
    consignments: state.consignments.map((consignment) => consignmentToRow(consignment, userId)),
    payments: state.payments.map((payment) => paymentToRow(payment, userId)),
    ingredients: state.ingredients.map((ingredient) => ingredientToRow(ingredient, userId)),
    purchases: state.purchases.map((purchase) => purchaseToRow(purchase, userId)),
    stockMoves: state.stockMoves.map((move) => stockMoveToRow(move, userId)),
    settings: settingsToRow(state.settings, userId),
    meta: metaToRow(state.meta, userId),
  };
}

/* ------------------------------ rows -> state ------------------------------ */

function toLineItem(value: unknown): LineItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const productId = text(item.productId);
  if (!productId) return null;
  return {
    productId,
    name: text(item.name),
    qty: num(item.qty),
    price: num(item.price),
  };
}

function toConsignmentItem(value: unknown): ConsignmentItem | null {
  const base = toLineItem(value);
  if (!base) return null;
  const item = value as Record<string, unknown>;
  return {
    ...base,
    sentQty: num(item.sentQty, base.qty),
    soldQty: num(item.soldQty),
    returnedQty: num(item.returnedQty),
    damagedQty: num(item.damagedQty),
  };
}

function toPurchaseItem(value: unknown): PurchaseItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  return {
    ingredientId: text(item.ingredientId),
    name: text(item.name),
    qty: num(item.qty),
    unit: text(item.unit, 'kg'),
    unitPrice: num(item.unitPrice),
    total: num(item.total),
  };
}

function rowToProduct(row: CloudRow): Product | null {
  const id = text(row.id);
  if (!id) return null;
  const createdAt = iso(row.created_at);
  const imageUrl = text(row.image_url);
  return {
    id,
    name: text(row.name),
    price: num(row.price),
    hpp: num(row.hpp),
    stock: num(row.stock),
    unit: text(row.unit, 'pack'),
    tone: pick(row.tone, TONES, 'saffron'),
    active: bool(row.active, true),
    ...(imageUrl ? { imageUrl } : {}),
    createdAt,
    updatedAt: iso(row.updated_at, createdAt),
  };
}

function rowToWarung(row: CloudRow): Warung | null {
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    name: text(row.name),
    owner: text(row.owner),
    phone: text(row.phone),
    address: text(row.address),
    notes: text(row.notes),
    createdAt: iso(row.created_at),
  };
}

function rowToSale(row: CloudRow): Sale | null {
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    code: text(row.code),
    date: iso(row.date),
    warungId: typeof row.warung_id === 'string' && row.warung_id ? row.warung_id : null,
    buyerName: text(row.buyer_name),
    items: compact(asArray(row.items).map(toLineItem)),
    total: num(row.total),
    note: text(row.note),
    createdAt: iso(row.created_at, iso(row.date)),
  };
}

function rowToConsignment(row: CloudRow): Consignment | null {
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    code: text(row.code),
    warungId: text(row.warung_id),
    date: iso(row.date),
    dueDate: text(row.due_date),
    items: compact(asArray(row.items).map(toConsignmentItem)),
    status: pick(row.status, CONSIGNMENT_STATUSES, 'aktif'),
    closedAt: optionalText(row.closed_at) ? iso(row.closed_at) : null,
    note: text(row.note),
    closeNote: text(row.close_note),
    createdAt: iso(row.created_at, iso(row.date)),
  };
}

function rowToPayment(row: CloudRow): Payment | null {
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    refType: pick(row.ref_type, PAYMENT_REF_TYPES, 'sale'),
    refId: text(row.ref_id),
    amount: num(row.amount),
    date: iso(row.date),
    method: pick(row.method, PAYMENT_METHODS, 'Tunai'),
    note: text(row.note),
  };
}

function rowToIngredient(row: CloudRow): Ingredient | null {
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    name: text(row.name),
    unit: text(row.unit, 'kg'),
    category: text(row.category, 'Bumbu'),
    createdAt: iso(row.created_at),
  };
}

function rowToPurchase(row: CloudRow): Purchase | null {
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    code: text(row.code),
    date: iso(row.date),
    supplier: text(row.supplier, 'Pasar'),
    note: text(row.note),
    items: compact(asArray(row.items).map(toPurchaseItem)),
    total: num(row.total),
    createdAt: iso(row.created_at, iso(row.date)),
  };
}

function rowToStockMove(row: CloudRow): StockMove | null {
  const id = text(row.id);
  if (!id) return null;
  const move: StockMove = {
    id,
    date: iso(row.date),
    productId: text(row.product_id),
    qty: num(row.qty),
    type: pick(row.type, STOCK_MOVE_TYPES, 'opname'),
  };
  const refId = optionalText(row.ref_id);
  const note = optionalText(row.note);
  if (refId) move.refId = refId;
  if (note) move.note = note;
  return move;
}

function rowToSettings(row: CloudRow): Settings {
  return {
    businessName: text(row.business_name, 'Caca Bumbu'),
    ownerName: text(row.owner_name, 'Caca'),
    phone: text(row.phone),
    whatsapp: text(row.whatsapp),
    address: text(row.address),
    lowStockThreshold: num(row.low_stock_threshold, 5),
  };
}

function rowToMeta(row: CloudRow): AppMeta {
  return {
    onboarded: bool(row.onboarded),
    demo: bool(row.demo),
    createdAt: iso(row.created_at, new Date().toISOString()),
  };
}

export function rowsToState(rows: StateRows): AppState {
  const initial = createInitialState();
  return {
    version: 1,
    products: compact(rows.products.map(rowToProduct)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    warungs: compact(rows.warungs.map(rowToWarung)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    sales: byDateDesc(compact(rows.sales.map(rowToSale))),
    consignments: byDateDesc(compact(rows.consignments.map(rowToConsignment))),
    payments: byDateDesc(compact(rows.payments.map(rowToPayment))),
    ingredients: compact(rows.ingredients.map(rowToIngredient)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    purchases: byDateDesc(compact(rows.purchases.map(rowToPurchase))),
    stockMoves: byDateDesc(compact(rows.stockMoves.map(rowToStockMove))),
    settings: rows.settings ? rowToSettings(rows.settings) : initial.settings,
    meta: rows.meta ? rowToMeta(rows.meta) : initial.meta,
  };
}

/* ---------------------------------- diff ----------------------------------- */

export function emptyStateRows(): StateRows {
  return {
    products: [],
    warungs: [],
    sales: [],
    consignments: [],
    payments: [],
    ingredients: [],
    purchases: [],
    stockMoves: [],
    settings: null,
    meta: null,
  };
}

export function isEmptyRows(rows: StateRows): boolean {
  return (
    STATE_TABLES.every((table) => rows[table].length === 0) &&
    rows.settings === null &&
    rows.meta === null
  );
}

/** True bila state lokal belum pernah dipakai (belum onboarding & tanpa transaksi). */
export function isEmptyState(state: AppState): boolean {
  return (
    !state.meta.onboarded &&
    state.sales.length === 0 &&
    state.consignments.length === 0 &&
    state.purchases.length === 0 &&
    state.payments.length === 0 &&
    state.stockMoves.length === 0
  );
}

export function diffStateRows(base: StateRows | null, next: StateRows): RowChangeSet {
  const changes: RowChangeSet = { upserts: {}, deletes: {} };

  for (const table of STATE_TABLES) {
    const baseRows = new Map((base?.[table] ?? []).map((row) => [String(row.id), row]));
    const nextRows = new Map(next[table].map((row) => [String(row.id), row]));

    const upserts: CloudRow[] = [];
    for (const [id, row] of nextRows) {
      const previous = baseRows.get(id);
      if (!previous || fingerprint(previous) !== fingerprint(row)) upserts.push(row);
    }
    const deletes = [...baseRows.keys()].filter((id) => !nextRows.has(id));

    if (upserts.length > 0) changes.upserts[table] = upserts;
    if (deletes.length > 0) changes.deletes[table] = deletes;
  }

  if (!base?.settings || fingerprint(base.settings) !== fingerprint(next.settings ?? {})) {
    changes.settings = next.settings;
  }
  if (!base?.meta || fingerprint(base.meta) !== fingerprint(next.meta ?? {})) {
    changes.meta = next.meta;
  }

  return changes;
}

export function isEmptyChangeSet(changes: RowChangeSet): boolean {
  return (
    Object.keys(changes.upserts).length === 0 &&
    Object.keys(changes.deletes).length === 0 &&
    !changes.settings &&
    !changes.meta
  );
}

/* --------------------------------- merge ----------------------------------- */

function mergeCollection<T extends { id: string }>(local: T[], remote: T[], stamp: (item: T) => string): T[] {
  const merged = new Map<string, T>();
  for (const item of remote) merged.set(item.id, item);
  for (const item of local) {
    const other = merged.get(item.id);
    if (!other || stamp(item) >= stamp(other)) merged.set(item.id, item);
  }
  return [...merged.values()];
}

/**
 * Gabungkan data perangkat (lokal) dengan data cloud saat perangkat pertama
 * kali tersambung. Baris yang sama dipilih berdasarkan timestamp terbaru;
 * baris yang hanya ada di satu sisi tetap dipertahankan.
 */
export function mergeStates(local: AppState, remote: AppState): AppState {
  const consignmentStamp = (item: Consignment) => (item.closedAt && item.closedAt > item.createdAt ? item.closedAt : item.createdAt);
  const earliest = local.meta.createdAt < remote.meta.createdAt ? local.meta.createdAt : remote.meta.createdAt;

  return {
    version: 1,
    products: mergeCollection(local.products, remote.products, (item) => item.updatedAt),
    warungs: mergeCollection(local.warungs, remote.warungs, (item) => item.createdAt),
    sales: mergeCollection(local.sales, remote.sales, (item) => item.createdAt),
    consignments: mergeCollection(local.consignments, remote.consignments, consignmentStamp),
    payments: mergeCollection(local.payments, remote.payments, (item) => item.date),
    ingredients: mergeCollection(local.ingredients, remote.ingredients, (item) => item.createdAt),
    purchases: mergeCollection(local.purchases, remote.purchases, (item) => item.createdAt),
    stockMoves: mergeCollection(local.stockMoves, remote.stockMoves, (item) => item.date),
    settings: local.meta.onboarded ? local.settings : remote.settings,
    meta: {
      onboarded: local.meta.onboarded || remote.meta.onboarded,
      demo: local.meta.demo && remote.meta.demo,
      createdAt: earliest,
    },
  };
}
