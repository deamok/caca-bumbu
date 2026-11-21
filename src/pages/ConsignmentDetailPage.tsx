import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  PackageCheck,
  Phone,
  Plus,
  QrCode,
  RotateCcw,
  Store,
  Wallet,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { navigate, useLocation } from '../lib/router';
import { useToast } from '../components/Toast';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  MoneyInput,
  PageHeader,
  ProductMark,
  SectionHeader,
  Sheet,
  Stepper,
  Textarea,
  Toggle,
} from '../components/ui';
import { EmptyBowl } from '../components/Brand';
import type { PaymentMethod } from '../types';
import {
  addDaysKey,
  daysUntil,
  dueLabel,
  formatDate,
  formatTime,
  nowISO,
  todayKey,
} from '../lib/date';
import { formatMoney, whatsappLink } from '../lib/format';
import {
  consignmentTotal,
  getConsignment,
  getWarung,
  outstandingFor,
  paymentTotal,
} from '../lib/domain';

const METHODS: Array<{ value: PaymentMethod; label: string; icon: typeof Banknote }> = [
  { value: 'Tunai', label: 'Tunai', icon: Banknote },
  { value: 'QRIS', label: 'QRIS', icon: QrCode },
  { value: 'Transfer', label: 'Transfer', icon: CreditCard },
];

interface CountState {
  sold: number;
  damaged: number;
}

export function ConsignmentDetailPage() {
  const { state } = useStore();
  const location = useLocation();
  const id = location.path.split('/')[2] ?? '';
  const consignment = getConsignment(state, id);

  if (!consignment) {
    return (
      <div>
        <PageHeader eyebrow="Titipan" title="Titipan tidak ditemukan" back fallback="/titip" />
        <Card className="no-border">
          <EmptyState
            illustration={<EmptyBowl size={54} />}
            title="Data titipan tidak ada"
            description="Mungkin tautannya sudah berubah. Buka daftar titipan untuk melanjutkan."
            action={<Button onClick={() => navigate('/titip')}>Kembali ke daftar titipan</Button>}
          />
        </Card>
      </div>
    );
  }

  return consignment.status === 'aktif' ? (
    <ReconcileView consignmentId={id} />
  ) : (
    <ClosedView consignmentId={id} />
  );
}

