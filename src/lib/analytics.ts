import type { AppState, PeriodKey, Product, RevenueLine } from '../types';
import {
  addDaysKey,
  dateKey,
  lastNDays,
  periodRange,
  startOfMonthKey,
  todayKey,
} from './date';
import {
  activeConsignments,
  consignmentTotal,
  outstandingInvoices,
  outstandingTotal,
  saleTotal,
} from './domain';

export type { RevenueLine };

export function revenueLines(state: AppState, from: string, to: string): RevenueLine[] {
  const lines: RevenueLine[] = [];
  for (const sale of state.sales) {
    const key = dateKey(sale.date);
    if (key < from || key > to) continue;
    lines.push({
      date: sale.date,
      key,
      revenue: saleTotal(sale),
      qty: sale.items.reduce((sum, item) => sum + item.qty, 0),
      source: 'sale',
      refId: sale.id,
      code: sale.code,
    });
  }
  for (const consignment of state.consignments) {
    if (consignment.status !== 'selesai' || !consignment.closedAt) continue;
    const key = dateKey(consignment.closedAt);
    if (key < from || key > to) continue;
    const total = consignmentTotal(consignment);
    if (total <= 0) continue;
    lines.push({
      date: consignment.closedAt,
      key,
      revenue: total,
      qty: consignment.items.reduce((sum, item) => sum + item.soldQty, 0),
      source: 'consignment',
      refId: consignment.id,
      code: consignment.code,
    });
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date));
}

export interface Summary {
  revenue: number;
  directRevenue: number;
  consignmentRevenue: number;
  qty: number;
  transactions: number;
  average: number;
  profit: number;
  hppQty: number;
  previousRevenue: number;
  growth: number;
  purchases: number;
  receivable: number;
  activeConsignments: number;
}

function periodPurchases(state: AppState, from: string, to: string): number {
  return state.purchases
    .filter((purchase) => {
      const key = dateKey(purchase.date);
      return key >= from && key <= to;
    })
    .reduce((sum, purchase) => sum + purchase.total, 0);
}

function hppTotal(state: AppState, from: string, to: string): { cost: number; qty: number } {
  const products = new Map(state.products.map((product) => [product.id, product]));
  let cost = 0;
  let qty = 0;
  for (const sale of state.sales) {
    const key = dateKey(sale.date);
    if (key < from || key > to) continue;
    for (const item of sale.items) {
      const product = products.get(item.productId);
      if (product?.hpp) {
        cost += product.hpp * item.qty;
        qty += item.qty;
      }
    }
  }
  for (const consignment of state.consignments) {
    if (consignment.status !== 'selesai' || !consignment.closedAt) continue;
    const key = dateKey(consignment.closedAt);
    if (key < from || key > to) continue;
    for (const item of consignment.items) {
      const product = products.get(item.productId);
      if (product?.hpp && item.soldQty > 0) {
        cost += product.hpp * item.soldQty;
        qty += item.soldQty;
      }
    }
  }
  return { cost, qty };
}

export function summaryForPeriod(state: AppState, period: PeriodKey): Summary {
  const range = periodRange(period);
  return summaryForRange(state, range.from, range.to);
}

export function summaryForRange(state: AppState, from: string, to: string): Summary {
  const lines = revenueLines(state, from, to);
  const revenue = lines.reduce((sum, line) => sum + line.revenue, 0);
  const directRevenue = lines.filter((line) => line.source === 'sale').reduce((sum, line) => sum + line.revenue, 0);
  const consignmentRevenue = revenue - directRevenue;
  const qty = lines.reduce((sum, line) => sum + line.qty, 0);
  const transactions = lines.length;
  const totalDays = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1);
  const previousTo = addDaysKey(from, -1);
  const previousFrom = addDaysKey(previousTo, -(totalDays - 1));
  const previousRevenue = revenueLines(state, previousFrom, previousTo).reduce((sum, line) => sum + line.revenue, 0);
  const growth = previousRevenue ? Math.round(((revenue - previousRevenue) / previousRevenue) * 100) : revenue > 0 ? 100 : 0;
  const { cost } = hppTotal(state, from, to);
  const purchases = periodPurchases(state, from, to);
  return {
    revenue,
    directRevenue,
    consignmentRevenue,
    qty,
    transactions,
    average: transactions ? Math.round(revenue / transactions) : 0,
    profit: revenue - cost,
    hppQty: cost,
    previousRevenue,
    growth,
    purchases,
    receivable: outstandingTotal(state),
    activeConsignments: activeConsignments(state).length,
  };
}

