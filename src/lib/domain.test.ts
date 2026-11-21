import { describe, expect, it } from 'vitest';
import type { AppState, Warung } from '../types';
import { createInitialState } from '../data/seed';
import {
  addPayment,
  closeConsignment,
  createConsignment,
  createPurchase,
  createSale,
  DomainError,
  outstandingFor,
  outstandingTotal,
  paymentTotal,
} from './domain';
import { summaryForRange, productPerformance, ingredientSpend } from './analytics';

const LOCAL_DATE = new Date(2026, 10, 20, 10, 0, 0).toISOString();
const CLOSE_DATE = new Date(2026, 10, 21, 16, 0, 0).toISOString();
const DUE_DATE = '2026-11-27';

function makeState(): AppState {
  const base = createInitialState();
  const warung: Warung = {
    id: 'w-test',
    name: 'Warung Test',
    owner: 'Test',
    phone: '0812',
    address: 'Jl. Test',
    notes: '',
    createdAt: LOCAL_DATE,
  };
  return {
    ...base,
    products: base.products.map((product) => ({ ...product, stock: 20, hpp: 2000 })),
    warungs: [warung],
    settings: { ...base.settings, lowStockThreshold: 5 },
    meta: { ...base.meta, onboarded: true },
  };
}

describe('penjualan langsung', () => {
  it('mengurangi stok, mencatat omzet, dan menyimpan pembayaran', () => {
    const state = makeState();
    const result = createSale(state, {
      date: LOCAL_DATE,
      warungId: 'w-test',
      items: [{ productId: 'p-rendang', qty: 2 }],
      paymentMethod: 'Tunai',
      paidAmount: 5000,
    });
    expect(result.sale.total).toBe(10000);
    expect(result.state.products.find((product) => product.id === 'p-rendang')?.stock).toBe(18);
    expect(paymentTotal(result.state, 'sale', result.sale.id)).toBe(5000);
    expect(outstandingFor(result.state, 'sale', result.sale.id)).toBe(5000);
    expect(result.state.stockMoves[0].qty).toBe(-2);
  });

  it('menolak stok yang tidak cukup', () => {
    const state = makeState();
    state.products = state.products.map((product) => ({ ...product, stock: 1 }));
    expect(() => createSale(state, {
      date: LOCAL_DATE,
      warungId: 'w-test',
      items: [{ productId: 'p-rendang', qty: 2 }],
      paymentMethod: 'Tunai',
      paidAmount: 10000,
    })).toThrow(DomainError);
  });

  it('mencatat bon dan melunasi piutang tanpa melebihi sisa', () => {
    const state = makeState();
    const result = createSale(state, {
      date: LOCAL_DATE,
      warungId: 'w-test',
      items: [{ productId: 'p-gulai', qty: 3 }],
      paymentMethod: 'Bon',
      paidAmount: 0,
    });
    expect(result.sale.total).toBe(18000);
    expect(outstandingTotal(result.state)).toBe(18000);
    const paid = addPayment(result.state, {
      refType: 'sale',
      refId: result.sale.id,
      amount: 18000,
      date: CLOSE_DATE,
      method: 'Transfer',
    });
    expect(outstandingFor(paid, 'sale', result.sale.id)).toBe(0);
    expect(() => addPayment(paid, {
      refType: 'sale',
      refId: result.sale.id,
      amount: 1,
      method: 'Tunai',
    })).toThrow('melebihi sisa tagihan');
  });
});

