import { CloudOff, Cloud, RefreshCw, TriangleAlert } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useSync } from '../store/SyncContext';
import type { SyncStatus } from '../store/SyncContext';
import { Badge, type BadgeTone } from './ui';

export interface SyncSummary {
  label: string;
  detail: string;
  tone: BadgeTone;
  offline: boolean;
}

const LABELS: Record<SyncStatus, { label: string; detail: string; tone: BadgeTone }> = {
  disabled: { label: 'Lokal di HP ini', detail: 'Sinkronisasi cloud belum aktif.', tone: 'neutral' },
  'signed-out': { label: 'Belum masuk', detail: 'Masuk untuk menyimpan data di cloud.', tone: 'neutral' },
  offline: { label: 'Mode luring', detail: 'Perubahan menunggu sinyal untuk dikirim.', tone: 'gold' },
  syncing: { label: 'Menyinkronkan…', detail: 'Mengirim dan mengambil data terbaru.', tone: 'blue' },
  pending: { label: 'Menunggu sinkron', detail: 'Perubahan akan dikirim sebentar lagi.', tone: 'gold' },
  synced: { label: 'Tersinkron', detail: 'Data di HP dan cloud sudah sama.', tone: 'green' },
  error: { label: 'Sinkron gagal', detail: 'Periksa koneksi lalu coba lagi.', tone: 'red' },
};

export function useSyncSummary(): SyncSummary {
  const { cloudEnabled, session, offline } = useAuth();
  const { status } = useSync();

  if (!cloudEnabled) return { ...LABELS.disabled, offline: true };
  if (!session) {
    return offline
      ? { ...LABELS.disabled, detail: 'Mode lokal aktif. Masuk kapan saja untuk sinkron.', offline: true }
      : { ...LABELS['signed-out'], offline: false };
  }
  const entry = LABELS[status] ?? LABELS['signed-out'];
  return { ...entry, offline: status === 'offline' };
}

export function SyncStatusBadge({ withIcon = true }: { withIcon?: boolean }) {
  const summary = useSyncSummary();
  return (
    <Badge tone={summary.tone} dot={!withIcon}>
      {withIcon ? <SyncIcon status={summary.tone} /> : null}
      {summary.label}
    </Badge>
  );
}

function SyncIcon({ status }: { status: BadgeTone }) {
  if (status === 'green') return <Cloud size={13} />;
  if (status === 'gold' || status === 'neutral') return <CloudOff size={13} />;
  if (status === 'red') return <TriangleAlert size={13} />;
  return <RefreshCw size={13} />;
}
