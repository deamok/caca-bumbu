import { useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { navigate } from '../lib/router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProductMark,
  SearchField,
  Segmented,
  Sheet,
  Stat,
} from '../components/ui';
import { EmptyBowl } from '../components/Brand';
import type { Sale } from '../types';
import { consignmentTotal, getWarung, paymentTotal, saleTotal } from '../lib/domain';
import { dateKey, formatDate, formatTime, relativeLabel, todayKey } from '../lib/date';
import { formatMoney } from '../lib/format';

type Filter = 'all' | 'sale' | 'consignment' | 'unpaid';

interface Entry {
  id: string;
  type: 'sale' | 'consignment';
  code: string;
  date: string;
  total: number;
  paid: number;
  outstanding: number;
  warungId: string | null;
  warungName: string;
  sale?: Sale;
}

export function HistoryPage() {
  const { state } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const sales: Entry[] = state.sales.map((sale) => {
      const total = saleTotal(sale);
      const paid = paymentTotal(state, 'sale', sale.id);
      return {
        id: sale.id,
        type: 'sale',
        code: sale.code,
        date: sale.date,
        total,
        paid,
        outstanding: Math.max(0, total - paid),
        warungId: sale.warungId,
        warungName: getWarung(state, sale.warungId)?.name ?? sale.buyerName,
        sale,
      };
    });
    const consignments: Entry[] = state.consignments
      .filter((consignment) => consignment.status === 'selesai')
      .map((consignment) => {
        const total = consignmentTotal(consignment);
        const paid = paymentTotal(state, 'consignment', consignment.id);
        return {
          id: consignment.id,
          type: 'consignment',
          code: consignment.code,
          date: consignment.closedAt ?? consignment.date,
          total,
          paid,
          outstanding: Math.max(0, total - paid),
          warungId: consignment.warungId,
          warungName: getWarung(state, consignment.warungId)?.name ?? 'Warung',
        };
      });
    return [...sales, ...consignments].sort((a, b) => b.date.localeCompare(a.date));
  }, [state]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries
      .filter((entry) => {
        if (filter === 'sale') return entry.type === 'sale';
        if (filter === 'consignment') return entry.type === 'consignment';
        if (filter === 'unpaid') return entry.outstanding > 0;
        return true;
      })
      .filter((entry) => !term || entry.code.toLowerCase().includes(term) || entry.warungName.toLowerCase().includes(term));
  }, [entries, filter, search]);

  const total = entries.reduce((sum, entry) => sum + entry.total, 0);
  const outstanding = entries.reduce((sum, entry) => sum + entry.outstanding, 0);
  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of filtered) {
      const key = dateKey(entry.date);
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const dayLabel = (key: string) => {
    if (key === todayKey()) return 'Hari ini';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (key === dateKey(yesterday)) return 'Kemarin';
    return formatDate(key, 'long');
  };

  return (
    <div className="history-page">
      <PageHeader
        eyebrow="Riwayat"
        title="Semua transaksi"
        description="Jual langsung dan titipan yang sudah dihitung, dalam satu catatan."
        action={<Button onClick={() => navigate('/jual')} icon={<ShoppingBag size={16} />}>Jual</Button>}
      />

      <div className="stat-strip stat-strip--3">
        <Stat label="Total transaksi" value={entries.length} icon={<ReceiptText size={18} />} tone="green" hint={`${state.sales.length} jual · ${entries.length - state.sales.length} titip`} />
        <Stat label="Total nilai" value={formatMoney(total)} icon={<Banknote size={18} />} hint="Dari transaksi selesai" />
        <Stat label="Belum tertagih" value={formatMoney(outstanding)} icon={<Wallet size={18} />} tone={outstanding ? 'gold' : 'plain'} hint={`${entries.filter((entry) => entry.outstanding > 0).length} transaksi`} />
      </div>

      <div className="list-toolbar">
        <Segmented
          ariaLabel="Filter transaksi"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Semua', count: entries.length },
            { value: 'sale', label: 'Jual', count: entries.filter((entry) => entry.type === 'sale').length },
            { value: 'consignment', label: 'Titip', count: entries.filter((entry) => entry.type === 'consignment').length },
            { value: 'unpaid', label: 'Belum lunas', count: entries.filter((entry) => entry.outstanding > 0).length },
          ]}
        />
        <div className="list-toolbar__search"><SearchField value={search} onChange={setSearch} placeholder="Cari kode / warung…" /></div>
      </div>

      {grouped.length ? (
        <div className="history-groups">
          {grouped.map(([key, rows]) => (
            <section className="history-group" key={key}>
              <div className="history-group__date"><span>{dayLabel(key)}</span><i /> <small>{rows.length} transaksi</small></div>
              <Card className="history-card">
                {rows.map((entry) => (
                  <button
                    type="button"
                    className="history-entry"
                    key={`${entry.type}-${entry.id}`}
                    onClick={() => {
                      if (entry.type === 'consignment') navigate(`/titip/${entry.id}`);
                      else if (entry.sale) setSelectedSale(entry.sale);
                    }}
                  >
                    <span className={`history-entry__icon ${entry.type === 'consignment' ? 'is-gold' : ''}`}>
                      {entry.type === 'consignment' ? <PackageCheck size={18} /> : <ShoppingBag size={18} />}
                    </span>
                    <div className="history-entry__body">
                      <strong>{entry.warungName}</strong>
                      <span>{entry.code} · {entry.type === 'consignment' ? 'Titipan' : 'Jual langsung'} · {formatTime(entry.date)}</span>
                    </div>
                    <div className="history-entry__amount">
                      <strong>{formatMoney(entry.total)}</strong>
                      {entry.outstanding ? <small className="text-danger">Sisa {formatMoney(entry.outstanding, { compact: true })}</small> : <small className="text-success">Lunas</small>}
                    </div>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <Card className="no-border">
          <EmptyState
            illustration={<EmptyBowl size={54} />}
            title={search ? 'Transaksi tidak ditemukan' : filter === 'unpaid' ? 'Semua transaksi lunas' : 'Belum ada transaksi'}
            description={search ? 'Coba kata kunci lain.' : 'Transaksi jual dan titipan akan tersimpan di sini.'}
            action={!search && filter === 'all' ? <Button onClick={() => navigate('/jual')} icon={<ShoppingBag size={16} />}>Catat penjualan</Button> : undefined}
          />
        </Card>
      )}

      <Sheet
        open={Boolean(selectedSale)}
        onClose={() => setSelectedSale(null)}
        title={selectedSale?.code ?? 'Transaksi'}
        description={selectedSale ? `${formatDate(selectedSale.date)} · ${formatTime(selectedSale.date)}` : ''}
        footer={selectedSale ? <Button full variant="secondary" onClick={() => { setSelectedSale(null); if (selectedSale.warungId) navigate(`/warung/${selectedSale.warungId}`); }}>Buka warung</Button> : null}
      >
        {selectedSale ? <SaleDetail sale={selectedSale} /> : null}
      </Sheet>
    </div>
  );
}

function SaleDetail({ sale }: { sale: Sale }) {
  const { state } = useStore();
  const paid = paymentTotal(state, 'sale', sale.id);
  const outstanding = Math.max(0, sale.total - paid);
  const payments = state.payments.filter((payment) => payment.refType === 'sale' && payment.refId === sale.id);
  return (
    <div className="sale-detail-sheet">
      <div className="sale-detail-sheet__buyer"><span>Pembeli</span><strong>{sale.buyerName}</strong></div>
      <div className="sale-detail-sheet__items">
        {sale.items.map((item) => (
          <div key={item.productId}>
            <ProductMark name={item.name} size="xs" />
            <span>{item.qty}× {item.name}</span>
            <strong>{formatMoney(item.qty * item.price)}</strong>
          </div>
        ))}
      </div>
      <div className="sale-detail-sheet__total"><span>Total</span><strong>{formatMoney(sale.total)}</strong></div>
      <div className="sale-detail-sheet__payment"><span>Dibayar</span><strong>{formatMoney(paid)}</strong></div>
      {outstanding > 0 ? <div className="sale-detail-sheet__payment is-due"><span>Sisa piutang</span><strong>{formatMoney(outstanding)}</strong></div> : null}
      <div className="sale-detail-sheet__payment"><span>Status</span><Badge tone={outstanding ? 'gold' : 'green'}>{outstanding ? 'Belum lunas' : 'Lunas'}</Badge></div>
      {payments.length ? (
        <div className="sale-detail-sheet__payments">
          {payments.map((payment) => (
            <div key={payment.id}><CheckCircle2 size={14} /><span>{formatMoney(payment.amount)} · {payment.method}</span><small>{relativeLabel(payment.date)}</small></div>
          ))}
        </div>
      ) : null}
      {sale.note ? <p className="sale-detail-sheet__note">{sale.note}</p> : null}
    </div>
  );
}
