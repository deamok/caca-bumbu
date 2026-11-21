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

describe('foto pada katalog publik', () => {
  it('membawa foto dari storage dan melewati data URL lokal', () => {
    const state = createDemoState();
    const photo = 'https://x.supabase.co/storage/v1/object/public/product-images/u/p.jpg?v=1';
    state.products[0].imageUrl = photo;
    state.products[1].imageUrl = 'data:image/jpeg;base64,AAAA';

    const catalog = makeSharedCatalog(state);
    expect(catalog.products[0].imageUrl).toBe(photo);
    expect(catalog.products[1]).not.toHaveProperty('imageUrl');

    const decoded = decodeSharedCatalog(encodeSharedCatalog(catalog));
    expect(decoded?.products[0].imageUrl).toBe(photo);

    const products = sharedCatalogToProducts(decoded!);
    expect(products[0].imageUrl).toBe(photo);
    expect(products[1].imageUrl).toBe('');
  });
});