import {
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronRight,
  ClipboardList,
  HandCoins,
  Package,
  PackageCheck,
  Plus,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, ProductMark, Progress, SectionHeader } from '../components/ui';
import { EmptyBowl } from '../components/Brand';
import { RevenueBars } from '../components/charts';
import { useToast } from '../components/Toast';
import { navigate } from '../lib/router';
import { formatDate, formatDayMonth, greeting, dueLabel, todayKey } from '../lib/date';
import { formatMoney, normalizePhone } from '../lib/format';
import {
  activeConsignments,
  consignmentOutstandingValue,
  dueTodayConsignments,
  lateConsignments,
  lowStockProducts,
  outstandingInvoices,
  outstandingTotal,
} from '../lib/domain';
import { dailySeries, productPerformance, todaySummary } from '../lib/analytics';
import { sharedCatalogUrl } from '../lib/catalog';
import { useShare } from '../lib/hooks';

export function DashboardPage() {
  const { state } = useStore();
  const { notify } = useToast();
  const share = useShare();
  const summary = todaySummary(state);
  const active = activeConsignments(state);
  const late = lateConsignments(state);
  const dueToday = dueTodayConsignments(state);
  const week = dailySeries(state, 7);
  const weekTotal = week.reduce((sum, point) => sum + point.revenue, 0);
  const topProducts = productPerformance(state, formatDateBack(30), todayKey()).slice(0, 3);
  const low = lowStockProducts(state).slice(0, 3);
  const receivables = outstandingInvoices(state).slice(0, 3);
  const receivable = outstandingTotal(state);
  const visits = [...active].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
  const noStock = state.products.filter((p) => p.active).every((p) => p.stock === 0);
  const owner = state.settings.ownerName || 'Ibu';

  const shareCatalog = async () => {
    if (!normalizePhone(state.settings.whatsapp)) {
      notify('Atur nomor WhatsApp dulu', { tone: 'error', message: 'Nomor ini dipakai untuk menerima pesanan dari katalog.' });
      navigate('/pengaturan');
      return;
    }
    const result = await share({
      title: 'Katalog Caca Bumbu',
      text: `Pesan bumbu rumahan dari ${state.settings.businessName}. Pilih bumbu, kirim pesanan lewat WhatsApp.`,
      url: sharedCatalogUrl(state),
    });
    if (result === 'copied') notify('Link katalog disalin', { message: 'Kirim ke warung lewat WhatsApp.' });
    if (result === 'failed') notify('Belum bisa membagikan link', { tone: 'error' });
  };

  return (
    <div className="dashboard">
      <PageHeader
        eyebrow={formatDate(todayKey(), 'full')}
        title={`${greeting()}, ${owner}`}
        description="Siap keliling warung hari ini? Semua catatan usaha ada di sini."
        action={
          <div className="dashboard__header-action">
            <Badge tone={state.meta.demo ? 'gold' : 'green'} dot>{state.meta.demo ? 'Mode data contoh' : 'Data tersimpan'}</Badge>
          </div>
        }
      />

      {noStock ? (
        <div className="setup-banner">
          <div className="setup-banner__icon"><Package size={21} /></div>
          <div>
            <strong>Atur stok awal dulu, yuk</strong>
            <p>Stok masih kosong. Isi jumlah pack yang siap dijual agar catatan stok akurat.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/produk')}>Atur stok</Button>
        </div>
      ) : null}

      <section className="hero-card">
        <div className="hero-card__texture" aria-hidden="true" />
        <div className="hero-card__content">
          <div className="hero-card__eyebrow">
            <span className="hero-card__spark"><Sparkles size={14} /></span>
            Omzet hari ini
            <span className="hero-card__date">{formatDayMonth(todayKey())}</span>
          </div>
          <div className="hero-card__value">{formatMoney(summary.revenue)}</div>
          <div className="hero-card__trend">
            {summary.growth >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            <strong>{summary.growth >= 0 ? '+' : ''}{summary.growth}%</strong>
            <span>dibanding kemarin</span>
          </div>
          <div className="hero-card__stats">
            <div>
              <small>Transaksi hari ini</small>
              <strong>{summary.transactions}</strong>
            </div>
            <div>
              <small>Titipan perlu dikunjungi</small>
              <strong>{dueToday.length + late.length}</strong>
            </div>
            <div>
              <small>Piutang berjalan</small>
              <strong>{formatMoney(receivable, { compact: true })}</strong>
            </div>
          </div>
          <div className="hero-card__actions">
            <Button variant="gold" onClick={() => navigate('/jual')} icon={<ShoppingBag size={16} />}>Jual sekarang</Button>
            <button type="button" className="hero-link" onClick={() => navigate('/titip')}>
              Lihat titipan <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <div className="hero-card__art" aria-hidden="true">
          <EmptyBowl size={110} />
          <span className="hero-card__seed hero-card__seed--one" />
          <span className="hero-card__seed hero-card__seed--two" />
          <span className="hero-card__seed hero-card__seed--three" />
        </div>
      </section>

      <section className="quick-actions" aria-label="Aksi cepat">
        <button type="button" className="quick-action quick-action--green" onClick={() => navigate('/jual')}>
          <span><ShoppingBag size={20} /></span>
          <strong>Jual langsung</strong>
          <small>Catat penjualan tunai</small>
          <ChevronRight size={16} />
        </button>
        <button type="button" className="quick-action quick-action--gold" onClick={() => navigate('/titip/baru')}>
          <span><PackageCheck size={20} /></span>
          <strong>Buat titipan</strong>
          <small>Antar bumbu ke warung</small>
          <ChevronRight size={16} />
        </button>
        <button type="button" className="quick-action quick-action--clay" onClick={() => navigate('/bahan/beli')}>
          <span><ReceiptText size={20} /></span>
          <strong>Catat belanja</strong>
          <small>Bahan & bumbu dapur</small>
          <ChevronRight size={16} />
        </button>
        <button type="button" className="quick-action quick-action--blue" onClick={() => navigate('/analisa')}>
          <span><ChartNoAxesColumnIncreasing size={20} /></span>
          <strong>Lihat analisa</strong>
          <small>Laba & produk laris</small>
          <ChevronRight size={16} />
        </button>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-grid__main">
          <Card className="visit-card card--flush">
            <SectionHeader
              title="Kunjungan warung"
              description={active.length ? `${active.length} titipan masih berjalan` : 'Belum ada titipan berjalan'}
              action={<Button variant="ghost" size="sm" onClick={() => navigate('/titip')} iconAfter={<ArrowRight size={15} />}>Semua</Button>}
            />
            {visits.length ? (
              <div className="visit-list">
                {visits.map((consignment) => {
                  const warung = state.warungs.find((item) => item.id === consignment.warungId);
                  const diff = dueLabel(consignment.dueDate);
                  const isLate = consignment.dueDate < todayKey();
                  const isToday = consignment.dueDate === todayKey();
                  return (
                    <button
                      type="button"
                      className="visit-row"
                      key={consignment.id}
                      onClick={() => navigate(`/titip/${consignment.id}`)}
                    >
                      <Avatar name={warung?.name ?? 'Warung'} size="md" />
                      <div className="visit-row__body">
                        <strong>{warung?.name ?? 'Warung'}</strong>
                        <span>{consignment.items.length} jenis · {consignment.items.reduce((sum, item) => sum + item.sentQty, 0)} pack · {formatMoney(consignmentOutstandingValue(consignment), { compact: true })}</span>
                      </div>
                      <div className="visit-row__side">
                        <Badge tone={isLate ? 'red' : isToday ? 'gold' : 'neutral'} dot>{diff}</Badge>
                        <span className="visit-row__cta">Hitung <ChevronRight size={14} /></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                compact
                illustration={<EmptyBowl size={48} />}
                title="Belum ada titipan aktif"
                description="Buat titipan pertama ke warung langganan Ibu."
                action={<Button size="sm" variant="secondary" onClick={() => navigate('/titip/baru')} icon={<Plus size={15} />}>Buat titipan</Button>}
              />
            )}
          </Card>

          <div className="dash-split">
            <Card className="chart-card">
              <div className="chart-card__head">
                <div>
                  <span className="card-kicker">Penjualan 7 hari</span>
                  <strong className="chart-card__total">{formatMoney(weekTotal)}</strong>
                </div>
                <Badge tone="green">{week.reduce((sum, point) => sum + point.transactions, 0)} transaksi</Badge>
              </div>
              <RevenueBars data={week} height={156} showValue />
              <div className="chart-card__legend">
                <span><i className="legend-dot legend-dot--green" /> Omzet harian</span>
                <span><i className="legend-dot legend-dot--gold" /> Hari ini</span>
              </div>
            </Card>

            <Card className="debt-card">
              <div className="debt-card__head">
                <span className="card-kicker">Piutang warung</span>
                <span className="debt-card__icon"><HandCoins size={19} /></span>
              </div>
              <strong className="debt-card__value">{formatMoney(receivable)}</strong>
              <p>{receivables.length ? `${outstandingInvoices(state).length} tagihan belum lunas` : 'Semua tagihan aman'}</p>
              {receivables.length ? (
                <div className="debt-list">
                  {receivables.map((invoice) => (
                    <button type="button" key={`${invoice.refType}-${invoice.refId}`} onClick={() => navigate(invoice.warungId ? `/warung/${invoice.warungId}` : '/riwayat')}>
                      <span><strong>{invoice.customerName}</strong><small>{invoice.code}</small></span>
                      <b>{formatMoney(invoice.outstanding, { compact: true })}</b>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="debt-card__clear"><Check size={16} /> Tidak ada piutang</div>
              )}
              <button type="button" className="text-link" onClick={() => navigate('/warung')}>Lihat semua warung <ArrowRight size={14} /></button>
            </Card>
          </div>

          <Card className="product-rank-card">
            <SectionHeader
              title="Bumbu paling laku"
              description="Berdasarkan penjualan 30 hari terakhir"
              action={<Button variant="ghost" size="sm" onClick={() => navigate('/analisa')} iconAfter={<ArrowRight size={15} />}>Analisa</Button>}
            />
            {topProducts.length ? (
              <div className="product-rank">
                {topProducts.map((product, index) => {
                  const max = topProducts[0]?.qty || 1;
                  return (
                    <div className="product-rank__row" key={product.productId}>
                      <span className="product-rank__number">0{index + 1}</span>
                      <ProductMark name={product.name} tone={product.tone} size="sm" imageUrl={product.imageUrl} />
                      <div className="product-rank__body">
                        <div><strong>{product.name}</strong><span>{product.qty} pack</span></div>
                        <Progress value={product.qty} max={max} tone={index === 0 ? 'gold' : 'green'} />
                      </div>
                      <strong className="product-rank__revenue">{formatMoney(product.revenue, { compact: true })}</strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState compact illustration={<EmptyBowl size={44} />} title="Belum ada penjualan" description="Penjualan pertama akan muncul di sini." />
            )}
          </Card>
        </div>

        <aside className="dashboard-grid__side">
          <Card className="side-summary">
            <SectionHeader title="Ringkasan minggu ini" />
            <div className="mini-stats">
              <div><span>Omzet</span><strong>{formatMoney(weekTotal)}</strong></div>
              <div><span>Terjual</span><strong>{week.reduce((sum, point) => sum + point.qty, 0)} pack</strong></div>
              <div><span>Rata-rata</span><strong>{formatMoney(Math.round(weekTotal / 7))}/hari</strong></div>
            </div>
          </Card>

          <Card className="low-stock-card">
            <div className="low-stock-card__head">
              <div>
                <span className="card-kicker">Stok menipis</span>
                <h2>{low.length ? `${lowStockProducts(state).length} bumbu` : 'Stok aman'}</h2>
              </div>
              <span className={`low-stock-card__icon ${low.length ? 'is-warning' : ''}`}><Package size={19} /></span>
            </div>
            {low.length ? (
              <div className="low-stock-list">
                {low.map((product) => (
                  <button key={product.id} type="button" onClick={() => navigate('/produk')}>
                    <ProductMark name={product.name} tone={product.tone} size="xs" imageUrl={product.imageUrl} />
                    <span>{product.name}</span>
                    <Badge tone={product.stock === 0 ? 'red' : 'gold'}>{product.stock} {product.unit}</Badge>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted-copy">Semua stok di atas batas minimum {state.settings.lowStockThreshold} pack.</p>
            )}
            <button type="button" className="text-link" onClick={() => navigate('/produk')}>Kelola stok <ArrowRight size={14} /></button>
          </Card>

          <Card className="catalog-card">
            <span className="catalog-card__stamp"><Store size={20} /></span>
            <h2>Warung bisa pesan sendiri</h2>
            <p>Bagikan katalog. Pesanan masuk lewat WhatsApp, langsung Ibu catat di sini.</p>
            <Button variant="secondary" size="sm" full onClick={() => void shareCatalog()}>Bagikan katalog</Button>
          </Card>

          <Card className="quick-note">
            <div className="quick-note__icon"><ClipboardList size={18} /></div>
            <div>
              <strong>Tips hari ini</strong>
              <p>Hitung titipan saat mengantar stok baru supaya retur dan setoran tercatat sekali jalan.</p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function formatDateBack(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