export function todaySummary(state: AppState) {
  const today = todayKey();
  const todayRevenue = revenueLines(state, today, today).reduce((sum, line) => sum + line.revenue, 0);
  const yesterday = addDaysKey(today, -1);
  const yesterdayRevenue = revenueLines(state, yesterday, yesterday).reduce((sum, line) => sum + line.revenue, 0);
  const growth = yesterdayRevenue ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : todayRevenue > 0 ? 100 : 0;
  const transactions =
    state.sales.filter((sale) => dateKey(sale.date) === today).length +
    state.consignments.filter((consignment) => consignment.closedAt && dateKey(consignment.closedAt) === today).length;
  return { revenue: todayRevenue, yesterdayRevenue, growth, transactions };
}

export interface DailyPoint {
  key: string;
  revenue: number;
  qty: number;
  transactions: number;
}

export function dailySeries(state: AppState, days: number): DailyPoint[] {
  const keys = lastNDays(days);
  const map = new Map(keys.map((key) => [key, { key, revenue: 0, qty: 0, transactions: 0 }]));
  const lines = revenueLines(state, keys[0], keys[keys.length - 1]);
  for (const line of lines) {
    const point = map.get(line.key);
    if (!point) continue;
    point.revenue += line.revenue;
    point.qty += line.qty;
    point.transactions += 1;
  }
  return Array.from(map.values());
}

export interface ProductPerformance {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
  tone: Product['tone'];
  imageUrl?: string;
}

export function productPerformance(state: AppState, from: string, to: string): ProductPerformance[] {
  const products = new Map(state.products.map((product) => [product.id, product]));
  const map = new Map<string, ProductPerformance>();
  function addItem(productId: string, name: string, qty: number, revenue: number) {
    const existing = map.get(productId) ?? {
      productId,
      name,
      qty: 0,
      revenue: 0,
      tone: products.get(productId)?.tone ?? 'saffron',
      imageUrl: products.get(productId)?.imageUrl,
    };
    existing.qty += qty;
    existing.revenue += revenue;
    map.set(productId, existing);
  }
  for (const sale of state.sales) {
    const key = dateKey(sale.date);
    if (key < from || key > to) continue;
    for (const item of sale.items) addItem(item.productId, item.name, item.qty, item.qty * item.price);
  }
  for (const consignment of state.consignments) {
    if (consignment.status !== 'selesai' || !consignment.closedAt) continue;
    const key = dateKey(consignment.closedAt);
    if (key < from || key > to) continue;
    for (const item of consignment.items) addItem(item.productId, item.name, item.soldQty, item.soldQty * item.price);
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || b.qty - a.qty);
}

export function salesMix(state: AppState, period: PeriodKey) {
  const { from, to } = periodRange(period);
  const summary = summaryForRange(state, from, to);
  return {
    direct: summary.directRevenue,
    consignment: summary.consignmentRevenue,
    total: summary.revenue,
  };
}

export interface IngredientSpend {
  ingredientId: string;
  name: string;
  unit: string;
  category: string;
  qty: number;
  total: number;
  lastPrice: number;
  lastDate: string;
  purchases: number;
}