describe('titipan warung', () => {
  it('mengurangi stok saat dititipkan dan mengembalikan sisa saat dihitung', () => {
    const state = makeState();
    const created = createConsignment(state, {
      warungId: 'w-test',
      date: LOCAL_DATE,
      dueDate: DUE_DATE,
      items: [{ productId: 'p-rendang', qty: 5 }],
    });
    expect(created.state.products.find((product) => product.id === 'p-rendang')?.stock).toBe(15);
    expect(created.consignment.status).toBe('aktif');
    expect(created.consignment.items[0].sentQty).toBe(5);

    const closed = closeConsignment(created.state, {
      id: created.consignment.id,
      date: CLOSE_DATE,
      counts: [{ productId: 'p-rendang', soldQty: 3, damagedQty: 1 }],
      paymentAmount: 15000,
      paymentMethod: 'Tunai',
    });
    const item = closed.consignment.items[0];
    expect(item.returnedQty).toBe(1);
    expect(item.soldQty).toBe(3);
    expect(item.damagedQty).toBe(1);
    expect(closed.consignment.status).toBe('selesai');
    expect(closed.state.products.find((product) => product.id === 'p-rendang')?.stock).toBe(16);
    expect(paymentTotal(closed.state, 'consignment', created.consignment.id)).toBe(15000);
    expect(outstandingFor(closed.state, 'consignment', created.consignment.id)).toBe(0);
  });

  it('membuat titipan baru dalam satu kali kunjungan', () => {
    const state = makeState();
    const created = createConsignment(state, {
      warungId: 'w-test',
      date: LOCAL_DATE,
      dueDate: DUE_DATE,
      items: [{ productId: 'p-opor', qty: 4 }],
    });
    const settled = closeConsignment(created.state, {
      id: created.consignment.id,
      date: CLOSE_DATE,
      counts: [{ productId: 'p-opor', soldQty: 2, damagedQty: 0 }],
      paymentAmount: 10000,
      paymentMethod: 'QRIS',
      nextDrop: {
        dueDate: '2026-12-04',
        items: [{ productId: 'p-opor', qty: 3 }],
      },
    });
    expect(settled.nextConsignment).toBeTruthy();
    expect(settled.nextConsignment?.status).toBe('aktif');
    expect(settled.state.consignments.filter((item) => item.status === 'aktif')).toHaveLength(1);
    expect(settled.state.products.find((product) => product.id === 'p-opor')?.stock).toBe(15);
  });

  it('menolak jumlah laku dan rusak melebihi titipan', () => {
    const state = makeState();
    const created = createConsignment(state, {
      warungId: 'w-test',
      date: LOCAL_DATE,
      dueDate: DUE_DATE,
      items: [{ productId: 'p-soto', qty: 2 }],
    });
    expect(() => closeConsignment(created.state, {
      id: created.consignment.id,
      date: CLOSE_DATE,
      counts: [{ productId: 'p-soto', soldQty: 2, damagedQty: 1 }],
      paymentAmount: 0,
      paymentMethod: 'Tunai',
    })).toThrow('melebihi jumlah titipan');
  });
});

describe('pembelian bahan dan analisa', () => {
  it('mencatat belanja, membuat bahan, dan menghitung total', () => {
    const state = makeState();
    const purchase = createPurchase(state, {
      date: LOCAL_DATE,
      supplier: 'Pasar',
      items: [{ name: 'Cabai merah', unit: 'kg', category: 'Bumbu', qty: 3, unitPrice: 45000, total: 135000 }],
    });
    expect(purchase.purchase.total).toBe(135000);
    expect(purchase.state.ingredients).toHaveLength(1);
    expect(purchase.purchase.items[0].unitPrice).toBe(45000);
    const again = createPurchase(purchase.state, {
      date: CLOSE_DATE,
      items: [{ name: 'cabai merah', unit: 'kg', category: 'Bumbu', qty: 1, unitPrice: 50000 }],
    });
    expect(again.state.ingredients).toHaveLength(1);
    expect(again.purchase.total).toBe(50000);
  });

  it('menggabungkan omzet jual dan titipan pada analisa', () => {
    const state = makeState();
    const sale = createSale(state, {
      date: LOCAL_DATE,
      warungId: 'w-test',
      items: [{ productId: 'p-rendang', qty: 2 }],
      paymentMethod: 'Tunai',
      paidAmount: 10000,
    });
    const created = createConsignment(sale.state, {
      warungId: 'w-test',
      date: LOCAL_DATE,
      dueDate: DUE_DATE,
      items: [{ productId: 'p-gulai', qty: 3 }],
    });
    const settled = closeConsignment(created.state, {
      id: created.consignment.id,
      date: CLOSE_DATE,
      counts: [{ productId: 'p-gulai', soldQty: 2, damagedQty: 0 }],
      paymentAmount: 12000,
      paymentMethod: 'Tunai',
    });
    const summary = summaryForRange(settled.state, '2026-11-20', '2026-11-21');
    expect(summary.revenue).toBe(22000);
    expect(summary.directRevenue).toBe(10000);
    expect(summary.consignmentRevenue).toBe(12000);
    expect(summary.qty).toBe(4);
    expect(summary.profit).toBe(14000);
    const products = productPerformance(settled.state, '2026-11-20', '2026-11-21');
    expect(products).toHaveLength(2);
    const ingredients = ingredientSpend(settled.state, '2026-11-01', '2026-11-30');
    expect(ingredients).toHaveLength(0);
  });
});
