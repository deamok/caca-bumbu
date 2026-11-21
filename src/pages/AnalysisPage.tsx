import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Lightbulb,
  Package,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProductMark,
  SectionHeader,
  Segmented,
  Stat,
} from '../components/ui';
import { EmptyBowl } from '../components/Brand';
import { Donut, PurchaseBars, RevenueArea } from '../components/charts';
import { navigate } from '../lib/router';
import { formatDate, periodRange, startOfMonthKey, todayKey } from '../lib/date';
import { formatMoney, formatNumber, percent } from '../lib/format';
import {
  dailySeries,
  ingredientSpend,
  productPerformance,
  purchaseSeries,
  summaryForRange,
} from '../lib/analytics';

type AnalysisPeriod = '7d' | '30d' | 'month';

export function AnalysisPage() {
  const { state } = useStore();
  const [period, setPeriod] = useState<AnalysisPeriod>('30d');
  const range = useMemo(() => {
    if (period === 'month') {
      const from = startOfMonthKey();
      return { from, to: todayKey(), days: Math.max(1, dailySeries(state, 31).length) };
    }
    return periodRange(period);
  }, [period, state]);
  const days = period === 'month'
    ? Math.max(1, Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86_400_000) + 1)
    : period === '7d' ? 7 : 30;
  const summary = summaryForRange(state, range.from, range.to);
  const series = dailySeries(state, days);
  const products = productPerformance(state, range.from, range.to);
  const ingredients = ingredientSpend(state, range.from, range.to);
  const purchases = purchaseSeries(state, Math.min(14, days));
  const topProduct = products[0];
  const soldQty = products.reduce((sum, product) => sum + product.qty, 0);
  const mix = { direct: summary.directRevenue, consignment: summary.consignmentRevenue };
  const directPercent = summary.revenue ? Math.round((mix.direct / summary.revenue) * 100) : 0;
  const hppConfigured = state.products.filter((product) => product.active).every((product) => product.hpp > 0);
  const insights = buildInsights(summary, topProduct);

  return (
    <div className="analysis-page">
      <PageHeader
        eyebrow="Analisa usaha"
        title="Tumbuh dengan angka"
        description="Pahami bumbu yang laku, sumber omzet, dan pengeluaran bahan."
        action={
          <Segmented
            ariaLabel="Periode analisa"
            value={period}
            onChange={setPeriod}
            options={[
              { value: '7d', label: '7 hari' },
              { value: '30d', label: '30 hari' },
              { value: 'month', label: 'Bulan ini' },
            ]}
          />
        }
      />

      <div className="analysis-range">
        <CalendarDays size={15} />
        <span>{formatDate(range.from)} – {formatDate(range.to)}</span>
        <Badge tone={summary.growth >= 0 ? 'green' : 'red'}>
          {summary.growth >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {summary.growth >= 0 ? '+' : ''}{summary.growth}% vs periode sebelumnya
        </Badge>
      </div>

      <div className="stat-strip">
        <Stat
          label="Omzet"
          value={formatMoney(summary.revenue)}
          icon={<CircleDollarSign size={18} />}
          tone="green"
          hint={<span className={summary.growth >= 0 ? 'text-success' : 'text-danger'}>{summary.growth >= 0 ? 'Naik' : 'Turun'} {Math.abs(summary.growth)}% dari periode sebelumnya</span>}
        />
        <Stat label="Bumbu terjual" value={`${formatNumber(summary.qty)} pack`} icon={<Package size={18} />} hint={`${summary.transactions} transaksi`} />
        <Stat label="Rata-rata transaksi" value={formatMoney(summary.average)} icon={<ShoppingBag size={18} />} hint="Per transaksi" />
        <Stat
          label="Estimasi laba kotor"
          value={hppConfigured ? formatMoney(summary.profit) : 'Isi HPP'}
          icon={<Sparkles size={18} />}
          tone="gold"
          hint={hppConfigured ? 'Omzet dikurangi HPP' : 'Lengkapi HPP produk dulu'}
        />
      </div>

      <div className="analysis-grid">
        <Card className="analysis-chart-card">
          <div className="analysis-chart-card__head">
            <div>
              <span className="card-kicker">Tren omzet</span>
              <h2>{period === '7d' ? '7 hari terakhir' : period === 'month' ? 'Bulan ini' : '30 hari terakhir'}</h2>
            </div>
            <div className="analysis-chart-card__legend">
              <span><i /> Omzet</span>
            </div>
          </div>
          {series.some((point) => point.revenue > 0) ? (
            <RevenueArea data={series} idPrefix="analysis" />
          ) : (
            <EmptyState compact illustration={<EmptyBowl size={42} />} title="Belum ada omzet di periode ini" description="Coba periode lain atau catat penjualan." />
          )}
          <div className="analysis-chart-card__foot">
            <span><strong>{formatMoney(summary.directRevenue)}</strong> jual langsung</span>
            <span><strong>{formatMoney(summary.consignmentRevenue)}</strong> titipan</span>
            <span><strong>{formatMoney(summary.purchases)}</strong> belanja bahan</span>
          </div>
        </Card>

        <Card className="mix-card">
          <SectionHeader title="Sumber omzet" description="Jual langsung vs titipan" />
          <div className="mix-card__body">
            <Donut direct={mix.direct} consignment={mix.consignment} size={148} />
            <div className="mix-legend">
              <div><span><i className="legend-dot legend-dot--green" /> Jual langsung</span><strong>{formatMoney(mix.direct)}</strong><small>{directPercent}%</small></div>
              <div><span><i className="legend-dot legend-dot--gold" /> Titipan warung</span><strong>{formatMoney(mix.consignment)}</strong><small>{100 - directPercent}%</small></div>
            </div>
          </div>
          <div className="mix-card__note">
            <Lightbulb size={16} />
            <p>{directPercent > 60 ? 'Penjualan langsung mendominasi. Jaga stok siap jual di rumah.' : mix.consignment > mix.direct ? 'Titipan jadi sumber omzet utama. Pantau jadwal kunjungan warung.' : 'Omzet berimbang dari jual langsung dan titipan.'}</p>
          </div>
        </Card>
      </div>

      <div className="analysis-grid analysis-grid--lower">
        <Card className="product-performance-card">
          <SectionHeader
            title="Performa bumbu"
            description={`${soldQty} pack terjual di periode ini`}
            action={<Badge tone="green">{products.length} jenis</Badge>}
          />
          {products.length ? (
            <div className="performance-table">
              <div className="performance-table__head"><span>Bumbu</span><span>Terjual</span><span>Omzet</span><span>Kontribusi</span></div>
              {products.map((product, index) => {
                const share = percent(product.revenue, summary.revenue);
                return (
                  <div className="performance-table__row" key={product.productId}>
                    <span className="performance-table__product">
                      <span className="performance-table__rank">{index + 1}</span>
                      <ProductMark name={product.name} tone={product.tone} size="xs" />
                      <strong>{product.name}</strong>
                    </span>
                    <span>{product.qty} pack</span>
                    <strong>{formatMoney(product.revenue)}</strong>
                    <span className="performance-table__share"><i style={{ width: `${Math.max(3, share)}%` }} /><small>{share}%</small></span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState compact illustration={<EmptyBowl size={42} />} title="Belum ada penjualan" />
          )}
        </Card>

        <Card className="insight-card">
          <SectionHeader title="Yang perlu diperhatikan" description="Rangkuman otomatis dari data usaha" />
          <div className="insight-list">
            {insights.map((insight) => (
              <div className={`insight ${insight.tone === 'warn' ? 'is-warn' : insight.tone === 'good' ? 'is-good' : ''}`} key={insight.title}>
                <span className="insight__icon">{insight.icon}</span>
                <div><strong>{insight.title}</strong><p>{insight.body}</p></div>
              </div>
            ))}
          </div>
          {!hppConfigured ? (
            <div className="insight-card__cta">
              <span>Lengkapi HPP untuk melihat estimasi laba.</span>
              <Button size="sm" variant="secondary" onClick={() => navigate('/produk')}>Atur HPP <ArrowRight size={14} /></Button>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="analysis-grid analysis-grid--lower">
        <Card className="purchase-analysis-card">
          <SectionHeader
            title="Pembelian bahan"
            description="Pengeluaran 14 hari terakhir"
            action={<Button variant="ghost" size="sm" onClick={() => navigate('/bahan')} iconAfter={<ArrowRight size={14} />}>Detail</Button>}
          />
          <div className="purchase-analysis-card__total">
            <span>Total belanja periode ini</span>
            <strong>{formatMoney(summary.purchases)}</strong>
            <small>{ingredients.length} jenis bahan</small>
          </div>
          {purchases.some((point) => point.total > 0) ? <PurchaseBars data={purchases} height={130} /> : <p className="muted-copy">Belum ada belanja pada periode ini.</p>}
          <Button full variant="secondary" size="sm" onClick={() => navigate('/bahan/beli')} icon={<ReceiptText size={15} />}>Catat belanja baru</Button>
        </Card>

        <Card className="ingredient-analysis-card">
          <SectionHeader title="Bahan terbesar" description="Berdasarkan total belanja" action={<Badge tone="neutral">{ingredients.length} bahan</Badge>} />
          {ingredients.length ? (
            <div className="ingredient-ranking">
              {ingredients.slice(0, 5).map((item, index) => (
                <div key={item.ingredientId}>
                  <span className="ingredient-ranking__rank">{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{item.name}</strong><span>{formatNumber(item.qty, 1)} {item.unit} · terakhir {formatMoney(item.lastPrice)}/{item.unit}</span></div>
                  <strong>{formatMoney(item.total, { compact: true })}</strong>
                </div>
              ))}
            </div>
          ) : <p className="muted-copy">Belum ada data pembelian bahan.</p>}
          <Button full variant="ghost" size="sm" onClick={() => navigate('/bahan')} iconAfter={<ChevronRight size={14} />}>Lihat semua bahan</Button>
        </Card>
      </div>
    </div>
  );
}

function buildInsights(
  summary: ReturnType<typeof summaryForRange>,
  topProduct: ReturnType<typeof productPerformance>[number] | undefined,
) {
  const insights: Array<{ title: string; body: string; icon: React.ReactNode; tone: 'good' | 'warn' | 'info' }> = [];
  if (topProduct) {
    insights.push({
      title: `${topProduct.name} paling laku`,
      body: `${topProduct.qty} pack terjual dan menyumbang ${percent(topProduct.revenue, summary.revenue)}% omzet periode ini.`,
      icon: <Sparkles size={18} />,
      tone: 'good',
    });
  }
  if (summary.receivable > 0) {
    insights.push({
      title: `${formatMoney(summary.receivable)} belum tertagih`,
      body: 'Cek warung yang masih punya sisa setoran saat kunjungan berikutnya.',
      icon: <Wallet size={18} />,
      tone: 'warn',
    });
  }
  if (summary.purchases > summary.revenue * 0.5 && summary.revenue > 0) {
    insights.push({
      title: 'Belanja bahan cukup besar',
      body: `Belanja bahan ${formatMoney(summary.purchases)} setara ${percent(summary.purchases, summary.revenue)}% omzet. Tinjau harga bahan dan porsi produksi.`,
      icon: <ReceiptText size={18} />,
      tone: 'warn',
    });
  }
  if (summary.transactions > 0 && summary.growth > 0) {
    insights.push({
      title: 'Penjualan naik',
      body: `Omzet naik ${summary.growth}% dibanding periode sebelumnya. Pertahankan stok bumbu favorit.`,
      icon: <TrendingUp size={18} />,
      tone: 'good',
    });
  }
  if (!insights.length) {
    insights.push({
      title: 'Mulai kumpulkan data',
      body: 'Setiap penjualan dan titipan yang dicatat akan membantu analisa usaha Ibu.',
      icon: <BarChart3 size={18} />,
      tone: 'info',
    });
  }
  return insights;
}
