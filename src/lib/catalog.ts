import type { AppState, Product, ProductTone } from '../types';

export interface PublicCatalogProduct {
  id: string;
  name: string;
  price: number;
  unit: string;
  tone: ProductTone;
  stock: number;
  /** Hanya URL http(s) yang dibawa; data URL lokal tidak ikut agar link tetap pendek. */
  imageUrl?: string;
}

export interface SharedCatalog {
  v: 1;
  seller: {
    name: string;
    whatsapp: string;
    address: string;
  };
  products: PublicCatalogProduct[];
  updatedAt: string;
}

export function makeSharedCatalog(state: AppState): SharedCatalog {
  return {
    v: 1,
    seller: {
      name: state.settings.businessName || 'Caca Bumbu',
      whatsapp: state.settings.whatsapp || '',
      address: state.settings.address || '',
    },
    products: state.products
      .filter((product) => product.active)
      .map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        tone: product.tone,
        stock: product.stock,
        ...(product.imageUrl && /^https?:\/\//i.test(product.imageUrl) ? { imageUrl: product.imageUrl } : {}),
      })),
    updatedAt: new Date().toISOString(),
  };
}

export function encodeSharedCatalog(catalog: SharedCatalog): string {
  const bytes = new TextEncoder().encode(JSON.stringify(catalog));
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isTone(value: unknown): value is ProductTone {
  return value === 'saffron' || value === 'chili' || value === 'leaf' || value === 'clay' || value === 'cocoa' || value === 'ocean';
}

function isSharedCatalog(value: unknown): value is SharedCatalog {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<SharedCatalog>;
  if (
    data.v !== 1 ||
    !data.seller ||
    typeof data.seller.name !== 'string' ||
    typeof data.seller.whatsapp !== 'string' ||
    typeof data.seller.address !== 'string' ||
    typeof data.updatedAt !== 'string'
  ) return false;
  if (!Array.isArray(data.products) || data.products.length > 200) return false;
  return data.products.every((product) => {
    if (!product || typeof product !== 'object') return false;
    const row = product as Partial<PublicCatalogProduct>;
    return (
      typeof row.id === 'string' &&
      typeof row.name === 'string' &&
      typeof row.price === 'number' &&
      Number.isFinite(row.price) &&
      row.price >= 0 &&
      typeof row.unit === 'string' &&
      typeof row.stock === 'number' &&
      Number.isFinite(row.stock) &&
      isTone(row.tone) &&
      (row.imageUrl === undefined || typeof row.imageUrl === 'string')
    );
  });
}

export function decodeSharedCatalog(value: string | null): SharedCatalog | null {
  if (!value) return null;
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isSharedCatalog(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function sharedCatalogUrl(state: AppState): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const path = typeof window === 'undefined' ? '/' : window.location.pathname;
  const payload = encodeSharedCatalog(makeSharedCatalog(state));
  return `${origin}${path}#/katalog?d=${payload}`;
}

export function sharedCatalogToProducts(catalog: SharedCatalog): Product[] {
  const timestamp = catalog.updatedAt;
  return catalog.products.map((product) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    hpp: 0,
    stock: Math.max(0, Math.floor(product.stock)),
    unit: product.unit,
    tone: product.tone,
    imageUrl: product.imageUrl ?? '',
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

