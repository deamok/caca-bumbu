import type {
  AppState,
  Consignment,
  ConsignmentItem,
  LineItem,
  OutstandingInvoice,
  Payment,
  PaymentMethod,
  PaymentRefType,
  Product,
  Purchase,
  PurchaseItem,
  Sale,
  StockMove,
  Warung,
} from '../types';
import { addDaysKey, dateKey, daysUntil, nowISO, todayKey } from './date';
import { documentCode, uid } from './id';

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export interface SaleLineInput {
  productId: string;
  qty: number;
}

export interface SaleInput {
  items: SaleLineInput[];
  date?: string;
  warungId: string | null;
  buyerName?: string;
  paymentMethod: PaymentMethod | 'Bon';
  paidAmount: number;
  note?: string;
}

export interface ConsignmentInput {
  warungId: string;
  date?: string;
  dueDate: string;
  items: SaleLineInput[];
  note?: string;
}

export interface ConsignmentCount {
  productId: string;
  soldQty: number;
  damagedQty: number;
}

export interface NextDropInput {
  dueDate: string;
  items: SaleLineInput[];
  note?: string;
}

export interface CloseConsignmentInput {
  id: string;
  date?: string;
  counts: ConsignmentCount[];
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  note?: string;
  nextDrop?: NextDropInput | null;
}

export interface PaymentInput {
  refType: PaymentRefType;
  refId: string;
  amount: number;
  date?: string;
  method: PaymentMethod;
  note?: string;
}

export interface PurchaseLineInput {
  ingredientId?: string;
  name: string;
  unit: string;
  category: string;
  qty: number;
  unitPrice: number;
  total?: number;
}

export interface PurchaseInput {
  date?: string;
  supplier?: string;
  note?: string;
  items: PurchaseLineInput[];
}

export function totalOf(items: Array<{ qty: number; price: number }>): number {
  return items.reduce((sum, item) => sum + item.qty * item.price, 0);
}

export function saleTotal(sale: Sale): number {
  return sale.total || totalOf(sale.items);
}

export function consignmentTotal(consignment: Consignment): number {
  return consignment.items.reduce((sum, item) => sum + item.soldQty * item.price, 0);
}

