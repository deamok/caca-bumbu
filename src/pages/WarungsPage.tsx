import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  MapPin,
  PackageCheck,
  Phone,
  Plus,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { useLocation, navigate } from '../lib/router';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SearchField,
  Stat,
} from '../components/ui';
import { EmptyBowl } from '../components/Brand';
import { WarungFormSheet } from '../components/WarungFormSheet';
import { outstandingTotal } from '../lib/domain';
import { warungMetrics } from '../lib/analytics';
import { formatMoney } from '../lib/format';
import { relativeLabel } from '../lib/date';

export function WarungsPage() {
  const { state } = useStore();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(location.query.get('new') === '1');

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return state.warungs
      .map((warung) => ({ warung, metrics: warungMetrics(state, warung.id) }))
      .filter(({ warung }) => {
        if (!term) return true;
        return [warung.name, warung.owner, warung.address, warung.phone].some((value) => value.toLowerCase().includes(term));
      })
      .sort((a, b) => {
        if (a.metrics.active !== b.metrics.active) return b.metrics.active - a.metrics.active;
        if (a.metrics.outstanding !== b.metrics.outstanding) return b.metrics.outstanding - a.metrics.outstanding;
        return (b.metrics.lastActivity ?? '').localeCompare(a.metrics.lastActivity ?? '');
      });
  }, [state, search]);

  const totalReceivable = outstandingTotal(state);
  const activeCount = state.consignments.filter((consignment) => consignment.status === 'aktif').length;

  const closeForm = () => {
    setFormOpen(false);
    if (location.query.get('new') === '1') navigate('/warung', { replace: true });
  };

  return (
    <div className="warungs-page">
      <PageHeader
        eyebrow="Jaringan warung"
        title="Warung langganan"
        description="Simpan kontak, pantau piutang, dan lihat riwayat tiap warung."
        action={<Button onClick={() => setFormOpen(true)} icon={<Plus size={17} />}>Tambah warung</Button>}
      />

      <div className="stat-strip stat-strip--3">
        <Stat label="Warung terdaftar" value={state.warungs.length} icon={<Store size={18} />} tone="green" hint="Langganan aktif" />
        <Stat label="Titipan berjalan" value={activeCount} icon={<PackageCheck size={18} />} hint="Bumbu masih di warung" />
        <Stat label="Total piutang" value={formatMoney(totalReceivable)} icon={<Wallet size={18} />} tone={totalReceivable ? 'gold' : 'plain'} hint="Belum dibayar" />
      </div>

      <div className="list-toolbar list-toolbar--simple">
        <SearchField value={search} onChange={setSearch} placeholder="Cari warung, pemilik, atau alamat…" />
        <span className="list-toolbar__result">{rows.length} warung</span>
      </div>

      {rows.length ? (
        <div className="warung-grid">
          {rows.map(({ warung, metrics }) => (
            <button type="button" className="warung-card" key={warung.id} onClick={() => navigate(`/warung/${warung.id}`)}>
              <div className="warung-card__head">
                <Avatar name={warung.name} size="md" />
                <div className="warung-card__title">
                  <strong>{warung.name}</strong>
                  <span>{warung.owner ? `Pemilik: ${warung.owner}` : 'Pemilik belum dicatat'}</span>
                </div>
                <ChevronRight size={17} className="warung-card__arrow" />
              </div>
              <div className="warung-card__badges">
                {metrics.active ? <Badge tone="green" dot>{metrics.active} titipan aktif</Badge> : <Badge tone="neutral">Tidak ada titipan</Badge>}
                {metrics.outstanding ? <Badge tone="gold">{formatMoney(metrics.outstanding, { compact: true })} piutang</Badge> : <Badge tone="green">Lunas</Badge>}
              </div>
              <div className="warung-card__meta">
                {warung.address ? <span><MapPin size={14} /> {warung.address}</span> : <span><MapPin size={14} /> Alamat belum diisi</span>}
                {warung.phone ? <span><Phone size={14} /> {warung.phone}</span> : null}
              </div>
              <div className="warung-card__footer">
                <div><span>Total belanja</span><strong>{formatMoney(metrics.totalSpend, { compact: true })}</strong></div>
                <div><span>Terakhir</span><strong>{metrics.lastActivity ? relativeLabel(metrics.lastActivity) : 'Belum ada'}</strong></div>
                <span className="warung-card__cta">Buka <ArrowRight size={14} /></span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card className="no-border">
          <EmptyState
            illustration={<EmptyBowl size={54} />}
            title={search ? 'Warung tidak ditemukan' : 'Belum ada warung'}
            description={search ? 'Coba kata kunci lain.' : 'Tambahkan warung langganan untuk mulai mencatat penjualan dan titipan.'}
            action={search ? <Button variant="secondary" onClick={() => setSearch('')}>Hapus pencarian</Button> : <Button onClick={() => setFormOpen(true)} icon={<Plus size={16} />}>Tambah warung pertama</Button>}
          />
        </Card>
      )}

      <div className="page-note">
        <Users size={17} />
        <p>Klik kartu warung untuk melihat titipan aktif, tagihan, dan riwayat lengkapnya.</p>
      </div>

      <WarungFormSheet open={formOpen} onClose={closeForm} />
    </div>
  );
}
