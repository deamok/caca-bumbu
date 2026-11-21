import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Edit3,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  Plus,
  QrCode,
  ReceiptText,
  ShoppingBag,
  Store,
  Wallet,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { navigate, useLocation } from '../lib/router';
import { useToast } from '../components/Toast';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  MoneyInput,
  PageHeader,
  ProductMark,
  SectionHeader,
  Sheet,
  Stat,
} from '../components/ui';
import { EmptyBowl } from '../components/Brand';
import { ConsignmentCard } from '../components/ConsignmentCard';
import { WarungFormSheet } from '../components/WarungFormSheet';
import type { OutstandingInvoice, PaymentMethod, Sale } from '../types';
import {
  consignmentTotal,
  outstandingInvoices,
  paymentTotal,
  saleTotal,
} from '../lib/domain';
import { warungMetrics } from '../lib/analytics';
import { formatDate, formatTime, relativeLabel } from '../lib/date';
import { formatMoney, whatsappLink } from '../lib/format';

const METHODS: Array<{ value: PaymentMethod; label: string; icon: typeof Banknote }> = [
  { value: 'Tunai', label: 'Tunai', icon: Banknote },
  { value: 'QRIS', label: 'QRIS', icon: QrCode },
  { value: 'Transfer', label: 'Transfer', icon: CreditCard },
];

interface HistoryRow {
  id: string;
  type: 'sale' | 'consignment';
  code: string;
  date: string;
  total: number;
  paid: number;
  outstanding: number;
  sale?: Sale;
}