export function paymentTotal(state: AppState, refType: PaymentRefType, refId: string): number {
  return state.payments
    .filter((payment) => payment.refType === refType && payment.refId === refId)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

export function getSale(state: AppState, id: string): Sale | undefined {
  return state.sales.find((sale) => sale.id === id);
}

export function getConsignment(state: AppState, id: string): Consignment | undefined {
  return state.consignments.find((consignment) => consignment.id === id);
}

export function getWarung(state: AppState, id: string | null): Warung | undefined {
  return id ? state.warungs.find((warung) => warung.id === id) : undefined;
}

export function getProduct(state: AppState, id: string): Product | undefined {
  return state.products.find((product) => product.id === id);
}

export function outstandingFor(state: AppState, refType: PaymentRefType, refId: string): number {
  const source = refType === 'sale' ? getSale(state, refId) : getConsignment(state, refId);
  if (!source) return 0;
  if (refType === 'consignment' && (source as Consignment).status !== 'selesai') return 0;
  const total = refType === 'sale' ? saleTotal(source as Sale) : consignmentTotal(source as Consignment);
  return Math.max(0, total - paymentTotal(state, refType, refId));
}

export function outstandingInvoices(state: AppState): OutstandingInvoice[] {
  const rows: OutstandingInvoice[] = [];
  for (const sale of state.sales) {
    const total = saleTotal(sale);
    const paid = paymentTotal(state, 'sale', sale.id);
    const outstanding = Math.max(0, total - paid);
    if (outstanding > 0) {
      rows.push({
        refType: 'sale',
        refId: sale.id,
        code: sale.code,
        date: sale.date,
        warungId: sale.warungId,
        customerName: getWarung(state, sale.warungId)?.name ?? sale.buyerName,
        total,
        paid,
        outstanding,
      });
    }
  }
  for (const consignment of state.consignments) {
    if (consignment.status !== 'selesai') continue;
    const total = consignmentTotal(consignment);
    const paid = paymentTotal(state, 'consignment', consignment.id);
    const outstanding = Math.max(0, total - paid);
    if (outstanding > 0) {
      rows.push({
        refType: 'consignment',
        refId: consignment.id,
        code: consignment.code,
        date: consignment.closedAt ?? consignment.date,
        warungId: consignment.warungId,
        customerName: getWarung(state, consignment.warungId)?.name ?? 'Warung',
        total,
        paid,
        outstanding,
      });
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function outstandingTotal(state: AppState): number {
  return outstandingInvoices(state).reduce((sum, invoice) => sum + invoice.outstanding, 0);
}

export function activeConsignments(state: AppState): Consignment[] {
  return state.consignments
    .filter((consignment) => consignment.status === 'aktif')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.date.localeCompare(b.date));
}

export function lateConsignments(state: AppState): Consignment[] {
  return activeConsignments(state).filter((consignment) => daysUntil(consignment.dueDate) < 0);
}

export function dueTodayConsignments(state: AppState): Consignment[] {
  return activeConsignments(state).filter((consignment) => consignment.dueDate === todayKey());
}

export function consignmentOutstandingValue(consignment: Consignment): number {
  return consignment.items.reduce((sum, item) => sum + item.sentQty * item.price, 0);
}

export function consignmentRemaining(consignment: Consignment): number {
  return consignment.items.reduce(
    (sum, item) => sum + Math.max(0, item.sentQty - item.soldQty - item.damagedQty - item.returnedQty),
    0,
  );
}

export function allProductsTotalStock(state: AppState): number {
  return state.products.filter((product) => product.active).reduce((sum, product) => sum + product.stock, 0);
}

export function stockValue(state: AppState): number {
  return state.products
    .filter((product) => product.active)
    .reduce((sum, product) => sum + product.stock * (product.hpp || product.price * 0.6), 0);
}

export function lowStockProducts(state: AppState): Product[] {
  return state.products
    .filter((product) => product.active && product.stock <= state.settings.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock);
}

function normalizeLines(state: AppState, lines: SaleLineInput[]): LineItem[] {
  const merged = new Map<string, number>();
  for (const line of lines) {
    const qty = Math.floor(Number(line.qty));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + qty);
  }
  if (merged.size === 0) throw new DomainError('Tambahkan minimal satu bumbu.');

  return Array.from(merged.entries()).map(([productId, qty]) => {
    const product = getProduct(state, productId);
    if (!product || !product.active) throw new DomainError('Ada bumbu yang sudah tidak aktif.');
    return { productId, name: product.name, qty, price: product.price };
  });
}

export function stockShortage(state: AppState, lines: SaleLineInput[]): { product: Product; needed: number } | null {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (line.qty > 0) totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.qty);
  }
  for (const [productId, needed] of totals.entries()) {
    const product = getProduct(state, productId);
    if (product && product.stock < needed) return { product, needed };
  }
  return null;
}

function takeStock(
  products: Product[],
  items: LineItem[],
  date: string,
  type: 'jual' | 'titip',
  refId: string,
  note: string,
  stockMoves: StockMove[],
): Product[] {
  const next = products.map((product) => {
    const item = items.find((line) => line.productId === product.id);
    if (!item) return product;
    return { ...product, stock: product.stock - item.qty, updatedAt: date };
  });
  const moves: StockMove[] = items.map((item) => ({
    id: uid('move'),
    date,
    productId: item.productId,
    qty: -item.qty,
    type,
    refId,
    note,
  }));
  stockMoves.push(...moves);
  return next;
}

function makePayment(
  refType: PaymentRefType,
  refId: string,
  amount: number,
  date: string,
  method: PaymentMethod,
  note: string,
): Payment | null {
  if (amount <= 0) return null;
  return {
    id: uid('pay'),
    refType,
    refId,
    amount,
    date,
    method,
    note,
  };
}

