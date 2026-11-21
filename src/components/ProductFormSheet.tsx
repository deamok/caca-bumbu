import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, Check, Sparkles, Trash2 } from 'lucide-react';
import type { Product, ProductTone } from '../types';
import { useStore } from '../store/StoreContext';
import { useAuth } from '../store/AuthContext';
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
import { deleteProductImage, saveProductImage } from '../lib/productImages';
import { uid } from '../lib/id';

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
  const { session } = useAuth();
  const { notify } = useToast();
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [hpp, setHpp] = useState(0);
  const [stock, setStock] = useState(0);
  const [unit, setUnit] = useState('pack');
  const [tone, setTone] = useState<ProductTone>('saffron');
  const [active, setActive] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? '');
    setPrice(product?.price ?? 0);
    setHpp(product?.hpp ?? 0);
    setStock(product?.stock ?? 0);
    setUnit(product?.unit ?? 'pack');
    setTone(product?.tone ?? 'saffron');
    setActive(product?.active ?? true);
    setImageUrl(product?.imageUrl ?? '');
    setPendingFile(null);
    setSaving(false);
    setError('');
  }, [open, product]);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const margin = price - hpp;
  const shownImage = previewUrl || imageUrl;

  const pickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Pilih file gambar (JPG atau PNG).');
      return;
    }
    setPendingFile(file);
    setError('');
  };

  const removePhoto = () => {
    setPendingFile(null);
    setImageUrl('');
  };

  const save = async () => {
    if (saving) return;
    if (!name.trim()) {
      setError('Nama bumbu wajib diisi.');
      return;
    }
    if (price <= 0) {
      setError('Harga jual harus lebih dari nol.');
      return;
    }

    setSaving(true);
    try {
      let finalImage = imageUrl;
      if (pendingFile) {
        finalImage = await saveProductImage({
          file: pendingFile,
          productId: product?.id ?? uid('prod'),
          userId: session?.user.id ?? null,
        });
      }

      if (product) {
        editProduct(product.id, {
          name: name.trim(),
          price,
          hpp,
          stock,
          unit: unit.trim() || 'pack',
          tone,
          active,
          imageUrl: finalImage,
        });
        if (imageUrl && imageUrl !== finalImage) void deleteProductImage(imageUrl);
        notify('Produk diperbarui', { message: name.trim() });
      } else {
        addProduct({
          name: name.trim(),
          price,
          hpp,
          stock,
          unit: unit.trim() || 'pack',
          tone,
          imageUrl: finalImage,
        });
        notify('Produk baru ditambahkan', { message: name.trim() });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Produk belum bisa disimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={product ? 'Edit bumbu' : 'Tambah bumbu'}
      description="Atur foto, harga, HPP, dan stok yang siap dijual."
      footer={
        <Button full size="lg" onClick={() => void save()} loading={saving} icon={<Check size={17} />}>
          {product ? 'Simpan perubahan' : 'Tambah bumbu'}
        </Button>
      }
    >
      <div className="product-form">
        <div className="product-form__preview">
          <ProductMark name={name || 'Bumbu'} tone={tone} size="lg" imageUrl={shownImage} />
          <div>
            <span className="eyebrow">Pratinjau produk</span>
            <h3>{name || 'Nama bumbu'}</h3>
            <p>{formatMoney(price)} / {unit || 'pack'} {hpp > 0 ? `· laba ${formatMoney(margin)}` : ''}</p>
          </div>
        </div>

        <div className="photo-field">
          <div className="photo-field__body">
            <strong>Foto bumbu</strong>
            <p>
              {shownImage
                ? 'Foto tampil di kasir, daftar produk, dan katalog warung.'
                : 'Tambahkan foto agar warung lebih mudah memilih. JPG/PNG, otomatis diperkecil.'}
            </p>
            {!session ? (
              <p className="photo-field__hint">Mode lokal: foto disimpan di HP ini. Masuk agar ikut tersinkron dan muncul di katalog.</p>
            ) : null}
          </div>
          <div className="photo-field__actions">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} icon={<Camera size={15} />}>
              {shownImage ? 'Ganti' : 'Pilih foto'}
            </Button>
            {shownImage ? (
              <Button size="sm" variant="ghost" onClick={removePhoto} icon={<Trash2 size={15} />}>
                Hapus
              </Button>
            ) : null}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
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
        <Field label="Warna kartu" hint="dipakai bila tanpa foto">
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
