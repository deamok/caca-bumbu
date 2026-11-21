import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  MapPin,
  PackageCheck,
  Plus,
  Store,
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
  Stepper,
  Textarea,
} from '../components/ui';
import { EmptyBowl } from '../components/Brand';
import { addDaysKey, isoFromDateKey, todayKey } from '../lib/date';
import { formatMoney } from '../lib/format';

export function NewConsignmentPage() {
  const { state, addConsignment } = useStore();
  const { notify } = useToast();
  const location = useLocation();
  const preselected = location.query.get('warung') ?? '';
  const firstWarung = state.warungs.find((warung) => warung.id === preselected)?.id ?? (state.warungs.length === 1 ? state.warungs[0].id : '');
  const [warungId, setWarungId] = useState(firstWarung);
  const [dropDate, setDropDate] = useState(todayKey());
  const [dueDate, setDueDate] = useState(addDaysKey(todayKey(), 7));
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return state.products.filter((product) => product.active && (!term || product.name.toLowerCase().includes(term)));
  }, [state.products, search]);
  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, qty]) => {
          const product = state.products.find((item) => item.id === productId);
          return product && qty > 0 ? { product, qty } : null;
        })
        .filter((line): line is { product: (typeof state.products)[number]; qty: number } => Boolean(line)),
    [cart, state.products],
  );
  const qtyTotal = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = lines.reduce((sum, line) => sum + line.qty * line.product.price, 0);
  const selectedWarung = state.warungs.find((warung) => warung.id === warungId);
  const noStock = state.products.filter((product) => product.active).every((product) => product.stock === 0);

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
    setError('');
  };

  const submit = () => {
    setError('');
    if (!selectedWarung) {
      setError('Pilih warung yang akan dititipi bumbu.');
      return;
    }
    if (!lines.length) {
      setError('Tambahkan minimal satu bumbu untuk dititipkan.');
      return;
    }
    if (!dueDate || dueDate < dropDate) {
      setError('Tanggal kunjungan tidak boleh sebelum tanggal titip.');
      return;
    }
    try {
      const result = addConsignment({
        warungId: selectedWarung.id,
        date: isoFromDateKey(dropDate, '09:00'),
        dueDate,
        items: lines.map((line) => ({ productId: line.product.id, qty: line.qty })),
        note,
      });
      notify('Titipan berhasil dibuat', { message: `${qtyTotal} pack untuk ${selectedWarung.name}.` });
      navigate(`/titip/${result.consignment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Titipan belum bisa disimpan.');
    }
  };

  if (!state.warungs.length) {
    return (
      <div>
        <PageHeader eyebrow="Titipan baru" title="Pilih warung dulu" back fallback="/titip" />
        <Card className="no-border">
          <EmptyState
            illustration={<EmptyBowl size={54} />}
            title="Belum ada warung"
            description="Tambahkan warung langganan sebelum membuat titipan pertama."
            action={<Button onClick={() => navigate('/warung?new=1')} icon={<Plus size={16} />}>Tambah warung</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="new-consignment-page">
      <PageHeader
        eyebrow="Titipan baru"
        title="Antar bumbu ke warung"
        description="Catat bumbu yang dititipkan. Nanti tinggal hitung yang laku saat kunjungan."
        back
        fallback="/titip"
      />

      {noStock ? (
        <div className="setup-banner">
          <div className="setup-banner__icon"><PackageCheck size={21} /></div>
          <div><strong>Stok masih kosong</strong><p>Atur stok awal bumbu sebelum membuat titipan.</p></div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/produk')}>Atur stok</Button>
        </div>
      ) : null}

      <div className="form-layout">
        <div className="form-layout__main">
          <Card className="form-section">
            <div className="form-section__head">
              <span className="step-badge">1</span>
              <div><h2>Warung tujuan</h2><p>Pilih warung yang menerima titipan.</p></div>
            </div>
            <div className="form-grid form-grid--2">
              <Field label="Warung" htmlFor="consignment-warung">
                <Select id="consignment-warung" value={warungId} onChange={(event) => { setWarungId(event.target.value); setError(''); }}>
                  <option value="">Pilih warung…</option>
                  {state.warungs.map((warung) => <option key={warung.id} value={warung.id}>{warung.name}</option>)}
                </Select>
              </Field>
              <Field label="Tanggal titip" htmlFor="drop-date">
                <Input
                  id="drop-date"
                  type="date"
                  value={dropDate}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDropDate(next);
                    if (dueDate < next) setDueDate(addDaysKey(next, 7));
                  }}
                />
              </Field>
            </div>
            <Field label="Tanggal kunjungan berikutnya" hint="Untuk hitung laku & setoran" htmlFor="due-date">
              <Input id="due-date" type="date" value={dueDate} min={dropDate} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
            <div className="preset-row">
              {[3, 7, 14].map((days) => {
                const target = addDaysKey(dropDate, days);
                return (
                  <button
                    key={days}
                    type="button"
                    className={`preset-chip ${dueDate === target ? 'is-active' : ''}`}
                    onClick={() => setDueDate(target)}
                  >
                    <CalendarDays size={14} /> {days} hari
                  </button>
                );
              })}
            </div>
            {selectedWarung ? (
              <div className="selected-warung">
                <div className="selected-warung__icon"><Store size={18} /></div>
                <div>
                  <strong>{selectedWarung.name}</strong>
                  <p>{selectedWarung.owner ? `${selectedWarung.owner} · ` : ''}{selectedWarung.address || 'Alamat belum diisi'}</p>
                </div>
                <button type="button" onClick={() => navigate(`/warung/${selectedWarung.id}`)}>Detail <ChevronRight size={14} /></button>
              </div>
            ) : null}
          </Card>

          <Card className="form-section">
            <div className="form-section__head">
              <span className="step-badge">2</span>
              <div><h2>Bumbu yang dititipkan</h2><p>Masukkan jumlah pack per jenis bumbu.</p></div>
              <Badge tone="green">{qtyTotal} pack</Badge>
            </div>
            <SearchField value={search} onChange={setSearch} placeholder="Cari bumbu yang mau dititip…" />
            <div className="pick-list">
              {products.map((product) => {
                const qty = cart[product.id] ?? 0;
                const disabled = product.stock <= 0;
                return (
                  <div className={`pick-row ${qty > 0 ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} key={product.id}>
                    <ProductMark name={product.name} tone={product.tone} size="sm" imageUrl={product.imageUrl} />
                    <div className="pick-row__info">
                      <strong>{product.name}</strong>
                      <span>{formatMoney(product.price)} · stok {product.stock} pack</span>
                    </div>
                    {qty > 0 ? (
                      <Stepper value={qty} min={0} max={product.stock} onChange={(next) => setQty(product.id, next)} size="sm" label={product.name} />
                    ) : (
                      <button type="button" className="add-product-btn" disabled={disabled} onClick={() => setQty(product.id, 1)} aria-label={`Tambah ${product.name}`}>
                        <Plus size={17} />
                      </button>
                    )}
                  </div>
                );
              })}
              {!products.length ? <p className="muted-copy center">Tidak ada bumbu yang cocok.</p> : null}
            </div>
          </Card>

          <Card className="form-section">
            <div className="form-section__head">
              <span className="step-badge">3</span>
              <div><h2>Catatan kunjungan</h2><p>Opsional, untuk pengingat saat datang.</p></div>
            </div>
            <Field label="Catatan" optional htmlFor="consignment-note">
              <Textarea id="consignment-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: titip tambahan untuk akhir pekan" />
            </Field>
          </Card>
        </div>

        <aside className="form-layout__side">
          <Card className="order-card">
            <span className="card-kicker">Ringkasan titipan</span>
            <h2>{qtyTotal ? `${qtyTotal} pack` : 'Belum ada bumbu'}</h2>
            {lines.length ? (
              <div className="order-card__lines">
                {lines.map(({ product, qty }) => (
                  <div key={product.id}><span>{qty}× {product.name}</span><strong>{formatMoney(qty * product.price)}</strong></div>
                ))}
              </div>
            ) : (
              <p className="muted-copy">Pilih bumbu di samping untuk melihat ringkasan.</p>
            )}
            <div className="order-card__total">
              <span>Nilai titipan</span>
              <strong>{formatMoney(total)}</strong>
            </div>
            <div className="order-card__warung">
              <MapPin size={15} />
              <span>{selectedWarung?.name ?? 'Warung belum dipilih'}</span>
            </div>
            <div className="order-card__warung">
              <CalendarDays size={15} />
              <span>Dikunjungi {dueDate || '—'}</span>
            </div>
            {error ? <div className="form-error" role="alert">{error}</div> : null}
            <Button full size="lg" onClick={submit} icon={<PackageCheck size={18} />}>Buat titipan</Button>
            <p className="order-card__note">Stok akan berkurang sebanyak bumbu yang dititipkan.</p>
          </Card>
          <div className="side-tip">
            <Wallet size={17} />
            <p>Pembayaran tidak dicatat sekarang. Saat kunjungan, masukkan jumlah laku dan setoran yang diterima.</p>
          </div>
        </aside>
      </div>

      {lines.length ? (
        <div className="form-dock">
          <div><span>{qtyTotal} pack · {selectedWarung?.name ?? 'pilih warung'}</span><strong>{formatMoney(total)}</strong></div>
          <Button variant="gold" onClick={submit} iconAfter={<ArrowRight size={16} />}>Buat titipan</Button>
        </div>
      ) : null}
    </div>
  );
}