export function createSale(state: AppState, input: SaleInput): { state: AppState; sale: Sale } {
  const date = input.date ?? nowISO();
  const items = normalizeLines(state, input.items);
  const total = totalOf(items);
  const shortage = stockShortage(state, items);
  if (shortage) {
    throw new DomainError(`Stok ${shortage.product.name} tinggal ${shortage.product.stock} ${shortage.product.unit}.`);
  }

  const warung = getWarung(state, input.warungId);
  const buyerName = (input.buyerName || warung?.name || 'Pembeli umum').trim();
  const sequence = state.sales.filter((sale) => dateKey(sale.date) === dateKey(date)).length + 1;
  const sale: Sale = {
    id: uid('sale'),
    code: documentCode('JL', dateKey(date), sequence),
    date,
    warungId: warung?.id ?? null,
    buyerName,
    items,
    total,
    note: input.note?.trim() ?? '',
    createdAt: date,
  };

  if (input.paidAmount < 0) throw new DomainError('Jumlah pembayaran tidak valid.');
  if (input.paidAmount > total + 0.5) throw new DomainError('Pembayaran melebihi total transaksi.');

  const stockMoves: StockMove[] = [];
  const products = takeStock(state.products, items, date, 'jual', sale.id, sale.code, stockMoves);
  const payment = makePayment('sale', sale.id, Math.min(input.paidAmount, total), date, input.paymentMethod === 'Bon' ? 'Tunai' : input.paymentMethod, `Pembayaran ${sale.code}`);
  const payments = payment ? [payment] : [];

  return {
    state: {
      ...state,
      products,
      sales: [sale, ...state.sales],
      payments: [...payments, ...state.payments],
      stockMoves: [...stockMoves, ...state.stockMoves],
    },
    sale,
  };
}

export function createConsignment(state: AppState, input: ConsignmentInput): { state: AppState; consignment: Consignment } {
  const warung = getWarung(state, input.warungId);
  if (!warung) throw new DomainError('Pilih warung terlebih dahulu.');
  const date = input.date ?? nowISO();
  const items = normalizeLines(state, input.items);
  if (!input.dueDate || input.dueDate < dateKey(date)) throw new DomainError('Tanggal kunjungan tidak boleh sebelum tanggal titip.');
  const shortage = stockShortage(state, items);
  if (shortage) {
    throw new DomainError(`Stok ${shortage.product.name} tinggal ${shortage.product.stock} ${shortage.product.unit}.`);
  }

  const sequence = state.consignments.filter((consignment) => dateKey(consignment.date) === dateKey(date)).length + 1;
  const consignmentItems: ConsignmentItem[] = items.map((item) => ({
    ...item,
    sentQty: item.qty,
    soldQty: 0,
    returnedQty: 0,
    damagedQty: 0,
  }));
  const consignment: Consignment = {
    id: uid('tt'),
    code: documentCode('TT', dateKey(date), sequence),
    warungId: warung.id,
    date,
    dueDate: input.dueDate,
    items: consignmentItems,
    status: 'aktif',
    closedAt: null,
    note: input.note?.trim() ?? '',
    closeNote: '',
    createdAt: date,
  };
  const stockMoves: StockMove[] = [];
  const products = takeStock(
    state.products,
    consignmentItems,
    date,
    'titip',
    consignment.id,
    consignment.code,
    stockMoves,
  );

  return {
    state: {
      ...state,
      products,
      consignments: [consignment, ...state.consignments],
      stockMoves: [...stockMoves, ...state.stockMoves],
    },
    consignment,
  };
}

