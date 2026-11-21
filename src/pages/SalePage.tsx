import { useMemo, useState } from 'react';
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Package,
  Plus,
  QrCode,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Store,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { useLocation, navigate } from '../lib/router';
import { useToast } from '../components/Toast';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  ProductMark,
  SearchField,
  Select,
  Sheet,
  Stepper,
  Textarea,
} from '../components/ui';
import { EmptyBowl } from '../components/Brand';
import { formatMoney } from '../lib/format';
import type { PaymentMethod, Sale } from '../types';
import { formatDate, formatTime, nowISO } from '../lib/date';

type CheckoutMethod = PaymentMethod | 'Bon';

const METHODS: Array<{ value: CheckoutMethod; label: string; icon: typeof Banknote; hint: string }> = [
  { value: 'Tunai', label: 'Tunai', icon: Banknote, hint: 'Uang diterima sekarang' },
  { value: 'QRIS', label: 'QRIS', icon: QrCode, hint: 'Sudah dibayar' },
  { value: 'Transfer', label: 'Transfer', icon: CreditCard, hint: 'Sudah dibayar' },
  { value: 'Bon', label: 'Bon', icon: CalendarClock, hint: 'Catat sebagai piutang' },
];

interface Receipt {
  sale: Sale;
  method: CheckoutMethod;
  cash: number;
  buyerName: string;
}

