import type { AppState, PaymentMethod, Product, ProductTone, Warung } from '../types';
import { addDaysKey, isoAtDay, nowISO, todayKey } from '../lib/date';
import {
  addPayment,
  adjustProductStock,
  closeConsignment,
  createConsignment,
  createPurchase,
  createSale,
  type SaleLineInput,
} from '../lib/domain';

const TONES: ProductTone[] = ['chili', 'saffron', 'clay', 'cocoa', 'chili', 'cocoa', 'leaf', 'saffron', 'leaf', 'chili'];

const BASE_PRODUCTS: Array<{ id: string; name: string; price: number; hpp: number }> = [
  { id: 'p-rendang', name: 'Rendang', price: 5000, hpp: 3000 },
  { id: 'p-gulai', name: 'Gulai', price: 6000, hpp: 3600 },
  { id: 'p-opor', name: 'Opor', price: 5000, hpp: 3000 },
  { id: 'p-semur', name: 'Semur', price: 5000, hpp: 3000 },
  { id: 'p-ayam-bakar', name: 'Ayam Bakar', price: 5000, hpp: 3100 },
  { id: 'p-empal', name: 'Empal Daging', price: 5000, hpp: 3200 },
  { id: 'p-ketupat', name: 'Ketupat Sayur', price: 5000, hpp: 2900 },
  { id: 'p-soto', name: 'Soto', price: 5000, hpp: 2800 },
  { id: 'p-ungkep', name: 'Ayam Ungkep', price: 3000, hpp: 1700 },
  { id: 'p-balado', name: 'Balado', price: 5000, hpp: 3000 },
];

function baseProducts(stock = 0, withHpp = false): Product[] {
  const createdAt = isoAtDay(-60, 8);
  return BASE_PRODUCTS.map((item, index) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    hpp: withHpp ? item.hpp : 0,
    stock,
    unit: 'pack',
    tone: TONES[index],
    active: true,
    createdAt,
    updatedAt: createdAt,
  }));
}

export function createInitialState(): AppState {
  const createdAt = nowISO();
  return {
    version: 1,
    products: baseProducts(0, false),
    warungs: [],
    sales: [],
    consignments: [],
    payments: [],
    ingredients: [],
    purchases: [],
    stockMoves: [],
    settings: {
      businessName: 'Caca Bumbu',
      ownerName: 'Caca',
      phone: '',
      whatsapp: '',
      address: '',
      lowStockThreshold: 5,
    },
    meta: { onboarded: false, demo: false, createdAt },
  };
}

interface SaleSeed {
  day: number;
  hour: number;
  warungId: string | null;
  buyerName?: string;
  items: SaleLineInput[];
  method: PaymentMethod | 'Bon';
  pay: 'full' | 'none' | number;
  note?: string;
}

interface ConsignmentSeed {
  dropDay: number;
  dueOffset: number;
  warungId: string;
  items: SaleLineInput[];
  closedDay?: number;
  sold?: Record<string, number>;
  damaged?: Record<string, number>;
  payment?: number | 'full';
  method?: PaymentMethod;
  schedulePayment?: { amount: number; method: PaymentMethod; day: number };
}

const WARUNG_SEED: Array<Omit<Warung, 'createdAt'>> = [
  {
    id: 'w-bu-sari',
    name: 'Warung Bu Sari',
    owner: 'Sari',
    phone: '081200000011',
    address: 'Jl. Cempaka No. 12, Bandung',
    notes: 'Langganan rendang. Titip tiap Senin.',
  },
  {
    id: 'w-pak-ahmad',
    name: 'Warung Pak Ahmad',
    owner: 'Ahmad',
    phone: '081200000012',
    address: 'Jl. Kenanga No. 4, Bandung',
    notes: 'Sering ambil ayam bakar dan balado.',
  },
  {
    id: 'w-mpok-rina',
    name: 'Warung Mpok Rina',
    owner: 'Rina',
    phone: '081200000013',
    address: 'Gang Melati No. 7, Cimahi',
    notes: 'Minta dihubungi sebelum datang.',
  },
  {
    id: 'w-kedai-tjoet',
    name: 'Kedai Kopi Tjoet',
    owner: 'Tjoet',
    phone: '081200000014',
    address: 'Jl. Braga No. 21, Bandung',
    notes: 'Ambil ayam ungkep untuk menu sarapan.',
  },
];

