import { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import type { Product, ProductTone } from '../types';
import { useStore } from '../store/StoreContext';
import { useToast } from './Toast';
import {
  Button,
  Field,
  Input,
  ProductMark,
  Sheet,
  Toggle,
} from './ui';
import { formatMoney } from '../lib/format';

const TONES: Array<{ value: ProductTone; label: string }> = [
  { value: 'chili', label: 'Merah cabai' },
  { value: 'saffron', label: 'Kuning kunyit' },
  { value: 'leaf', label: 'Hijau daun' },
  { value: 'clay', label: 'Cokelat tanah' },
  { value: 'cocoa', label: 'Cokelat tua' },
  { value: 'ocean', label: 'Biru rempah' },
];

export function ProductFormSheet({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product?: Product;
}) {
  const { addProduct, editProduct } = useStore();
  const { notify } = useToast();
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [hpp, setHpp] = useState(0);
  const [stock, setStock] = useState(0);
  const [unit, setUnit] = useState('pack');
  const [tone, setTone] = useState<ProductTone>('saffron');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? '');
    setPrice(product?.price ?? 0);
    setHpp(product?.hpp ?? 0);
    setStock(product?.stock ?? 0);
    setUnit(product?.unit ?? 'pack');
    setTone(product?.tone ?? 'saffron');
    setActive(product?.active ?? true);
    setError('');
  }, [open, product]);

  const margin = price - hpp;

  const save = () => {
    if (!name.trim()) {
      setError('Nama bumbu wajib diisi.');
      return;
    }
    if (price <= 0) {
      setError('Harga jual harus lebih dari nol.');
      return;
    }
    try {
      if (product) {
        editProduct(product.id, { name: name.trim(), price, hpp, stock, unit: unit.trim() || 'pack', tone, active });
        notify('Produk diperbarui', { message: name.trim() });
      } else {
        addProduct({ name: name.trim(), price, hpp, stock, unit: unit.trim() || 'pack', tone });
        notify('Produk baru ditambahkan', { message: name.trim() });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Produk belum bisa disimpan.');
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={product ? 'Edit bumbu' : 'Tambah bumbu'}
      description="Atur harga, HPP, dan stok yang siap dijual."
      footer={<Button full size="lg" onClick={save} icon={<Check size={17} />}>{product ? 'Simpan perubahan' : 'Tambah bumbu'}</Button>}
    >
      <div className="product-form">
        <div className="product-form__preview">
          <ProductMark name={name || 'Bumbu'} tone={tone} size="lg" />
          <div>
            <span className="eyebrow">Pratinjau produk</span>
            <h3>{name || 'Nama bumbu'}</h3>
            <p>{formatMoney(price)} / {unit || 'pack'} {hpp > 0 ? `· laba ${formatMoney(margin)}` : ''}</p>
          </div>
        </div>
        <Field label="Nama bumbu" htmlFor="product-name">
          <Input id="product-name" value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Contoh: Rendang" autoFocus />
        </Field>
        <div className="form-grid form-grid--2">
          <Field label="Harga jual" htmlFor="product-price" hint="per pack">
            <div className="input-prefix"><span>Rp</span><input id="product-price" type="number" inputMode="numeric" min={0} value={price} onChange={(event) => setPrice(Number(event.target.value) || 0)} /></div>
          </Field>
          <Field label="HPP" optional htmlFor="product-hpp" hint="untuk hitung laba">
            <div className="input-prefix"><span>Rp</span><input id="product-hpp" type="number" inputMode="numeric" min={0} value={hpp} onChange={(event) => setHpp(Number(event.target.value) || 0)} /></div>
          </Field>
        </div>
        <div className="form-grid form-grid--2">
          <Field label={product ? 'Stok saat ini' : 'Stok awal'} htmlFor="product-stock">
            <Input id="product-stock" type="number" inputMode="numeric" min={0} value={stock} onChange={(event) => setStock(Math.max(0, Number(event.target.value) || 0))} />
          </Field>
          <Field label="Satuan" htmlFor="product-unit">
            <Input id="product-unit" value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="pack" />
          </Field>
        </div>
        {product ? (
          <p className="form-note"><Sparkles size={14} /> Perubahan stok otomatis dicatat sebagai penyesuaian stok.</p>
        ) : null}
        <Field label="Warna kartu">
          <div className="tone-picker">
            {TONES.map((item) => (
              <button type="button" key={item.value} aria-label={item.label} className={`tone-dot tone-dot--${item.value} ${tone === item.value ? 'is-active' : ''}`} onClick={() => setTone(item.value)}>
                {tone === item.value ? <Check size={14} /> : null}
              </button>
            ))}
          </div>
        </Field>
        {margin > 0 && price > 0 ? (
          <div className="margin-preview">
            <span>Estimasi laba kotor per {unit || 'pack'}</span>
            <strong>{formatMoney(margin)} <small>({Math.round((margin / price) * 100)}%)</small></strong>
          </div>
        ) : null}
        {product ? (
          <Toggle
            checked={active}
            onChange={setActive}
            label="Produk aktif dijual"
            description="Produk nonaktif tidak muncul di kasir dan katalog."
          />
        ) : null}
        {error ? <div className="form-error" role="alert">{error}</div> : null}
      </div>
    </Sheet>
  );
}