export function ingredientSpend(state: AppState, from: string, to: string): IngredientSpend[] {
  const map = new Map<string, IngredientSpend>();
  for (const purchase of state.purchases) {
    const key = dateKey(purchase.date);
    if (key < from || key > to) continue;
    for (const item of purchase.items) {
      const ingredient = state.ingredients.find((entry) => entry.id === item.ingredientId);
      const existing = map.get(item.ingredientId) ?? {
        ingredientId: item.ingredientId,
        name: item.name,
        unit: item.unit,
        category: ingredient?.category ?? 'Bumbu',
        qty: 0,
        total: 0,
        lastPrice: item.unitPrice,
        lastDate: purchase.date,
        purchases: 0,
      };
      existing.qty += item.qty;
      existing.total += item.total;
      existing.purchases += 1;
      if (purchase.date >= existing.lastDate) {
        existing.lastDate = purchase.date;
        existing.lastPrice = item.unitPrice;
      }
      map.set(item.ingredientId, existing);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function purchaseSeries(state: AppState, days: number): Array<{ key: string; total: number }> {
  const keys = lastNDays(days);
  const map = new Map(keys.map((key) => [key, 0]));
  for (const purchase of state.purchases) {
    const key = dateKey(purchase.date);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + purchase.total);
  }
  return keys.map((key) => ({ key, total: map.get(key) ?? 0 }));
}

export function purchaseSummary(state: AppState) {
  const monthFrom = startOfMonthKey();
  const today = todayKey();
  const thisMonth = state.purchases
    .filter((purchase) => {
      const key = dateKey(purchase.date);
      return key >= monthFrom && key <= today;
    })
    .reduce((sum, purchase) => sum + purchase.total, 0);
  const now = new Date();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const previousFrom = dateKey(previousMonthStart);
  const previousTo = dateKey(previousMonthEnd);
  const lastMonth = state.purchases
    .filter((purchase) => {
      const key = dateKey(purchase.date);
      return key >= previousFrom && key <= previousTo;
    })
    .reduce((sum, purchase) => sum + purchase.total, 0);
  return {
    thisMonth,
    lastMonth,
    growth: lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : thisMonth > 0 ? 100 : 0,
    count: state.purchases.filter((purchase) => {
      const key = dateKey(purchase.date);
      return key >= monthFrom && key <= today;
    }).length,
  };
}

export interface WarungMetrics {
  totalSpend: number;
  outstanding: number;
  active: number;
  lastActivity: string | null;
  salesCount: number;
}

export function warungMetrics(state: AppState, warungId: string): WarungMetrics {
  const invoices = outstandingInvoices(state).filter((invoice) => invoice.warungId === warungId);
  const outstanding = invoices.reduce((sum, invoice) => sum + invoice.outstanding, 0);
  const sales = state.sales.filter((sale) => sale.warungId === warungId);
  const closed = state.consignments.filter((consignment) => consignment.warungId === warungId && consignment.status === 'selesai');
  const active = state.consignments.filter((consignment) => consignment.warungId === warungId && consignment.status === 'aktif');
  const dates = [
    ...sales.map((sale) => sale.date),
    ...state.consignments.filter((consignment) => consignment.warungId === warungId).map((consignment) => consignment.closedAt ?? consignment.date),
  ].sort();
  const totalSpend =
    sales.reduce((sum, sale) => sum + saleTotal(sale), 0) +
    closed.reduce((sum, consignment) => sum + consignmentTotal(consignment), 0);
  return {
    totalSpend,
    outstanding,
    active: active.length,
    lastActivity: dates.length ? dates[dates.length - 1] : null,
    salesCount: sales.length + closed.length,
  };
}

export function inventoryTurnover(state: AppState): number {
  const soldQty = revenueLines(state, addDaysKey(todayKey(), -29), todayKey()).reduce((sum, line) => sum + line.qty, 0);
  return Math.round(soldQty / 30);
}

export function periodLabel(period: PeriodKey): string {
  return periodRange(period).label;
}
