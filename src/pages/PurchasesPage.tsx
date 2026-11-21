import { useMemo, useState } from 'react';
import {
  ChevronRight,
  CircleDollarSign,
  PackageSearch,
  Plus,
  ReceiptText,
  Sparkles,
  Store,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
  Stat,
} from '../components/ui';
import { EmptyBowl } from '../components/Brand';
import { PurchaseBars } from '../components/charts';
import { navigate } from '../lib/router';
import { formatDate, periodRange, relativeLabel, todayKey } from '../lib/date';
import { formatMoney, formatNumber, percent } from '../lib/format';
import {
  ingredientSpend,
  purchaseSeries,
  purchaseSummary,
} from '../lib/analytics';

export function PurchasesPage() {
  const { state } = useStore();
  const summary = purchaseSummary(state);
  const spend30 = ingredientSpend(state, periodRange('30d').from, todayKey());
  const series = purchaseSeries(state, 14);
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of spend30) map.set(item.category, (map.get(item.category) ?? 0) + item.total);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [spend30]);
  const topCategory = categories[0];
  const purchases = state.purchases.slice().sort((a, b) => b.date.localeCompare(a.date));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = purchases.find((purchase) => purchase.id === selectedId);

  return (
    <div className="purchases-page">
      <PageHeader
        eyebrow="Bahan & belanja"
        title="Belanja bahan"
        description="Catat pembelian bahan dapur dan lihat ke mana uang belanja pergi."
        action={<Button onClick={() => navigate('/bahan/beli')} icon={<Plus size={17} />}>Catat belanja</Button>}
      />

      <div className="stat-strip">
        <Stat label="Belanja bulan ini" value={formatMoney(summary.thisMonth)} icon={<CircleDollarSign size={18} />} tone="green" hint={<span className={summary.growth >= 0 ? 'text-gold' : 'text-success'}>{summary.growth >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {Math.abs(summary.growth)}% vs bulan lalu</span>} />
        <Stat label="Transaksi belanja" value={summary.count} icon={<ReceiptText size={18} />} hint="Bulan ini" />
        <Stat label="Bahan terdata" value={state.ingredients.length} icon={<PackageSearch size={18} />} hint={`${spend30.length} dibeli 30 hari terakhir`} />
        <Stat label="Kategori terbesar" value={topCategory?.[0] ?? '—'} icon={<Sparkles size={18} />} tone="gold" hint={topCategory ? formatMoney(topCategory[1]) : 'Belum ada belanja'} />
      </div>

      <div className="purchase-top-grid">
        <Card className="purchase-chart-card">
          <SectionHeader title="Belanja 14 hari" description="Pengeluaran bahan harian" action={<Badge tone="neutral">{formatMoney(series.reduce((sum, point) => sum + point.total, 0))}</Badge>} />
          <PurchaseBars data={series} height={145} />
          <div className="chart-card__legend"><span><i className="legend-dot legend-dot--green" /> Total belanja harian</span></div>
        </Card>
        <Card className="category-card">
          <SectionHeader title="Kategori belanja" description="30 hari terakhir" />
          {categories.length ? (
            <div className="category-list">
              {categories.map(([category, total], index) => {
                const max = categories[0][1] || 1;
                return (
                  <div key={category}>
                    <div><span>{category}</span><strong>{formatMoney(total, { compact: true })}</strong></div>
                    <div className="category-bar"><span style={{ width: `${Math.max(4, percent(total, max))}%` }} className={`category-bar__fill category-bar__fill--${index % 3}`} /></div>
                  </div>
                );
              })}
            </div>
          ) : <p className="muted-copy">Belum ada data kategori.</p>}
        </Card>
      </div>

      <Card>
        <SectionHeader title="Bahan paling banyak dibeli" description="Berdasarkan total belanja 30 hari terakhir" action={<Badge tone="green">{spend30.length} bahan</Badge>} />
        {spend30.length ? (
          <div className="ingredient-grid">
            {spend30.slice(0, 8).map((item, index) => (
              <div className="ingredient-card" key={item.ingredientId}>
                <span className="ingredient-card__rank">{String(index + 1).padStart(2, '0')}</span>
                <div className="ingredient-card__head">
                  <strong>{item.name}</strong>
                  <Badge tone="neutral">{item.category}</Badge>
                </div>
                <div className="ingredient-card__stats">
                  <div><span>Total belanja</span><strong>{formatMoney(item.total)}</strong></div>
                  <div><span>Jumlah</span><strong>{formatNumber(item.qty, 1)} {item.unit}</strong></div>
                </div>
                <div className="ingredient-card__foot">
                  <span>Harga terakhir <strong>{formatMoney(item.lastPrice)}/{item.unit}</strong></span>
                  <span>{relativeLabel(item.lastDate)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact illustration={<EmptyBowl size={44} />} title="Belum ada belanja bahan" description="Catat belanja pertama untuk melihat analisa harga bahan." action={<Button size="sm" onClick={() => navigate('/bahan/beli')}>Catat belanja</Button>} />
        )}
      </Card>

      <Card>
        <SectionHeader title="Riwayat belanja" description={`${purchases.length} catatan belanja`} />
        {purchases.length ? (
          <div className="purchase-history">
            {purchases.map((purchase) => (
              <button type="button" className="purchase-history__row" key={purchase.id} onClick={() => setSelectedId(purchase.id)}>
                <span className="purchase-history__icon"><Store size={17} /></span>
                <div>
                  <strong>{purchase.supplier}</strong>
                  <span>{formatDate(purchase.date)} · {purchase.items.length} bahan · {purchase.code}</span>
                </div>
                <div className="purchase-history__items">
                  {purchase.items.slice(0, 2).map((item) => <Badge key={item.ingredientId} tone="neutral">{item.name}</Badge>)}
                  {purchase.items.length > 2 ? <Badge tone="neutral">+{purchase.items.length - 2}</Badge> : null}
                </div>
                <strong>{formatMoney(purchase.total)}</strong>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState compact illustration={<EmptyBowl size={44} />} title="Belanja belum tercatat" />
        )}
      </Card>

      {selected ? (
        <div className="inline-purchase-detail">
          <Card>
            <div className="inline-purchase-detail__head">
              <div>
                <span className="eyebrow">{selected.code}</span>
                <h2>{selected.supplier}</h2>
                <p>{formatDate(selected.date, 'long')} · {selected.items.length} bahan</p>
              </div>
              <div>
                <span>Total</span>
                <strong>{formatMoney(selected.total)}</strong>
              </div>
            </div>
            <div className="inline-purchase-detail__rows">
              {selected.items.map((item) => (
                <div key={`${selected.id}-${item.ingredientId}`}>
                  <span>{item.name}</span>
                  <span>{formatNumber(item.qty, 1)} {item.unit} × {formatMoney(item.unitPrice)}</span>
                  <strong>{formatMoney(item.total)}</strong>
                </div>
              ))}
            </div>
            {selected.note ? <p className="muted-copy">{selected.note}</p> : null}
            <Button size="sm" variant="secondary" onClick={() => setSelectedId(null)}>Tutup rincian</Button>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
