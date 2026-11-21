import { describe, expect, it } from 'vitest';
import { createInitialState, createDemoState } from '../data/seed';
import {
  decodeSharedCatalog,
  encodeSharedCatalog,
  makeSharedCatalog,
  sharedCatalogToProducts,
} from './catalog';

describe('katalog publik yang dibagikan', () => {
  it('mengemas dan membuka snapshot katalog tanpa data privat', () => {
    const state = createDemoState();
    state.settings.businessName = 'Dapur Caca';
    state.settings.whatsapp = '081234567890';
    const catalog = makeSharedCatalog(state);
    expect(catalog.products).toHaveLength(10);
    expect(catalog.products[0]).not.toHaveProperty('hpp');
    const encoded = encodeSharedCatalog(catalog);
    expect(encoded).not.toMatch(/[+/=]/);
    const decoded = decodeSharedCatalog(encoded);
    expect(decoded?.seller.name).toBe('Dapur Caca');
    expect(decoded?.seller.whatsapp).toBe('081234567890');
    expect(decoded?.products).toHaveLength(10);
    const products = sharedCatalogToProducts(decoded!);
    expect(products[0].name).toBe('Rendang');
    expect(products[0].active).toBe(true);
  });

  it('menolak payload kosong atau rusak', () => {
    expect(decodeSharedCatalog(null)).toBeNull();
    expect(decodeSharedCatalog('')).toBeNull();
    expect(decodeSharedCatalog('bukan-payload-valid')).toBeNull();
    const encoded = encodeSharedCatalog(makeSharedCatalog(createInitialState()));
    expect(decodeSharedCatalog(encoded + 'xx')).toBeNull();
  });
});