export function WarungDetailPage() {
  const { state, pay } = useStore();
  const { notify } = useToast();
  const location = useLocation();
  const id = location.path.split('/')[2] ?? '';
  const warung = state.warungs.find((item) => item.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<OutstandingInvoice | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('Tunai');
  const [payError, setPayError] = useState('');

  const metrics = warung ? warungMetrics(state, warung.id) : null;
  const active = state.consignments
    .filter((consignment) => consignment.warungId === id && consignment.status === 'aktif')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const invoices = outstandingInvoices(state).filter((invoice) => invoice.warungId === id);

  const history = useMemo<HistoryRow[]>(() => {
    const sales: HistoryRow[] = state.sales
      .filter((sale) => sale.warungId === id)
      .map((sale) => {
        const total = saleTotal(sale);
        const paid = paymentTotal(state, 'sale', sale.id);
        return { id: sale.id, type: 'sale', code: sale.code, date: sale.date, total, paid, outstanding: Math.max(0, total - paid), sale };
      });
    const consignments: HistoryRow[] = state.consignments
      .filter((consignment) => consignment.warungId === id && consignment.status === 'selesai')
      .map((consignment) => {
        const total = consignmentTotal(consignment);
        const paid = paymentTotal(state, 'consignment', consignment.id);
        return { id: consignment.id, type: 'consignment', code: consignment.code, date: consignment.closedAt ?? consignment.date, total, paid, outstanding: Math.max(0, total - paid) };
      });
    return [...sales, ...consignments].sort((a, b) => b.date.localeCompare(a.date));
  }, [state, id]);

  if (!warung || !metrics) {
    return (
      <div>
        <PageHeader eyebrow="Warung" title="Warung tidak ditemukan" back fallback="/warung" />
        <Card className="no-border">
          <EmptyState illustration={<EmptyBowl size={54} />} title="Data warung tidak ada" action={<Button onClick={() => navigate('/warung')}>Kembali ke daftar</Button>} />
        </Card>
      </div>
    );
  }

  const openPayment = (invoice: OutstandingInvoice) => {
    setSelectedInvoice(invoice);
    setAmount(invoice.outstanding);
    setMethod('Tunai');
    setPayError('');
  };

  const savePayment = () => {
    if (!selectedInvoice) return;
    try {
      pay({
        refType: selectedInvoice.refType,
        refId: selectedInvoice.refId,
        amount,
        method,
        note: `Pembayaran ${selectedInvoice.code}`,
      });
      notify('Pembayaran tercatat', { message: `${formatMoney(amount)} untuk ${selectedInvoice.code}.` });
      setSelectedInvoice(null);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Pembayaran belum bisa disimpan.');
    }
  };

  return (
    <div className="warung-detail-page">
      <PageHeader
        eyebrow="Detail warung"
        title={warung.name}
        description={warung.owner ? `Pemilik: ${warung.owner}` : 'Pemilik belum dicatat'}
        back
        fallback="/warung"
        action={<Button variant="secondary" size="sm" onClick={() => setEditOpen(true)} icon={<Edit3 size={15} />}>Edit</Button>}
      />

      <div className="warung-profile">
        <div className="warung-profile__main">
          <Avatar name={warung.name} size="lg" />
          <div>
            <h2>{warung.name}</h2>
            <p>{warung.address || 'Alamat belum diisi'}</p>
            <div className="warung-profile__contacts">
              {warung.phone ? <a href={`tel:${warung.phone}`}><Phone size={14} /> {warung.phone}</a> : null}
              {warung.phone ? <span>·</span> : null}
              <span>Bergabung {formatDate(warung.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="warung-profile__actions">
          {warung.phone ? (
            <a className="btn btn--secondary btn--sm" href={whatsappLink(warung.phone, `Halo ${warung.owner || warung.name}, saya dari ${state.settings.businessName}.`)} target="_blank" rel="noreferrer">
              <span className="btn__icon"><MessageCircle size={15} /></span><span>WhatsApp</span>
            </a>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => navigate(`/jual?warung=${warung.id}`)} icon={<ShoppingBag size={15} />}>Jual</Button>
          <Button size="sm" onClick={() => navigate(`/titip/baru?warung=${warung.id}`)} icon={<PackageCheck size={15} />}>Titip</Button>
        </div>
      </div>

      <div className="stat-strip">
        <Stat label="Total belanja" value={formatMoney(metrics.totalSpend)} icon={<ReceiptText size={18} />} tone="green" hint={`${metrics.salesCount} transaksi`} />
        <Stat label="Piutang" value={formatMoney(metrics.outstanding)} icon={<Wallet size={18} />} tone={metrics.outstanding ? 'gold' : 'plain'} hint={invoices.length ? `${invoices.length} tagihan` : 'Tidak ada tagihan'} />
        <Stat label="Titipan aktif" value={metrics.active} icon={<PackageCheck size={18} />} hint="Bumbu masih di warung" />
        <Stat label="Terakhir aktif" value={metrics.lastActivity ? relativeLabel(metrics.lastActivity) : 'Belum ada'} icon={<CalendarDays size={18} />} hint="Jual atau titip" />
      </div>

      <div className="warung-detail-grid">
        <div className="warung-detail-grid__main">
          <Card className="warung-active-card">
            <SectionHeader
              title="Titipan aktif"
              description={active.length ? 'Hitung saat mengunjungi warung.' : 'Tidak ada bumbu yang sedang dititipkan.'}
              action={<Button variant="ghost" size="sm" onClick={() => navigate(`/titip/baru?warung=${warung.id}`)} icon={<Plus size={15} />}>Titip baru</Button>}
            />
            {active.length ? (
              <div className="consignment-grid consignment-grid--one">
                {active.map((consignment) => (
                  <ConsignmentCard
                    key={consignment.id}
                    consignment={consignment}
                    warung={warung}
                    state={state}
                    showWarung={false}
                    onClick={() => navigate(`/titip/${consignment.id}`)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState compact illustration={<EmptyBowl size={42} />} title="Belum ada titipan" description="Buat titipan saat mengantar bumbu berikutnya." />
            )}
          </Card>

          {invoices.length ? (
            <Card>
              <SectionHeader title="Tagihan belum lunas" description="Catat pembayaran saat uang diterima." />
              <div className="invoice-list">
                {invoices.map((invoice) => (
                  <div className="invoice-row" key={`${invoice.refType}-${invoice.refId}`}>
                    <span className={`invoice-row__icon ${invoice.refType === 'consignment' ? 'is-gold' : ''}`}>
                      {invoice.refType === 'consignment' ? <PackageCheck size={17} /> : <ShoppingBag size={17} />}
                    </span>
                    <div>
                      <strong>{invoice.code}</strong>
                      <span>{invoice.refType === 'consignment' ? 'Titipan' : 'Jual langsung'} · {formatDate(invoice.date)}</span>
                    </div>
                    <div className="invoice-row__amount"><small>Sisa</small><strong>{formatMoney(invoice.outstanding)}</strong></div>
                    <Button size="sm" variant="secondary" onClick={() => openPayment(invoice)}>Bayar</Button>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <SectionHeader title="Riwayat transaksi" description="Jual langsung dan titipan yang sudah dihitung." />
            {history.length ? (
              <div className="history-list">
                {history.map((row) => (
                  <button
                    type="button"
                    className="history-row"
                    key={`${row.type}-${row.id}`}
                    onClick={() => {
                      if (row.type === 'consignment') navigate(`/titip/${row.id}`);
                      else if (row.sale) setSelectedSale(row.sale);
                    }}
                  >
                    <span className={`history-row__icon ${row.type === 'consignment' ? 'is-gold' : ''}`}>
                      {row.type === 'consignment' ? <PackageCheck size={17} /> : <ShoppingBag size={17} />}
                    </span>
                    <div>
                      <strong>{row.code}</strong>
                      <span>{formatDate(row.date)} · {row.type === 'consignment' ? 'Titipan' : 'Jual langsung'}</span>
                    </div>
                    <div className="history-row__amount">
                      <strong>{formatMoney(row.total)}</strong>
                      <small className={row.outstanding ? 'text-danger' : 'text-success'}>{row.outstanding ? `Sisa ${formatMoney(row.outstanding, { compact: true })}` : 'Lunas'}</small>
                    </div>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState compact illustration={<EmptyBowl size={42} />} title="Belum ada transaksi" description="Transaksi pertama akan tersimpan di sini." />
            )}
          </Card>
        </div>

        <aside className="warung-detail-grid__side">
          <Card>
            <SectionHeader title="Catatan warung" />
            <div className="warung-info-list">
              <div><MapPin size={16} /><span>{warung.address || 'Alamat belum diisi'}</span></div>
              <div><Phone size={16} /><span>{warung.phone || 'Nomor belum diisi'}</span></div>
              <div><Store size={16} /><span>{warung.owner || 'Pemilik belum dicatat'}</span></div>
            </div>
            {warung.notes ? <div className="warung-notes">“{warung.notes}”</div> : <p className="muted-copy">Belum ada catatan khusus.</p>}
            <Button full variant="ghost" size="sm" onClick={() => setEditOpen(true)} icon={<Edit3 size={15} />}>Ubah data warung</Button>
          </Card>

          <Card className="warung-action-card">
            <span className="card-kicker">Aksi cepat</span>
            <button type="button" onClick={() => navigate(`/jual?warung=${warung.id}`)}>
              <span><ShoppingBag size={18} /></span>
              <div><strong>Jual langsung</strong><small>Catat pembelian di tempat</small></div>
              <ArrowRight size={15} />
            </button>
            <button type="button" onClick={() => navigate(`/titip/baru?warung=${warung.id}`)}>
              <span className="is-gold"><PackageCheck size={18} /></span>
              <div><strong>Buat titipan</strong><small>Antar bumbu untuk dijual</small></div>
              <ArrowRight size={15} />
            </button>
            {warung.phone ? (
              <a href={whatsappLink(warung.phone, `Halo ${warung.owner || warung.name}, saya dari ${state.settings.businessName}.`)} target="_blank" rel="noreferrer">
                <span className="is-blue"><MessageCircle size={18} /></span>
                <div><strong>Kirim WhatsApp</strong><small>Konfirmasi kunjungan</small></div>
                <ArrowRight size={15} />
              </a>
            ) : null}
          </Card>
        </aside>
      </div>

      <WarungFormSheet open={editOpen} onClose={() => setEditOpen(false)} warung={warung} />

      <Sheet
        open={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        title="Catat pembayaran"
        description={selectedInvoice ? `${selectedInvoice.code} · sisa ${formatMoney(selectedInvoice.outstanding)}` : ''}
        footer={<Button full size="lg" onClick={savePayment} icon={<CheckCircle2 size={17} />}>Simpan pembayaran</Button>}
      >
        {selectedInvoice ? (
          <div className="payment-sheet">
            <div className="payment-sheet__summary">
              <span>Total tagihan</span>
              <strong>{formatMoney(selectedInvoice.total)}</strong>
            </div>
            <Field label="Nominal diterima" htmlFor="warung-payment">
              <MoneyInput id="warung-payment" value={amount} onChange={setAmount} max={selectedInvoice.outstanding} />
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
            {payError ? <div className="form-error" role="alert">{payError}</div> : null}
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={Boolean(selectedSale)}
        onClose={() => setSelectedSale(null)}
        title={selectedSale?.code ?? 'Transaksi'}
        description={selectedSale ? `${formatDate(selectedSale.date)} · ${formatTime(selectedSale.date)}` : ''}
      >
        {selectedSale ? (
          <div className="sale-detail-sheet">
            <div className="sale-detail-sheet__buyer"><span>Pembeli</span><strong>{selectedSale.buyerName}</strong></div>
            <div className="sale-detail-sheet__items">
              {selectedSale.items.map((item) => (
                <div key={item.productId}>
                  <ProductMark name={item.name} size="xs" />
                  <span>{item.qty}× {item.name}</span>
                  <strong>{formatMoney(item.qty * item.price)}</strong>
                </div>
              ))}
            </div>
            <div className="sale-detail-sheet__total"><span>Total</span><strong>{formatMoney(selectedSale.total)}</strong></div>
            <div className="sale-detail-sheet__payment">
              <span>Dibayar</span>
              <strong>{formatMoney(paymentTotal(state, 'sale', selectedSale.id))}</strong>
            </div>
            {selectedSale.note ? <p className="sale-detail-sheet__note">{selectedSale.note}</p> : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