export function closeConsignment(
  state: AppState,
  input: CloseConsignmentInput,
): { state: AppState; consignment: Consignment; nextConsignment?: Consignment } {
  const existing = getConsignment(state, input.id);
  if (!existing) throw new DomainError('Titipan tidak ditemukan.');
  if (existing.status !== 'aktif') throw new DomainError('Titipan ini sudah selesai dihitung.');
  const date = input.date ?? nowISO();

  const counts = new Map(input.counts.map((count) => [count.productId, count]));
  let total = 0;
  const audited = existing.items.map((item) => {
    const count = counts.get(item.productId);
    const soldQty = Math.max(0, Math.floor(Number(count?.soldQty ?? 0)));
    const damagedQty = Math.max(0, Math.floor(Number(count?.damagedQty ?? 0)));
    if (soldQty + damagedQty > item.sentQty) {
      throw new DomainError(`Jumlah laku + rusak ${item.name} melebihi jumlah titipan.`);
    }
    const returnedQty = item.sentQty - soldQty - damagedQty;
    total += soldQty * item.price;
    return { ...item, soldQty, damagedQty, returnedQty };
  });

  if (input.paymentAmount < 0) throw new DomainError('Jumlah pembayaran tidak valid.');
  if (input.paymentAmount > total + 0.5) throw new DomainError('Pembayaran melebihi total penjualan titipan.');

  let nextProducts = state.products.map((product) => {
    const item = audited.find((line) => line.productId === product.id);
    if (!item || item.returnedQty === 0) return product;
    return { ...product, stock: product.stock + item.returnedQty, updatedAt: date };
  });

  const returnMoves: StockMove[] = audited
    .filter((item) => item.returnedQty > 0)
    .map((item) => ({
      id: uid('move'),
      date,
      productId: item.productId,
      qty: item.returnedQty,
      type: 'retur' as const,
      refId: existing.id,
      note: `Retur ${existing.code}`,
    }));

  const closed: Consignment = {
    ...existing,
    items: audited,
    status: 'selesai',
    closedAt: date,
    closeNote: input.note?.trim() ?? '',
  };

  const payment = makePayment(
    'consignment',
    existing.id,
    Math.min(input.paymentAmount, total),
    date,
    input.paymentMethod,
    `Setoran ${existing.code}`,
  );

  let nextState: AppState = {
    ...state,
    products: nextProducts,
    consignments: state.consignments.map((consignment) => (consignment.id === existing.id ? closed : consignment)),
    payments: payment ? [payment, ...state.payments] : state.payments,
    stockMoves: [...returnMoves, ...state.stockMoves],
  };

  let nextConsignment: Consignment | undefined;
  if (input.nextDrop && input.nextDrop.items.some((item) => item.qty > 0)) {
    const created = createConsignment(nextState, {
      warungId: existing.warungId,
      date,
      dueDate: input.nextDrop.dueDate,
      items: input.nextDrop.items,
      note: input.nextDrop.note ?? '',
    });
    nextState = created.state;
    nextConsignment = created.consignment;
  }

  return { state: nextState, consignment: nextState.consignments.find((c) => c.id === existing.id) ?? closed, nextConsignment };
}

export function addPayment(state: AppState, input: PaymentInput): AppState {
  const outstanding = outstandingFor(state, input.refType, input.refId);
  if (input.amount <= 0) throw new DomainError('Nominal pembayaran harus lebih dari nol.');
  if (input.amount > outstanding + 0.5) throw new DomainError('Nominal pembayaran melebihi sisa tagihan.');
  const date = input.date ?? nowISO();
  const payment = makePayment(input.refType, input.refId, Math.min(input.amount, outstanding), date, input.method, input.note?.trim() ?? '');
  if (!payment) throw new DomainError('Nominal pembayaran harus lebih dari nol.');
  return { ...state, payments: [payment, ...state.payments] };
}

export function adjustProductStock(
  state: AppState,
  productId: string,
  newStock: number,
  note = 'Penyesuaian stok',
  date = nowISO(),
): AppState {
  const product = getProduct(state, productId);
  if (!product) throw new DomainError('Produk tidak ditemukan.');
  const rounded = Math.floor(Number(newStock));
  if (!Number.isFinite(rounded) || rounded < 0) throw new DomainError('Stok tidak boleh negatif.');
  const delta = rounded - product.stock;
  if (delta === 0) return state;
  const move: StockMove = {
    id: uid('move'),
    date,
    productId,
    qty: delta,
    type: delta > 0 ? 'awal' : 'opname',
    note,
  };
  return {
    ...state,
    products: state.products.map((item) =>
      item.id === productId ? { ...item, stock: rounded, updatedAt: date } : item,
    ),
    stockMoves: [move, ...state.stockMoves],
  };
}

