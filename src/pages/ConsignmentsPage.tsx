import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, PackageCheck, Plus, Wallet } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { Badge, Button, Card, EmptyState, PageHeader, SearchField, Segmented, Stat } from '../components/ui';
import { EmptyBowl } from '../components/Brand';
import { ConsignmentCard } from '../components/ConsignmentCard';
import { navigate } from '../lib/router';
import { activeConsignments, consignmentOutstandingValue, lateConsignments } from '../lib/domain';
import { formatMoney } from '../lib/format';
import { dueLabel } from '../lib/date';

type Filter = 'aktif' | 'tempo' | 'selesai';

export function ConsignmentsPage() {
  const { state } = useStore();
  const [filter, setFilter] = useState<Filter>('aktif');
  const [search, setSearch] = useState('');
  const active = activeConsignments(state);
  const late = lateConsignments(state);
  const dueSoon = active.filter((item) => dueLabel(item.dueDate) === 'Hari ini' || dueLabel(item.dueDate) === 'Besok');
  const completed = state.consignments
    .filter((item) => item.status === 'selesai')
    .sort((a, b) => (b.closedAt ?? b.date).localeCompare(a.closedAt ?? a.date));
  const activeValue = active.reduce((sum, item) => sum + consignmentOutstandingValue(item), 0);
  const totalPaid = state.payments
    .filter((payment) => payment.refType === 'consignment')
    .reduce((sum, payment) => sum + payment.amount, 0);

  const source = filter === 'aktif' ? active : filter === 'tempo' ? [...late, ...dueSoon.filter((item) => !late.includes(item))] : completed;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return source;
    return source.filter((consignment) => {
      const warung = state.warungs.find((item) => item.id === consignment.warungId);
      return warung?.name.toLowerCase().includes(term) || consignment.code.toLowerCase().includes(term);
    });
  }, [source, search, state.warungs]);

  return (
    <div className="consignments-page">
      <PageHeader
        eyebrow="Titipan"
        title="Titipan warung"
        description="Antar, hitung yang laku, terima setoran, lalu titip lagi."
        action={<Button onClick={() => navigate('/titip/baru')} icon={<Plus size={17} />}>Titip baru</Button>}
      />

      <div className="stat-strip">
        <Stat label="Titipan aktif" value={active.length} icon={<PackageCheck size={18} />} tone="green" hint={`${active.reduce((sum, item) => sum + item.items.reduce((n, line) => n + line.sentQty, 0), 0)} pack di warung`} />
        <Stat label="Perlu dikunjungi" value={late.length + dueSoon.length} icon={<CalendarDays size={18} />} tone={late.length ? 'red' : 'gold'} hint={late.length ? `${late.length} terlambat` : 'Hari ini & besok'} />
        <Stat label="Nilai titipan" value={formatMoney(activeValue)} icon={<Wallet size={18} />} hint="Harga jual di warung" />
        <Stat label="Total setoran" value={formatMoney(totalPaid)} icon={<ArrowRight size={18} />} hint="Dari titipan selesai" />
      </div>

      {late.length ? (
        <div className="alert-banner">
          <span><AlertTriangle size={20} /></span>
          <div>
            <strong>{late.length} titipan sudah lewat jadwal</strong>
            <p>Kunjungi warung untuk menghitung sisa bumbu dan menerima setoran.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setFilter('tempo')}>Lihat</Button>
        </div>
      ) : null}

      <div className="list-toolbar">
        <Segmented
          ariaLabel="Filter titipan"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'aktif', label: 'Aktif', count: active.length },
            { value: 'tempo', label: 'Jatuh tempo', count: late.length + dueSoon.length },
            { value: 'selesai', label: 'Selesai', count: completed.length },
          ]}
        />
        <div className="list-toolbar__search">
          <SearchField value={search} onChange={setSearch} placeholder="Cari warung / kode…" />
        </div>
      </div>

      {filtered.length ? (
        <div className="consignment-grid">
          {filtered.map((consignment) => {
            const warung = state.warungs.find((item) => item.id === consignment.warungId);
            return (
              <ConsignmentCard
                key={consignment.id}
                consignment={consignment}
                warung={warung}
                state={state}
                onClick={() => navigate(`/titip/${consignment.id}`)}
              />
            );
          })}
        </div>
      ) : (
        <Card className="no-border">
          <EmptyState
            illustration={<EmptyBowl size={54} />}
            title={search ? 'Titipan tidak ditemukan' : filter === 'selesai' ? 'Belum ada titipan selesai' : 'Belum ada titipan'}
            description={
              search
                ? 'Coba cari dengan nama warung atau kode titipan lain.'
                : filter === 'selesai'
                  ? 'Setelah kunjungan dihitung, riwayatnya tersimpan di sini.'
                  : 'Mulai dengan mengantar bumbu ke warung langganan.'
            }
            action={!search && filter !== 'selesai' ? <Button onClick={() => navigate('/titip/baru')} icon={<Plus size={16} />}>Buat titipan pertama</Button> : undefined}
          />
        </Card>
      )}

      <div className="page-note">
        <Badge tone="gold">Cara kerja titipan</Badge>
        <p>Stok berkurang saat bumbu dititipkan. Saat kunjungan, masukkan jumlah laku dan rusak — sisa yang kembali otomatis masuk stok lagi.</p>
      </div>
    </div>
  );
}
