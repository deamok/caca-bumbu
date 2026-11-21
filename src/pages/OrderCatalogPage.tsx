import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Store,
  X,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { useDocumentTitle } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { BrandSymbol, EmptyBowl } from '../components/Brand';
import { Badge, Button, Field, Input, ProductMark, Sheet, Textarea } from '../components/ui';
import { useLocation } from '../lib/router';
import { decodeSharedCatalog, sharedCatalogToProducts } from '../lib/catalog';
import { formatMoney, normalizePhone, whatsappLink } from '../lib/format';
import { formatDate } from '../lib/date';
import type { Product } from '../types';

export function OrderCatalogPage() {
  useDocumentTitle('Pesan bumbu');
  const { state } = useStore();
  const { notify } = useToast();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [name, setName] = useState('');
  const [warung, setWarung] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const hasSharePayload = Boolean(location.query.get('d'));
  const shared = useMemo(() => decodeSharedCatalog(location.query.get('d')), [location.raw]);
  const isUnavailable = hasSharePayload ? !shared : !state.meta.onboarded;
  const catalogProducts = useMemo(
    () => (shared ? sharedCatalogToProducts(shared) : state.products.filter((product) => product.active)),
    [shared, state.products],
  );
  const sellerName = shared?.seller.name ?? state.settings.businessName;
  const sellerWhatsapp = shared?.seller.whatsapp ?? state.settings.whatsapp;
  const sellerAddress = shared?.seller.address ?? state.settings.address;
  const hasWhatsApp = Boolean(normalizePhone(sellerWhatsapp));

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalogProducts.filter((product) => !term || product.name.toLowerCase().includes(term));
  }, [catalogProducts, search]);
  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, qty]) => {
          const product = catalogProducts.find((item) => item.id === productId);
          return product && qty > 0 ? { product, qty } : null;
        })
        .filter((line): line is { product: Product; qty: number } => Boolean(line)),
    [cart, catalogProducts],
  );
  const qtyTotal = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = lines.reduce((sum, line) => sum + line.qty * line.product.price, 0);

  const setQty = (product: Product, next: number) => {
    const qty = Math.max(0, Math.min(product.stock, next));
    setCart((current) => {
      if (qty <= 0) {
        const copy = { ...current };
        delete copy[product.id];
        return copy;
      }
      return { ...current, [product.id]: qty };
    });
  };

  const buildMessage = () => {
    const rows = lines.map((line) => `• ${line.qty} × ${line.product.name} — ${formatMoney(line.qty * line.product.price)}`).join('\n');
    return [
      `Halo ${sellerName}, saya mau pesan bumbu:`,
      '',
      rows,
      '',
      `Total: ${formatMoney(total)}`,
      `Nama: ${name.trim()}`,
      warung.trim() ? `Warung: ${warung.trim()}` : '',
      phone.trim() ? `No. HP: ${phone.trim()}` : '',
      address.trim() ? `Alamat: ${address.trim()}` : '',
      note.trim() ? `Catatan: ${note.trim()}` : '',
      '',
      'Terima kasih!',
    ].filter((line, index, array) => line !== '' || (index > 0 && array[index - 1] !== '')).join('\n');
  };

  const sendOrder = () => {
    setError('');
    if (!name.trim()) {
      setError('Isi nama pemesan dulu ya.');
      return;
    }
    if (!hasWhatsApp) {
      setError('Penjual belum mengatur nomor WhatsApp.');
      return;
    }
    const url = whatsappLink(sellerWhatsapp, buildMessage());
    window.open(url, '_blank', 'noopener,noreferrer');
    setCheckoutOpen(false);
    notify('Pesanan siap dikirim', { message: 'Periksa pesan di WhatsApp lalu tekan kirim.' });
  };

  if (isUnavailable) {
    return <CatalogUnavailable invalid={hasSharePayload} />;
  }

  return (
    <div className="catalog-page">
      <header className="catalog-top">
        <div className="catalog-top__brand">
          <BrandSymbol size={38} />
          <div>
            <strong>{sellerName}</strong>
            <span>Bumbu rumahan · pesan langsung</span>
          </div>
        </div>
        {hasWhatsApp ? (
          <a className="catalog-top__wa" href={whatsappLink(sellerWhatsapp, `Halo ${sellerName}, saya mau tanya-tanya bumbu.`)} target="_blank" rel="noreferrer">
            <Send size={15} /> Tanya penjual
          </a>
        ) : null}
      </header>

      <main className="catalog-main">
        <section className="catalog-hero">
          <div className="catalog-hero__text">
            <span className="eyebrow">Katalog untuk warung</span>
            <h1>Bumbu siap masak,<br /><em>tinggal pilih.</em></h1>
            <p>Pilih jenis dan jumlah bumbu, lalu kirim pesanan ke WhatsApp penjual. Mudah, tanpa perlu install aplikasi.</p>
            <div className="catalog-hero__meta">
              <span><Package size={15} /> {catalogProducts.length} jenis bumbu</span>
              <span><Store size={15} /> Harga per pack</span>
              {shared ? <span>Diperbarui {formatDate(shared.updatedAt)}</span> : <span>Pratinjau dari HP ini</span>}
            </div>
          </div>
          <div className="catalog-hero__art" aria-hidden="true">
            <div className="catalog-hero__sun" />
            <div className="catalog-hero__bowl"><EmptyBowl size={95} /></div>
            <span className="catalog-hero__tag">Dibuat segar<br />dari dapur</span>
          </div>
        </section>

        {!hasWhatsApp ? (
          <div className="catalog-offline-note">
            <Package size={18} />
            <p>Pemesanan WhatsApp belum aktif. Silakan hubungi penjual langsung.</p>
          </div>
        ) : null}

        <div className="catalog-toolbar">
          <div className="catalog-search">
            <Search size={18} />
            <input type="search" placeholder="Cari bumbu favorit…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Cari bumbu" />
            {search ? <button type="button" onClick={() => setSearch('')} aria-label="Hapus pencarian"><X size={16} /></button> : null}
          </div>
          <span>{products.length} pilihan</span>
        </div>

        {products.length ? (
          <div className="catalog-grid">
            {products.map((product) => {
              const qty = cart[product.id] ?? 0;
              const soldOut = product.stock <= 0;
              return (
                <article className={`catalog-product ${qty ? 'is-selected' : ''} ${soldOut ? 'is-soldout' : ''}`} key={product.id}>
                  <div className={`catalog-product__art tone-bg--${product.tone}`}>
                    <ProductMark name={product.name} tone={product.tone} size="lg" />
                    {soldOut ? <Badge tone="red">Habis</Badge> : <span className="catalog-product__fresh">Buatan sendiri</span>}
                  </div>
                  <div className="catalog-product__body">
                    <div>
                      <h2>{product.name}</h2>
                      <span>{formatMoney(product.price)} <small>/ {product.unit}</small></span>
                    </div>
                    {qty ? (
                      <div className="catalog-stepper">
                        <button type="button" onClick={() => setQty(product, qty - 1)} aria-label={`Kurangi ${product.name}`}><Minus size={15} /></button>
                        <strong>{qty}</strong>
                        <button type="button" onClick={() => setQty(product, qty + 1)} disabled={qty >= product.stock} aria-label={`Tambah ${product.name}`}><Plus size={15} /></button>
                      </div>
                    ) : (
                      <button type="button" className="catalog-add" disabled={soldOut} onClick={() => setQty(product, 1)}>
                        <Plus size={17} /> <span>Tambah</span>
                      </button>
                    )}
                  </div>
                  {!soldOut ? <span className="catalog-product__stock">Sisa {product.stock} pack</span> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="catalog-empty">
            <EmptyBowl size={52} />
            <h2>Bumbu tidak ditemukan</h2>
            <p>Coba kata kunci lain, atau lihat semua pilihan.</p>
            <Button variant="secondary" size="sm" onClick={() => setSearch('')}>Lihat semua</Button>
          </div>
        )}

        <section className="catalog-note">
          <div><CheckCircle2 size={18} /><span>Bumbu dibuat sendiri dalam batch kecil.</span></div>
          <div><ShoppingBag size={18} /><span>Pesanan dikonfirmasi penjual lewat WhatsApp.</span></div>
          <div><Store size={18} /><span>Stok mengikuti link terakhir yang dibagikan.</span></div>
        </section>
      </main>

      <footer className="catalog-footer">
        <BrandSymbol size={26} />
        <span>{sellerName} · bumbu rumahan</span>
        {sellerAddress ? <small>{sellerAddress}</small> : null}
      </footer>

      {qtyTotal ? (
        <div className="catalog-cart">
          <div>
            <span>{qtyTotal} pack</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <Button variant="gold" onClick={() => setCheckoutOpen(true)} icon={<ShoppingBag size={17} />}>Pesan sekarang</Button>
        </div>
      ) : null}

      <Sheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Kirim pesanan"
        description={`${qtyTotal} pack · ${formatMoney(total)}`}
        footer={<Button full size="lg" onClick={sendOrder} icon={<Send size={17} />}>Kirim lewat WhatsApp</Button>}
      >
        <div className="catalog-checkout">
          <div className="catalog-checkout__items">
            {lines.map(({ product, qty }) => (
              <div key={product.id}><span>{qty}× {product.name}</span><strong>{formatMoney(qty * product.price)}</strong></div>
            ))}
            <div className="catalog-checkout__total"><span>Total</span><strong>{formatMoney(total)}</strong></div>
          </div>
          <div className="form-grid form-grid--2">
            <Field label="Nama pemesan" htmlFor="catalog-name">
              <Input id="catalog-name" value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Nama Ibu / Bapak" />
            </Field>
            <Field label="Nama warung" optional htmlFor="catalog-warung">
              <Input id="catalog-warung" value={warung} onChange={(event) => setWarung(event.target.value)} placeholder="Warung Ibu Sari" />
            </Field>
          </div>
          <Field label="Nomor HP" optional htmlFor="catalog-phone">
            <Input id="catalog-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xx…" />
          </Field>
          <Field label="Alamat / patokan" optional htmlFor="catalog-address">
            <Input id="catalog-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Contoh: Jl. Melati No. 8" />
          </Field>
          <Field label="Catatan pesanan" optional htmlFor="catalog-note">
            <Textarea id="catalog-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: minta diantar besok pagi" />
          </Field>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <p className="catalog-checkout__note">Pesanan belum tercatat sampai Ibu mengirim pesan WhatsApp ke penjual.</p>
        </div>
      </Sheet>
    </div>
  );
}

function CatalogUnavailable({ invalid }: { invalid: boolean }) {
  return (
    <div className="catalog-page catalog-unavailable">
      <header className="catalog-top">
        <div className="catalog-top__brand">
          <BrandSymbol size={38} />
          <div>
            <strong>Caca Bumbu</strong>
            <span>Katalog pesanan warung</span>
          </div>
        </div>
      </header>
      <main className="catalog-main">
        <div className="catalog-unavailable__card">
          <div className="catalog-unavailable__art"><EmptyBowl size={72} /></div>
          <span className="eyebrow">Katalog pesanan</span>
          <h1>{invalid ? 'Link katalog tidak tersedia' : 'Katalog belum dibagikan'}</h1>
          <p>
            {invalid
              ? 'Link ini tidak lengkap atau sudah rusak. Minta penjual mengirim ulang link katalog terbaru lewat WhatsApp.'
              : 'Minta link katalog terbaru langsung ke penjual. Setiap link berisi daftar bumbu, harga, dan nomor WhatsApp penjual.'}
          </p>
        </div>
      </main>
      <footer className="catalog-footer">
        <BrandSymbol size={26} />
        <span>Caca Bumbu · bumbu rumahan</span>
      </footer>
    </div>
  );
}