export function SalePage() {
  const { state, sell } = useStore();
  const { notify } = useToast();
  const location = useLocation();
  const preselectedWarung = location.query.get('warung') ?? '';
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [buyerId, setBuyerId] = useState(preselectedWarung);
  const [buyerName, setBuyerName] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [method, setMethod] = useState<CheckoutMethod>('Tunai');
  const [cash, setCash] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const activeProducts = useMemo(() => state.products.filter((product) => product.active), [state.products]);
  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeProducts.filter((product) => !term || product.name.toLowerCase().includes(term));
  }, [activeProducts, search]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, qty]) => {
          const product = state.products.find((item) => item.id === productId);
          return product ? { product, qty } : null;
        })
        .filter((line): line is { product: (typeof activeProducts)[number]; qty: number } => Boolean(line && line.qty > 0)),
    [cart, state.products, activeProducts],
  );
  const totalQty = cartLines.reduce((sum, line) => sum + line.qty, 0);
  const total = cartLines.reduce((sum, line) => sum + line.qty * line.product.price, 0);
  const noStock = activeProducts.length > 0 && activeProducts.every((product) => product.stock === 0);
  const selectedWarung = state.warungs.find((warung) => warung.id === buyerId);
  const resolvedBuyerName = selectedWarung?.name || buyerName.trim() || 'Pembeli umum';
  const cashShortage = method === 'Tunai' ? Math.max(0, total - cash) : 0;
  const change = method === 'Tunai' ? Math.max(0, cash - total) : 0;

  const setQty = (productId: string, qty: number) => {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    if (qty > product.stock) {
      notify(`Stok ${product.name} tinggal ${product.stock} pack`, { tone: 'error' });
      return;
    }
    setCart((current) => {
      if (qty <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: qty };
    });
  };

  const openCheckout = () => {
    if (!cartLines.length) return;
    setError('');
    setCash(total);
    setCheckoutOpen(true);
  };

  const completeSale = () => {
    setError('');
    if (method === 'Tunai' && cash < total) {
      setError('Uang yang diterima masih kurang dari total belanja.');
      return;
    }
    if (method === 'Bon' && !selectedWarung && !buyerName.trim()) {
      setError('Nama pembeli wajib diisi untuk transaksi bon.');
      return;
    }
    try {
      const result = sell({
        items: cartLines.map((line) => ({ productId: line.product.id, qty: line.qty })),
        date: nowISO(),
        warungId: selectedWarung?.id ?? null,
        buyerName: resolvedBuyerName,
        paymentMethod: method,
        paidAmount: method === 'Bon' ? 0 : total,
        note,
      });
      setReceipt({ sale: result.sale, method, cash, buyerName: resolvedBuyerName });
      setCheckoutOpen(false);
      setCart({});
      setBuyerName('');
      setNote('');
      setMethod('Tunai');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Penjualan belum bisa disimpan.');
    }
  };

  const startNew = () => {
    setReceipt(null);
    setBuyerId(preselectedWarung);
  };

  return (
    <div className="sale-page">
      <PageHeader
        eyebrow="Kasir"
        title="Jual langsung"
        description="Pilih bumbu, lalu catat pembayaran dalam satu langkah."
        action={
          <Button variant="secondary" size="sm" icon={<Package size={15} />} onClick={() => navigate('/produk')}>
            Cek stok
          </Button>
        }
      />

      {noStock ? (
        <div className="setup-banner">
          <div className="setup-banner__icon"><Package size={21} /></div>
          <div>
            <strong>Semua stok masih kosong</strong>
            <p>Isi stok awal di menu Produk sebelum mencatat penjualan.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/produk')}>Atur stok</Button>
        </div>
      ) : null}

      <div className="sale-layout">
        <section className="sale-products">
          <div className="sale-toolbar">
            <SearchField value={search} onChange={setSearch} placeholder="Cari bumbu…" label="Cari bumbu" />
            <span className="sale-toolbar__count">{products.length} pilihan</span>
          </div>

          {products.length ? (
            <div className="product-picker-grid">
              {products.map((product) => {
                const qty = cart[product.id] ?? 0;
                const disabled = product.stock <= 0;
                return (
                  <div className={`product-pick ${qty > 0 ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} key={product.id}>
                    <div className="product-pick__top">
                      <ProductMark name={product.name} tone={product.tone} size="md" imageUrl={product.imageUrl} />
                      <div className="product-pick__title">
                        <h3>{product.name}</h3>
                        <span>{formatMoney(product.price)} <small>/ {product.unit}</small></span>
                      </div>
                    </div>
                    <div className="product-pick__bottom">
                      <span className={`stock-label ${product.stock <= state.settings.lowStockThreshold ? 'is-low' : ''}`}>
                        {disabled ? 'Stok habis' : `Stok ${product.stock}`}
                      </span>
                      {qty > 0 ? (
                        <Stepper value={qty} onChange={(next) => setQty(product.id, next)} min={0} max={product.stock} size="sm" label={product.name} />
                      ) : (
                        <button type="button" className="add-product-btn" onClick={() => setQty(product.id, 1)} disabled={disabled} aria-label={`Tambah ${product.name}`}>
                          <Plus size={17} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              illustration={<EmptyBowl size={52} />}
              title={search ? 'Bumbu tidak ditemukan' : 'Belum ada produk'}
              description={search ? 'Coba kata kunci lain atau tambah produk baru.' : 'Tambahkan bumbu pertama di menu Produk & stok.'}
              action={<Button variant="secondary" size="sm" onClick={() => navigate('/produk')}>Buka produk</Button>}
            />
          )}
        </section>

        <aside className={`sale-summary ${cartLines.length ? 'has-items' : ''}`}>
          <Card className="sale-summary__card">
            <div className="sale-summary__head">
              <div>
                <span className="card-kicker">Pesanan</span>
                <h2>{totalQty ? `${totalQty} pack` : 'Belum ada item'}</h2>
              </div>
              <span className="sale-summary__icon"><ShoppingCart size={20} /></span>
            </div>
            {cartLines.length ? (
              <>
                <div className="sale-cart-lines">
                  {cartLines.map(({ product, qty }) => (
                    <div className="sale-cart-line" key={product.id}>
                      <span className="sale-cart-line__qty">{qty}×</span>
                      <div>
                        <strong>{product.name}</strong>
                        <small>{formatMoney(product.price * qty)}</small>
                      </div>
                      <button type="button" onClick={() => setQty(product.id, 0)} aria-label={`Hapus ${product.name}`}>×</button>
                    </div>
                  ))}
                </div>
                <div className="sale-summary__totals">
                  <span>Total</span>
                  <strong>{formatMoney(total)}</strong>
                </div>
                <div className="sale-summary__buyer">
                  <UserRound size={15} />
                  <span>Pembeli: <strong>{selectedWarung?.name ?? 'Pembeli umum'}</strong></span>
                  <button type="button" onClick={openCheckout}>Ubah</button>
                </div>
                <Button full size="lg" onClick={openCheckout} icon={<Wallet size={18} />}>Lanjut bayar</Button>
              </>
            ) : (
              <EmptyState
                compact
                illustration={<ShoppingBag size={38} />}
                title="Keranjang masih kosong"
                description="Ketuk tombol + pada bumbu untuk mulai."
              />
            )}
          </Card>
          <div className="sale-summary__tip">
            <ReceiptText size={16} />
            <p>Pembeli bon akan otomatis tercatat di piutang warung.</p>
          </div>
        </aside>
      </div>

      {cartLines.length ? (
        <div className="cart-bar">
          <div>
            <span>{totalQty} pack</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <Button variant="gold" onClick={openCheckout} icon={<ShoppingCart size={17} />}>Bayar</Button>
        </div>
      ) : null}

      <Sheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Selesaikan pembayaran"
        description={`${totalQty} pack · ${formatMoney(total)}`}
        footer={
          <Button full size="lg" onClick={completeSale} icon={<CheckCircle2 size={18} />}>
            Simpan penjualan
          </Button>
        }
      >
        <div className="checkout">
          <div className="checkout__buyer">
            <Field label="Pembeli" htmlFor="buyer">
              <Select
                id="buyer"
                value={buyerId}
                onChange={(event) => {
                  setBuyerId(event.target.value);
                  setError('');
                }}
              >
                <option value="">Pembeli umum</option>
                {state.warungs.map((warung) => (
                  <option value={warung.id} key={warung.id}>{warung.name}</option>
                ))}
              </Select>
            </Field>
            {!selectedWarung ? (
              <Field label="Nama pembeli" optional htmlFor="buyer-name">
                <Input id="buyer-name" value={buyerName} onChange={(event) => setBuyerName(event.target.value)} placeholder="Contoh: Bu Nia" />
              </Field>
            ) : (
              <div className="checkout__warung-note">
                <Store size={15} />
                <span>{selectedWarung.owner ? `${selectedWarung.name} · ${selectedWarung.owner}` : selectedWarung.name}</span>
                <button type="button" onClick={() => navigate(`/warung/${selectedWarung.id}`)}>Detail</button>
              </div>
            )}
          </div>

          <div className="checkout__methods">
            <span className="field-label">Metode pembayaran</span>
            <div className="payment-methods">
              {METHODS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.value}
                    className={`payment-method ${method === item.value ? 'is-active' : ''}`}
                    onClick={() => { setMethod(item.value); setError(''); }}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="checkout__method-hint">{METHODS.find((item) => item.value === method)?.hint}</p>
          </div>

          <div className="checkout__amounts">
            <div className="checkout__line"><span>Total belanja</span><strong>{formatMoney(total)}</strong></div>
            {method === 'Tunai' ? (
              <>
                <Field label="Uang diterima" htmlFor="cash">
                  <div className="cash-input-row">
                    <Input
                      id="cash"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={cash}
                      onChange={(event) => setCash(Number(event.target.value) || 0)}
                    />
                    <Button variant="secondary" size="sm" onClick={() => setCash(total)}>Uang pas</Button>
                  </div>
                </Field>
                <div className={`checkout__change ${cashShortage ? 'is-short' : ''}`}>
                  <span>{cashShortage ? 'Kurang' : 'Kembalian'}</span>
                  <strong>{formatMoney(cashShortage || change)}</strong>
                </div>
              </>
            ) : null}
            {method === 'Bon' ? (
              <div className="checkout__bon-note">
                <CalendarClock size={16} />
                <span>Belum ada uang diterima. Transaksi ini masuk ke piutang {resolvedBuyerName}.</span>
              </div>
            ) : null}
          </div>

          <Field label="Catatan" optional htmlFor="sale-note">
            <Textarea id="sale-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: titip tambahan 2 pack" />
          </Field>

          {error ? <div className="form-error" role="alert">{error}</div> : null}
        </div>
      </Sheet>

      <Sheet
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title="Penjualan berhasil"
        footer={
          <div className="success-actions">
            <Button full variant="secondary" onClick={() => { setReceipt(null); navigate('/riwayat'); }}>Lihat riwayat</Button>
            <Button full onClick={startNew} icon={<Plus size={17} />}>Transaksi baru</Button>
          </div>
        }
      >
        {receipt ? (
          <div className="receipt-success">
            <div className="receipt-success__icon"><CheckCircle2 size={34} /></div>
            <span className="receipt-success__label">Total diterima</span>
            <strong className="receipt-success__value">{formatMoney(receipt.sale.total)}</strong>
            <Badge tone={receipt.method === 'Bon' ? 'gold' : 'green'}>{receipt.method === 'Bon' ? 'Masuk piutang' : `Lunas · ${receipt.method}`}</Badge>
            {receipt.method === 'Tunai' ? (
              <div className="receipt-success__change">
                <span>Uang diterima {formatMoney(receipt.cash)}</span>
                <strong>Kembalian {formatMoney(Math.max(0, receipt.cash - receipt.sale.total))}</strong>
              </div>
            ) : null}
            <div className="receipt-success__detail">
              <div><span>No. transaksi</span><strong>{receipt.sale.code}</strong></div>
              <div><span>Pembeli</span><strong>{receipt.buyerName}</strong></div>
              <div><span>Waktu</span><strong>{formatDate(receipt.sale.date)} · {formatTime(receipt.sale.date)}</strong></div>
              <div><span>Jumlah</span><strong>{receipt.sale.items.reduce((sum, item) => sum + item.qty, 0)} pack</strong></div>
            </div>
            <div className="receipt-success__items">
              {receipt.sale.items.map((item) => (
                <div key={item.productId}><span>{item.qty}× {item.name}</span><strong>{formatMoney(item.qty * item.price)}</strong></div>
              ))}
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