function ReconcileView({ consignmentId }: { consignmentId: string }) {
  const { state, settleConsignment } = useStore();
  const { notify } = useToast();
  const consignment = getConsignment(state, consignmentId)!;
  const warung = getWarung(state, consignment.warungId);
  const [counts, setCounts] = useState<Record<string, CountState>>(() =>
    Object.fromEntries(consignment.items.map((item) => [item.productId, { sold: 0, damaged: 0 }])),
  );
  const [payment, setPayment] = useState(0);
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('Tunai');
  const [note, setNote] = useState('');
  const [nextDrop, setNextDrop] = useState(false);
  const [nextDueDate, setNextDueDate] = useState(addDaysKey(todayKey(), 7));
  const [newQtys, setNewQtys] = useState<Record<string, number>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');

  const reviewed = consignment.items.map((item) => {
    const count = counts[item.productId] ?? { sold: 0, damaged: 0 };
    const sold = Math.min(item.sentQty, Math.max(0, count.sold));
    const damaged = Math.min(item.sentQty - sold, Math.max(0, count.damaged));
    const returned = item.sentQty - sold - damaged;
    return { ...item, sold, damaged, returned };
  });
  const totalSold = reviewed.reduce((sum, item) => sum + item.sold, 0);
  const totalDamaged = reviewed.reduce((sum, item) => sum + item.damaged, 0);
  const totalReturned = reviewed.reduce((sum, item) => sum + item.returned, 0);
  const revenue = reviewed.reduce((sum, item) => sum + item.sold * item.price, 0);
  const paid = Math.min(payment, revenue);
  const remaining = Math.max(0, revenue - paid);
  const newDropQty = Object.values(newQtys).reduce((sum, qty) => sum + qty, 0);
  const newDropValue = reviewed.reduce((sum, item) => {
    const qty = newQtys[item.productId] ?? 0;
    return sum + qty * item.price;
  }, 0);
  const dueDiff = daysUntil(consignment.dueDate);
  const late = dueDiff < 0;

  useEffect(() => {
    if (!paymentTouched) setPayment(revenue);
  }, [revenue, paymentTouched]);

  const setSold = (item: (typeof reviewed)[number], value: number) => {
    const sold = Math.max(0, Math.min(item.sentQty - item.damaged, value));
    setCounts((current) => ({ ...current, [item.productId]: { sold, damaged: item.damaged } }));
    setError('');
  };

  const setDamaged = (item: (typeof reviewed)[number], value: number) => {
    const damaged = Math.max(0, Math.min(item.sentQty - item.sold, value));
    setCounts((current) => ({ ...current, [item.productId]: { sold: item.sold, damaged } }));
    setError('');
  };

  const markAllSold = () => {
    setCounts(Object.fromEntries(consignment.items.map((item) => [item.productId, { sold: item.sentQty, damaged: 0 }])));
    setPaymentTouched(false);
    setError('');
  };

  const toggleNextDrop = (on: boolean) => {
    setNextDrop(on);
    if (on) {
      setNewQtys(Object.fromEntries(reviewed.map((item) => [item.productId, item.returned])));
      setNextDueDate(addDaysKey(todayKey(), 7));
    }
  };

  const setNewQty = (productId: string, qty: number) => {
    const item = reviewed.find((entry) => entry.productId === productId);
    const product = state.products.find((entry) => entry.id === productId);
    const available = (product?.stock ?? 0) + (item?.returned ?? 0);
    setNewQtys((current) => ({ ...current, [productId]: Math.max(0, Math.min(available, qty)) }));
    setError('');
  };

  const openConfirm = () => {
    setError('');
    if (payment > revenue) {
      setError('Setoran tidak boleh melebihi total penjualan titipan.');
      return;
    }
    if (nextDrop && newDropQty <= 0) {
      setError('Isi jumlah bumbu untuk titipan baru, atau matikan pilihan titip lagi.');
      return;
    }
    if (nextDrop && nextDueDate < todayKey()) {
      setError('Tanggal kunjungan baru tidak boleh di masa lalu.');
      return;
    }
    setConfirmOpen(true);
  };

  const save = () => {
    try {
      const result = settleConsignment({
        id: consignment.id,
        date: nowISO(),
        counts: reviewed.map((item) => ({ productId: item.productId, soldQty: item.sold, damagedQty: item.damaged })),
        paymentAmount: paid,
        paymentMethod: method,
        note,
        nextDrop: nextDrop
          ? {
              dueDate: nextDueDate,
              items: reviewed
                .filter((item) => (newQtys[item.productId] ?? 0) > 0)
                .map((item) => ({ productId: item.productId, qty: newQtys[item.productId] })),
              note: 'Titipan lanjutan',
            }
          : null,
      });
      setConfirmOpen(false);
      notify('Kunjungan selesai dicatat', {
        message: result.nextConsignment
          ? `${formatMoney(revenue)} laku, titipan baru ${newDropQty} pack sudah dibuat.`
          : `${formatMoney(revenue)} laku, sisa ${formatMoney(remaining)}.`,
      });
      navigate('/titip');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunjungan belum bisa disimpan.');
      setConfirmOpen(false);
    }
  };

  return (
    <div className="consignment-detail">
      <PageHeader
        eyebrow={`${consignment.code} · Titipan aktif`}
        title="Hitung titipan"
        description={`${warung?.name ?? 'Warung'} · dikunjungi ${formatDate(consignment.dueDate)}`}
        back
        fallback="/titip"
        action={<Badge tone={late ? 'red' : 'gold'} dot>{late ? dueLabel(consignment.dueDate) : 'Sedang berjalan'}</Badge>}
      />

      <div className="consignment-hero">
        <div className="consignment-hero__who">
          <Avatar name={warung?.name ?? 'Warung'} size="lg" tone={late ? 'clay' : 'green'} />
          <div>
            <span className="eyebrow">Warung tujuan</span>
            <h2>{warung?.name ?? 'Warung'}</h2>
            <p>{warung?.owner ? `${warung.owner} · ` : ''}{warung?.address || 'Alamat belum diisi'}</p>
          </div>
        </div>
        <div className="consignment-hero__meta">
          <div><span>Titip</span><strong>{formatDate(consignment.date)}</strong></div>
          <div><span>Jatuh tempo</span><strong>{formatDate(consignment.dueDate)}</strong></div>
          <div><span>Jenis bumbu</span><strong>{consignment.items.length} jenis</strong></div>
        </div>
        <div className="consignment-hero__actions">
          {warung?.phone ? (
            <a className="btn btn--secondary btn--sm" href={whatsappLink(warung.phone, `Halo ${warung.owner || warung.name}, saya mau datang menghitung titipan bumbu.`)} target="_blank" rel="noreferrer">
              <span className="btn__icon"><Phone size={15} /></span><span>Hubungi</span>
            </a>
          ) : null}
          <button type="button" className="text-link" onClick={() => navigate(`/warung/${consignment.warungId}`)}>Lihat warung <ChevronRight size={14} /></button>
        </div>
      </div>

      {late ? (
        <div className="alert-banner">
          <span><AlertTriangle size={20} /></span>
          <div><strong>Sudah lewat jadwal kunjungan</strong><p>Hitung sisa bumbu dan terima setoran saat bertemu pemilik warung.</p></div>
        </div>
      ) : null}

      <div className="reconcile-layout">
        <div className="reconcile-layout__main">
          <Card className="audit-card">
            <div className="audit-card__head">
              <div>
                <span className="card-kicker">Langkah 1</span>
                <h2>Hasil kunjungan</h2>
                <p>Masukkan jumlah pack yang laku. Sisa yang kembali otomatis dihitung.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={markAllSold} icon={<Check size={15} />}>Semua laku</Button>
            </div>

            <div className="audit-list">
              {reviewed.map((item) => (
                <div className="audit-item" key={item.productId}>
                  <div className="audit-item__product">
                    <ProductMark name={item.name} tone={state.products.find((product) => product.id === item.productId)?.tone ?? 'saffron'} imageUrl={state.products.find((product) => product.id === item.productId)?.imageUrl} size="sm" />
                    <div>
                      <strong>{item.name}</strong>
                      <span>{formatMoney(item.price)} / pack</span>
                    </div>
                    <span className="audit-item__sent">Titip <strong>{item.sentQty}</strong></span>
                  </div>
                  <div className="audit-item__controls">
                    <div className="audit-control">
                      <span>Laku</span>
                      <Stepper value={item.sold} min={0} max={item.sentQty - item.damaged} onChange={(value) => setSold(item, value)} size="sm" label={`${item.name} laku`} />
                    </div>
                    <div className="audit-control">
                      <span>Rusak</span>
                      <Stepper value={item.damaged} min={0} max={item.sentQty - item.sold} onChange={(value) => setDamaged(item, value)} size="sm" label={`${item.name} rusak`} />
                    </div>
                    <div className="audit-return">
                      <RotateCcw size={14} />
                      <span>Kembali <strong>{item.returned}</strong></span>
                    </div>
                    <div className="audit-subtotal">
                      <span>Nilai</span>
                      <strong>{formatMoney(item.sold * item.price)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="audit-totals">
              <div><span>Total laku</span><strong>{totalSold} pack</strong></div>
              <div><span>Rusak</span><strong>{totalDamaged} pack</strong></div>
              <div><span>Kembali ke stok</span><strong>{totalReturned} pack</strong></div>
              <div className="audit-totals__revenue"><span>Total penjualan</span><strong>{formatMoney(revenue)}</strong></div>
            </div>
          </Card>

          <Card className="payment-card">
            <div className="audit-card__head">
              <div>
                <span className="card-kicker">Langkah 2</span>
                <h2>Setoran dari warung</h2>
                <p>Uang yang diterima hari ini. Boleh sebagian, sisanya menjadi piutang.</p>
              </div>
              <span className="payment-card__wallet"><Wallet size={20} /></span>
            </div>
            <div className="payment-panel">
              <Field label="Setoran diterima" htmlFor="settlement">
                <MoneyInput id="settlement" value={payment} onChange={(value) => { setPayment(value); setPaymentTouched(true); setError(''); }} max={revenue} />
              </Field>
              <Button variant="secondary" size="sm" onClick={() => { setPayment(revenue); setPaymentTouched(true); setError(''); }}>Setoran pas</Button>
            </div>
            <div className="payment-summary">
              <div><span>Total penjualan</span><strong>{formatMoney(revenue)}</strong></div>
              <div><span>Setoran diterima</span><strong>{formatMoney(paid)}</strong></div>
              <div className={remaining ? 'is-due' : 'is-clear'}><span>{remaining ? 'Sisa menjadi piutang' : 'Pembayaran'}</span><strong>{remaining ? formatMoney(remaining) : 'Lunas'}</strong></div>
            </div>
            <div className="method-picker">
              {METHODS.map((item) => {
                const Icon = item.icon;
                return (
                  <button type="button" key={item.value} className={`method-option ${method === item.value ? 'is-active' : ''}`} onClick={() => setMethod(item.value)}>
                    <Icon size={18} /><span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <Field label="Catatan kunjungan" optional htmlFor="settle-note">
              <Textarea id="settle-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: 2 pack rusak karena kemasan bocor" />
            </Field>
          </Card>

          <Card className="next-drop-card">
            <Toggle
              checked={nextDrop}
              onChange={toggleNextDrop}
              label="Langsung titip bumbu baru"
              description="Sekaligus siapkan titipan berikutnya dalam kunjungan ini."
            />
            {nextDrop ? (
              <div className="next-drop">
                <div className="next-drop__head">
                  <div>
                    <span className="card-kicker">Langkah 3</span>
                    <h2>Titipan berikutnya</h2>
                  </div>
                  <Badge tone="green">{newDropQty} pack</Badge>
                </div>
                <Field label="Kunjungan berikutnya" htmlFor="next-due">
                  <Input id="next-due" type="date" value={nextDueDate} min={todayKey()} onChange={(event) => setNextDueDate(event.target.value)} />
                </Field>
                <div className="next-drop__list">
                  {reviewed.map((item) => {
                    const product = state.products.find((entry) => entry.id === item.productId);
                    const available = (product?.stock ?? 0) + item.returned;
                    const qty = newQtys[item.productId] ?? 0;
                    return (
                      <div className="next-drop__row" key={item.productId}>
                        <div>
                          <strong>{item.name}</strong>
                          <span>Tersedia {available} pack · kembali {item.returned}</span>
                        </div>
                        <Stepper value={qty} min={0} max={available} onChange={(value) => setNewQty(item.productId, value)} size="sm" label={`Titip baru ${item.name}`} />
                      </div>
                    );
                  })}
                </div>
                <div className="next-drop__total">
                  <span>{newDropQty} pack untuk titipan baru</span>
                  <strong>{formatMoney(newDropValue)}</strong>
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <aside className="reconcile-layout__side">
          <Card className="confirm-card">
            <span className="card-kicker">Ringkasan kunjungan</span>
            <h2>{formatMoney(revenue)}</h2>
            <p>Total penjualan dari {totalSold} pack yang laku.</p>
            <div className="confirm-card__rows">
              <div><span>Setoran</span><strong>{formatMoney(paid)}</strong></div>
              <div><span>Sisa piutang</span><strong>{formatMoney(remaining)}</strong></div>
              <div><span>Stok kembali</span><strong>{totalReturned} pack</strong></div>
              {nextDrop ? <div><span>Titipan baru</span><strong>{newDropQty} pack</strong></div> : null}
            </div>
            {error ? <div className="form-error" role="alert">{error}</div> : null}
            <Button full size="lg" onClick={openConfirm} icon={<CheckCircle2 size={18} />}>Selesaikan kunjungan</Button>
            <p className="confirm-card__hint">Pastikan jumlah laku sudah sesuai sebelum menyimpan.</p>
          </Card>
          <div className="side-tip">
            <Store size={17} />
            <p>Setelah disimpan, stok retur masuk kembali dan setoran tercatat di warung.</p>
          </div>
        </aside>
      </div>

      <Sheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Simpan hasil kunjungan?"
        description={`${warung?.name ?? 'Warung'} · ${consignment.code}`}
        footer={
          <Button full size="lg" onClick={save} icon={<CheckCircle2 size={18} />}>Ya, simpan kunjungan</Button>
        }
      >
        <div className="confirm-sheet">
          <div className="confirm-sheet__total">{formatMoney(revenue)}</div>
          <p>{totalSold} pack laku dari {consignment.items.reduce((sum, item) => sum + item.sentQty, 0)} pack yang dititipkan.</p>
          <div className="confirm-sheet__rows">
            <div><span>Setoran diterima</span><strong>{formatMoney(paid)}</strong></div>
            <div><span>Sisa menjadi piutang</span><strong className={remaining ? 'text-danger' : ''}>{formatMoney(remaining)}</strong></div>
            <div><span>Kembali ke stok</span><strong>{totalReturned} pack</strong></div>
            <div><span>Rusak</span><strong>{totalDamaged} pack</strong></div>
            {nextDrop ? <div><span>Titipan baru</span><strong>{newDropQty} pack · {formatDate(nextDueDate)}</strong></div> : null}
          </div>
          {nextDrop ? <div className="confirm-sheet__next"><PackageCheck size={17} /> Titipan baru akan tercatat dan stoknya langsung disiapkan.</div> : null}
        </div>
      </Sheet>
    </div>
  );
}

function ClosedView({ consignmentId }: { consignmentId: string }) {
  const { state, pay } = useStore();
  const { notify } = useToast();
  const consignment = getConsignment(state, consignmentId)!;
  const warung = getWarung(state, consignment.warungId);
  const total = consignmentTotal(consignment);
  const paid = paymentTotal(state, 'consignment', consignment.id);
  const remaining = outstandingFor(state, 'consignment', consignment.id);
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState(remaining);
  const [method, setMethod] = useState<PaymentMethod>('Tunai');
  const [error, setError] = useState('');
  const payments = state.payments
    .filter((payment) => payment.refType === 'consignment' && payment.refId === consignment.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const soldQty = consignment.items.reduce((sum, item) => sum + item.soldQty, 0);
  const returnedQty = consignment.items.reduce((sum, item) => sum + item.returnedQty, 0);
  const damagedQty = consignment.items.reduce((sum, item) => sum + item.damagedQty, 0);

  const openPay = () => {
    setAmount(remaining);
    setError('');
    setPayOpen(true);
  };

  const submitPayment = () => {
    try {
      pay({
        refType: 'consignment',
        refId: consignment.id,
        amount,
        method,
        note: `Pelunasan ${consignment.code}`,
      });
      notify('Pembayaran tercatat', { message: `${formatMoney(amount)} diterima dari ${warung?.name ?? 'warung'}.` });
      setPayOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pembayaran belum bisa disimpan.');
    }
  };

  return (
    <div className="consignment-detail">
      <PageHeader
        eyebrow={`${consignment.code} · Titipan selesai`}
        title="Rincian titipan"
        description={`${warung?.name ?? 'Warung'} · dihitung ${consignment.closedAt ? formatDate(consignment.closedAt) : '—'}`}
        back
        fallback="/titip"
        action={<Badge tone={remaining ? 'gold' : 'green'} dot>{remaining ? 'Ada sisa bayar' : 'Lunas'}</Badge>}
      />

      <div className="closed-summary">
        <div className="closed-summary__main">
          <span className="eyebrow eyebrow--light">Total penjualan titipan</span>
          <strong>{formatMoney(total)}</strong>
          <p>{soldQty} pack laku dari {consignment.items.reduce((sum, item) => sum + item.sentQty, 0)} pack yang dititipkan.</p>
          <div className="closed-summary__stats">
            <div><span>Diterima</span><strong>{formatMoney(paid)}</strong></div>
            <div><span>Sisa</span><strong>{formatMoney(remaining)}</strong></div>
            <div><span>Dikembalikan</span><strong>{returnedQty} pack</strong></div>
            <div><span>Rusak</span><strong>{damagedQty} pack</strong></div>
          </div>
          <div className="closed-summary__actions">
            {remaining > 0 ? <Button variant="gold" onClick={openPay} icon={<Wallet size={16} />}>Catat pelunasan</Button> : <Badge tone="green"><Check size={14} /> Semua setoran lunas</Badge>}
            <Button variant="secondary" onClick={() => navigate(`/titip/baru?warung=${consignment.warungId}`)} icon={<Plus size={16} />}>Titip lagi</Button>
          </div>
        </div>
        <div className="closed-summary__stamp" aria-hidden="true">
          <PackageCheck size={76} />
          <span>SELESAI</span>
        </div>
      </div>

      <div className="closed-layout">
        <Card className="audit-readonly">
          <SectionHeader title="Rincian bumbu" description={`Dihitung ${consignment.closedAt ? formatDate(consignment.closedAt, 'long') : '—'}`} />
          <div className="readonly-table">
            <div className="readonly-table__head">
              <span>Bumbu</span><span>Titip</span><span>Laku</span><span>Kembali</span><span>Rusak</span><span>Nilai</span>
            </div>
            {consignment.items.map((item) => (
              <div className="readonly-table__row" key={item.productId}>
                <span className="readonly-table__product"><ProductMark name={item.name} tone={state.products.find((product) => product.id === item.productId)?.tone ?? 'saffron'} imageUrl={state.products.find((product) => product.id === item.productId)?.imageUrl} size="xs" />{item.name}</span>
                <span>{item.sentQty}</span><span>{item.soldQty}</span><span>{item.returnedQty}</span><span>{item.damagedQty}</span><strong>{formatMoney(item.soldQty * item.price)}</strong>
              </div>
            ))}
          </div>
          <div className="readonly-mobile">
            {consignment.items.map((item) => (
              <div className="readonly-mobile__row" key={item.productId}>
                <div className="readonly-mobile__head">
                  <ProductMark name={item.name} tone={state.products.find((product) => product.id === item.productId)?.tone ?? 'saffron'} imageUrl={state.products.find((product) => product.id === item.productId)?.imageUrl} size="xs" />
                  <strong>{item.name}</strong>
                  <b>{formatMoney(item.soldQty * item.price)}</b>
                </div>
                <div className="readonly-mobile__stats">
                  <span><small>Titip</small>{item.sentQty}</span>
                  <span><small>Laku</small>{item.soldQty}</span>
                  <span><small>Kembali</small>{item.returnedQty}</span>
                  <span><small>Rusak</small>{item.damagedQty}</span>
                </div>
              </div>
            ))}
          </div>
          {consignment.closeNote ? <div className="close-note"><span>Catatan</span><p>{consignment.closeNote}</p></div> : null}
        </Card>

        <aside className="closed-layout__side">
          <Card>
            <SectionHeader title="Riwayat setoran" />
            {payments.length ? (
              <div className="payment-history">
                {payments.map((payment) => (
                  <div key={payment.id}>
                    <span className="payment-history__icon"><Banknote size={16} /></span>
                    <div><strong>{formatMoney(payment.amount)}</strong><span>{payment.method} · {formatDate(payment.date)}</span></div>
                    <CheckCircle2 size={16} className="text-success" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-copy">Belum ada setoran tercatat.</p>
            )}
            {remaining > 0 ? (
              <Button full variant="secondary" size="sm" onClick={openPay} icon={<Wallet size={15} />}>Catat pembayaran</Button>
            ) : null}
          </Card>
          <div className="side-tip">
            <CalendarDays size={17} />
            <p>Titipan dihitung {consignment.closedAt ? formatDate(consignment.closedAt) : '—'} pukul {consignment.closedAt ? formatTime(consignment.closedAt) : '—'}.</p>
          </div>
        </aside>
      </div>

      <Sheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Catat pelunasan"
        description={`Sisa tagihan ${formatMoney(remaining)}`}
        footer={<Button full size="lg" onClick={submitPayment} icon={<CheckCircle2 size={17} />}>Simpan pembayaran</Button>}
      >
        <div className="payment-sheet">
          <Field label="Nominal diterima" htmlFor="payment-amount">
            <MoneyInput id="payment-amount" value={amount} onChange={setAmount} max={remaining} />
          </Field>
          <div className="method-picker">
            {METHODS.map((item) => {
              const Icon = item.icon;
              return (
                <button type="button" key={item.value} className={`method-option ${method === item.value ? 'is-active' : ''}`} onClick={() => setMethod(item.value)}>
                  <Icon size={18} /><span>{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="payment-sheet__summary">
            <span>Sisa setelah pembayaran</span>
            <strong>{formatMoney(Math.max(0, remaining - amount))}</strong>
          </div>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
        </div>
      </Sheet>
    </div>
  );
}