export function createDemoState(): AppState {
  let state = createInitialState();
  const createdAt = isoAtDay(-60, 8);
  const openingMoves = BASE_PRODUCTS.map((product) => ({
    id: `demo-open-${product.id}`,
    date: createdAt,
    productId: product.id,
    qty: 80,
    type: 'awal' as const,
    note: 'Stok awal data contoh',
  }));

  state = {
    ...state,
    products: baseProducts(80, true),
    warungs: WARUNG_SEED.map((warung, index) => ({ ...warung, createdAt: isoAtDay(-55 + index, 9) })),
    stockMoves: openingMoves,
    settings: {
      businessName: 'Dapur Caca',
      ownerName: 'Caca',
      phone: '081200000010',
      whatsapp: '',
      address: 'Jl. Melati No. 8, Bandung',
      lowStockThreshold: 5,
    },
    meta: { onboarded: true, demo: true, createdAt },
  };

  const price = new Map(state.products.map((product) => [product.id, product.price]));
  const sum = (items: SaleLineInput[]) => items.reduce((total, item) => total + (price.get(item.productId) ?? 0) * item.qty, 0);

  const sales: SaleSeed[] = [
    {
      day: -7,
      hour: 9,
      warungId: 'w-bu-sari',
      items: [
        { productId: 'p-rendang', qty: 6 },
        { productId: 'p-gulai', qty: 4 },
      ],
      method: 'Tunai',
      pay: 'full',
    },
    {
      day: -6,
      hour: 15,
      warungId: null,
      buyerName: 'Bu Nia',
      items: [
        { productId: 'p-soto', qty: 3 },
        { productId: 'p-opor', qty: 2 },
      ],
      method: 'QRIS',
      pay: 'full',
      note: 'Pesanan arisan',
    },
    {
      day: -5,
      hour: 10,
      warungId: 'w-pak-ahmad',
      items: [
        { productId: 'p-ayam-bakar', qty: 5 },
        { productId: 'p-semur', qty: 4 },
        { productId: 'p-rendang', qty: 3 },
      ],
      method: 'Bon',
      pay: 'none',
      note: 'Dibayar saat kunjungan berikutnya',
    },
    {
      day: -4,
      hour: 11,
      warungId: 'w-kedai-tjoet',
      items: [
        { productId: 'p-ungkep', qty: 10 },
        { productId: 'p-balado', qty: 2 },
      ],
      method: 'Transfer',
      pay: 'full',
    },
    {
      day: -3,
      hour: 16,
      warungId: 'w-bu-sari',
      items: [
        { productId: 'p-ketupat', qty: 4 },
        { productId: 'p-gulai', qty: 3 },
      ],
      method: 'Tunai',
      pay: 'full',
    },
    {
      day: -2,
      hour: 9,
      warungId: 'w-mpok-rina',
      items: [
        { productId: 'p-balado', qty: 6 },
        { productId: 'p-ayam-bakar', qty: 5 },
        { productId: 'p-empal', qty: 3 },
      ],
      method: 'Bon',
      pay: 'none',
    },
    {
      day: -1,
      hour: 13,
      warungId: null,
      buyerName: 'Pak Yudi',
      items: [
        { productId: 'p-rendang', qty: 2 },
        { productId: 'p-opor', qty: 2 },
        { productId: 'p-soto', qty: 4 },
      ],
      method: 'Tunai',
      pay: 'full',
    },
    {
      day: 0,
      hour: 8,
      warungId: 'w-bu-sari',
      items: [
        { productId: 'p-rendang', qty: 3 },
        { productId: 'p-gulai', qty: 2 },
      ],
      method: 'QRIS',
      pay: 'full',
    },
    {
      day: 0,
      hour: 12,
      warungId: 'w-pak-ahmad',
      items: [
        { productId: 'p-ungkep', qty: 5 },
        { productId: 'p-ketupat', qty: 4 },
      ],
      method: 'Tunai',
      pay: 'full',
    },
  ];

  for (const entry of sales) {
    const total = sum(entry.items);
    const paidAmount = entry.pay === 'full' ? total : entry.pay === 'none' ? 0 : entry.pay;
    const result = createSale(state, {
      date: isoAtDay(entry.day, entry.hour, 15),
      warungId: entry.warungId,
      buyerName: entry.buyerName,
      items: entry.items,
      paymentMethod: entry.method,
      paidAmount,
      note: entry.note ?? '',
    });
    state = result.state;
  }

  const consignments: ConsignmentSeed[] = [
    {
      dropDay: -8,
      dueOffset: -2,
      warungId: 'w-mpok-rina',
      items: [
        { productId: 'p-empal', qty: 5 },
        { productId: 'p-ketupat', qty: 5 },
        { productId: 'p-rendang', qty: 5 },
        { productId: 'p-gulai', qty: 3 },
      ],
    },
    {
      dropDay: -3,
      dueOffset: 2,
      warungId: 'w-bu-sari',
      items: [
        { productId: 'p-rendang', qty: 4 },
        { productId: 'p-gulai', qty: 3 },
        { productId: 'p-opor', qty: 3 },
        { productId: 'p-semur', qty: 2 },
      ],
    },
    {
      dropDay: -2,
      dueOffset: 4,
      warungId: 'w-pak-ahmad',
      items: [
        { productId: 'p-ayam-bakar', qty: 6 },
        { productId: 'p-balado', qty: 4 },
        { productId: 'p-soto', qty: 4 },
      ],
    },
    {
      dropDay: -10,
      dueOffset: -6,
      warungId: 'w-kedai-tjoet',
      items: [
        { productId: 'p-ungkep', qty: 10 },
        { productId: 'p-soto', qty: 10 },
        { productId: 'p-ayam-bakar', qty: 5 },
      ],
      closedDay: -6,
      sold: { 'p-ungkep': 7, 'p-soto': 8, 'p-ayam-bakar': 4 },
      damaged: { 'p-soto': 0, 'p-ayam-bakar': 1 },
      payment: 50000,
      method: 'Transfer',
      schedulePayment: { amount: 20000, method: 'Transfer', day: -3 },
    },
    {
      dropDay: -20,
      dueOffset: 6,
      warungId: 'w-bu-sari',
      items: [
        { productId: 'p-rendang', qty: 6 },
        { productId: 'p-gulai', qty: 5 },
        { productId: 'p-opor', qty: 5 },
      ],
      closedDay: -14,
      sold: { 'p-rendang': 5, 'p-gulai': 4, 'p-opor': 3 },
      payment: 'full',
      method: 'Tunai',
    },
    {
      dropDay: -4,
      dueOffset: 0,
      warungId: 'w-kedai-tjoet',
      items: [
        { productId: 'p-ungkep', qty: 8 },
        { productId: 'p-soto', qty: 6 },
        { productId: 'p-balado', qty: 4 },
      ],
      closedDay: 0,
      sold: { 'p-ungkep': 6, 'p-soto': 5, 'p-balado': 3 },
      payment: 'full',
      method: 'QRIS',
    },
  ];

  for (const entry of consignments) {
    const dropDate = isoAtDay(entry.dropDay, 9, 0);
    const created = createConsignment(state, {
      warungId: entry.warungId,
      date: dropDate,
      dueDate: addDaysKey(todayKey(), entry.dueOffset),
      items: entry.items,
      note: '',
    });
    state = created.state;
    if (entry.closedDay !== undefined) {
      const counts = entry.items.map((item) => ({
        productId: item.productId,
        soldQty: entry.sold?.[item.productId] ?? 0,
        damagedQty: entry.damaged?.[item.productId] ?? 0,
      }));
      const total = entry.items.reduce(
        (amount, item) => amount + (entry.sold?.[item.productId] ?? 0) * (price.get(item.productId) ?? 0),
        0,
      );
      const paymentAmount = entry.payment === 'full' ? total : entry.payment ?? 0;
      const closed = closeConsignment(state, {
        id: created.consignment.id,
        date: isoAtDay(entry.closedDay, 17, 0),
        counts,
        paymentAmount,
        paymentMethod: entry.method ?? 'Tunai',
        note: 'Setoran titipan data contoh',
      });
      state = closed.state;
      if (entry.schedulePayment) {
        state = addPayment(state, {
          refType: 'consignment',
          refId: created.consignment.id,
          amount: entry.schedulePayment.amount,
          date: isoAtDay(entry.schedulePayment.day, 11, 0),
          method: entry.schedulePayment.method,
          note: 'Pelunasan susulan',
        });
      }
    }
  }

  const purchases = [
    {
      day: -22,
      supplier: 'Pasar Induk Caringin',
      items: [
        { name: 'Cabai merah', unit: 'kg', category: 'Bumbu', qty: 4, unitPrice: 42000 },
        { name: 'Bawang merah', unit: 'kg', category: 'Bumbu', qty: 5, unitPrice: 38000 },
        { name: 'Bawang putih', unit: 'kg', category: 'Bumbu', qty: 3, unitPrice: 40000 },
      ],
    },
    {
      day: -18,
      supplier: 'Toko Sembako Mak Ijah',
      items: [
        { name: 'Santan kelapa', unit: 'pack', category: 'Santan & Minyak', qty: 12, unitPrice: 15000 },
        { name: 'Minyak goreng', unit: 'liter', category: 'Santan & Minyak', qty: 8, unitPrice: 18000 },
        { name: 'Kelapa parut', unit: 'kg', category: 'Bumbu', qty: 6, unitPrice: 14000 },
      ],
    },
    {
      day: -13,
      supplier: 'Pasar Induk Caringin',
      items: [
        { name: 'Daging sapi', unit: 'kg', category: 'Protein', qty: 6, unitPrice: 132000 },
        { name: 'Ayam', unit: 'kg', category: 'Protein', qty: 9, unitPrice: 38000 },
      ],
    },
    {
      day: -8,
      supplier: 'Pasar Induk Caringin',
      items: [
        { name: 'Cabai merah', unit: 'kg', category: 'Bumbu', qty: 5, unitPrice: 45000 },
        { name: 'Jahe', unit: 'kg', category: 'Bumbu', qty: 2, unitPrice: 26000 },
        { name: 'Lengkuas', unit: 'kg', category: 'Bumbu', qty: 2, unitPrice: 18000 },
        { name: 'Daun jeruk', unit: 'kg', category: 'Bumbu', qty: 1, unitPrice: 32000 },
      ],
    },
    {
      day: -4,
      supplier: 'Toko Sembako Mak Ijah',
      items: [
        { name: 'Santan kelapa', unit: 'pack', category: 'Santan & Minyak', qty: 15, unitPrice: 15500 },
        { name: 'Minyak goreng', unit: 'liter', category: 'Santan & Minyak', qty: 6, unitPrice: 18500 },
      ],
    },
    {
      day: 0,
      supplier: 'Pasar Pagi',
      items: [
        { name: 'Daging sapi', unit: 'kg', category: 'Protein', qty: 4, unitPrice: 135000 },
        { name: 'Ayam', unit: 'kg', category: 'Protein', qty: 5, unitPrice: 39000 },
        { name: 'Cabai merah', unit: 'kg', category: 'Bumbu', qty: 2, unitPrice: 46000 },
      ],
    },
  ];
  for (const entry of purchases) {
    const result = createPurchase(state, {
      date: isoAtDay(entry.day, 7, 30),
      supplier: entry.supplier,
      items: entry.items,
      note: '',
    });
    state = result.state;
  }

  state = adjustProductStock(state, 'p-soto', 3, 'Stok tersisa setelah produksi hari ini', isoAtDay(0, 6, 0));
  state = adjustProductStock(state, 'p-ayam-bakar', 4, 'Stok tersisa setelah produksi hari ini', isoAtDay(0, 6, 0));
  state = adjustProductStock(state, 'p-balado', 6, 'Stok tersisa setelah produksi hari ini', isoAtDay(0, 6, 0));

  return state;
}

export function productByName(state: AppState, name: string): Product | undefined {
  return state.products.find((product) => product.name.toLowerCase() === name.toLowerCase());
}
