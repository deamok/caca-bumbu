export type ProductTone = 'saffron' | 'chili' | 'leaf' | 'clay' | 'cocoa' | 'ocean';

export interface Product {
  id: string;
  name: string;
  price: number;
  hpp: number;
  stock: number;
  unit: string;
  tone: ProductTone;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Warung {
  id: string;
  name: string;
  owner: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
}

export interface LineItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
}

export interface Sale {
  id: string;
  code: string;
  date: string;
  warungId: string | null;
  buyerName: string;
  items: LineItem[];
  total: number;
  note: string;
  createdAt: string;
}

export interface ConsignmentItem extends LineItem {
  sentQty: number;
  soldQty: number;
  returnedQty: number;
  damagedQty: number;
}

export type ConsignmentStatus = 'aktif' | 'selesai';

export interface Consignment {
  id: string;
  code: string;
  warungId: string;
  date: string;
  dueDate: string;
  items: ConsignmentItem[];
  status: ConsignmentStatus;
  closedAt: string | null;
  note: string;
  closeNote: string;
  createdAt: string;
}

export type PaymentMethod = 'Tunai' | 'QRIS' | 'Transfer';
export type PaymentRefType = 'sale' | 'consignment';

export interface Payment {
  id: string;
  refType: PaymentRefType;
  refId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  note: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  category: string;
  createdAt: string;
}

export interface PurchaseItem {
  ingredientId: string;
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Purchase {
  id: string;
  code: string;
  date: string;
  supplier: string;
  note: string;
  items: PurchaseItem[];
  total: number;
  createdAt: string;
}

export type StockMoveType = 'awal' | 'opname' | 'jual' | 'titip' | 'retur' | 'rusak';

export interface StockMove {
  id: string;
  date: string;
  productId: string;
  qty: number;
  type: StockMoveType;
  refId?: string;
  note?: string;
}

export interface Settings {
  businessName: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  address: string;
  lowStockThreshold: number;
}

export interface AppMeta {
  onboarded: boolean;
  demo: boolean;
  createdAt: string;
}

export interface AppState {
  version: 1;
  products: Product[];
  warungs: Warung[];
  sales: Sale[];
  consignments: Consignment[];
  payments: Payment[];
  ingredients: Ingredient[];
  purchases: Purchase[];
  stockMoves: StockMove[];
  settings: Settings;
  meta: AppMeta;
}

export interface CartLine {
  product: Product;
  qty: number;
}

export interface OutstandingInvoice {
  refType: PaymentRefType;
  refId: string;
  code: string;
  date: string;
  warungId: string | null;
  customerName: string;
  total: number;
  paid: number;
  outstanding: number;
}

export type PeriodKey = 'today' | '7d' | '30d' | 'month';

export interface RevenueLine {
  date: string;
  key: string;
  revenue: number;
  qty: number;
  source: 'sale' | 'consignment';
  refId: string;
  code: string;
}