export function createProduct(
  state: AppState,
  input: { name: string; price: number; hpp?: number; stock?: number; unit?: string; tone?: Product['tone'] },
): { state: AppState; product: Product } {
  const name = input.name.trim();
  if (!name) throw new DomainError('Nama bumbu wajib diisi.');
  if (!Number.isFinite(input.price) || input.price < 0) throw new DomainError('Harga tidak valid.');
  const timestamp = nowISO();
  const stock = Math.max(0, Math.floor(input.stock ?? 0));
  const product: Product = {
    id: uid('prod'),
    name,
    price: input.price,
    hpp: Math.max(0, input.hpp ?? 0),
    stock,
    unit: input.unit?.trim() || 'pack',
    tone: input.tone ?? 'saffron',
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const moves: StockMove[] = stock > 0
    ? [{ id: uid('move'), date: timestamp, productId: product.id, qty: stock, type: 'awal', note: 'Stok awal produk' }]
    : [];
  return {
    state: {
      ...state,
      products: [...state.products, product],
      stockMoves: [...moves, ...state.stockMoves],
    },
    product,
  };
}

export function updateProduct(
  state: AppState,
  productId: string,
  changes: Partial<Pick<Product, 'name' | 'price' | 'hpp' | 'stock' | 'unit' | 'tone' | 'active'>>,
): AppState {
  const product = getProduct(state, productId);
  if (!product) throw new DomainError('Produk tidak ditemukan.');
  const timestamp = nowISO();
  const stock = changes.stock === undefined ? product.stock : Math.max(0, Math.floor(changes.stock));
  const next: Product = {
    ...product,
    ...changes,
    name: changes.name?.trim() || product.name,
    stock,
    price: changes.price === undefined ? product.price : Math.max(0, changes.price),
    hpp: changes.hpp === undefined ? product.hpp : Math.max(0, changes.hpp),
    unit: changes.unit?.trim() || product.unit,
    updatedAt: timestamp,
  };
  let stockMoves = state.stockMoves;
  if (stock !== product.stock) {
    stockMoves = [
      {
        id: uid('move'),
        date: timestamp,
        productId,
        qty: stock - product.stock,
        type: 'opname',
        note: 'Perubahan stok dari produk',
      },
      ...stockMoves,
    ];
  }
  return {
    ...state,
    products: state.products.map((item) => (item.id === productId ? next : item)),
    stockMoves,
  };
}

export function createPurchase(state: AppState, input: PurchaseInput): { state: AppState; purchase: Purchase } {
  const date = input.date ?? nowISO();
  const rows = input.items.filter(
    (item) => item.name.trim() && Number(item.qty) > 0 && Number(item.unitPrice) >= 0,
  );
  if (rows.length === 0) throw new DomainError('Tambahkan minimal satu bahan dengan jumlah dan harga.');
  const ingredients = [...state.ingredients];
  const purchaseItems: PurchaseItem[] = rows.map((row) => {
    const name = row.name.trim();
    let ingredient = row.ingredientId
      ? ingredients.find((item) => item.id === row.ingredientId)
      : ingredients.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!ingredient) {
      ingredient = {
        id: uid('ing'),
        name,
        unit: row.unit || 'kg',
        category: row.category || 'Bumbu',
        createdAt: date,
      };
      ingredients.push(ingredient);
    } else if (row.category && ingredient.category !== row.category) {
      const index = ingredients.findIndex((item) => item.id === ingredient?.id);
      ingredient = { ...ingredient, category: row.category };
      if (index >= 0) ingredients[index] = ingredient;
    }
    const qty = Number(row.qty);
    const total = row.total === undefined ? Math.round(qty * Number(row.unitPrice)) : Math.round(Number(row.total));
    const unitPrice = qty > 0 ? total / qty : Number(row.unitPrice);
    return {
      ingredientId: ingredient.id,
      name: ingredient.name,
      qty,
      unit: row.unit || ingredient.unit,
      unitPrice,
      total,
    };
  });
  const total = purchaseItems.reduce((sum, item) => sum + item.total, 0);
  const sequence = state.purchases.filter((purchase) => dateKey(purchase.date) === dateKey(date)).length + 1;
  const purchase: Purchase = {
    id: uid('buy'),
    code: documentCode('BH', dateKey(date), sequence),
    date,
    supplier: input.supplier?.trim() || 'Pasar',
    note: input.note?.trim() || '',
    items: purchaseItems,
    total,
    createdAt: date,
  };
  return {
    state: {
      ...state,
      ingredients,
      purchases: [purchase, ...state.purchases],
    },
    purchase,
  };
}

export function createWarung(
  state: AppState,
  input: Pick<Warung, 'name' | 'owner' | 'phone' | 'address' | 'notes'>,
): { state: AppState; warung: Warung } {
  const name = input.name.trim();
  if (!name) throw new DomainError('Nama warung wajib diisi.');
  const warung: Warung = {
    id: uid('warung'),
    name,
    owner: input.owner.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    notes: input.notes.trim(),
    createdAt: nowISO(),
  };
  return { state: { ...state, warungs: [warung, ...state.warungs] }, warung };
}

export function updateWarung(state: AppState, id: string, changes: Partial<Omit<Warung, 'id' | 'createdAt'>>): AppState {
  return {
    ...state,
    warungs: state.warungs.map((warung) => (warung.id === id ? { ...warung, ...changes } : warung)),
  };
}

export function nextVisitDate(fromKey = todayKey(), days = 7): string {
  return addDaysKey(fromKey, days);
}
