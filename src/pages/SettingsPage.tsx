import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CloudOff,
  Database,
  Download,
  FileJson,
  Info,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
  Store,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { useToast } from '../components/Toast';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  SectionHeader,
  Sheet,
  Textarea,
} from '../components/ui';
import { catalogUrl } from '../components/AppShell';
import { useInstallPrompt, useShare } from '../lib/hooks';
import { exportState, parseBackup } from '../lib/storage';
import { createDemoState } from '../data/seed';
import { navigate } from '../lib/router';
import type { AppState } from '../types';
import { normalizePhone } from '../lib/format';

type PendingAction =
  | { kind: 'reset' }
  | { kind: 'demo' }
  | { kind: 'import'; state: AppState }
  | null;

export function SettingsPage() {
  const { state, updateSettings, replaceState, resetAll } = useStore();
  const { notify } = useToast();
  const share = useShare();
  const { canInstall, installed, install } = useInstallPrompt();
  const fileRef = useRef<HTMLInputElement>(null);
  const [businessName, setBusinessName] = useState(state.settings.businessName);
  const [ownerName, setOwnerName] = useState(state.settings.ownerName);
  const [phone, setPhone] = useState(state.settings.phone);
  const [whatsapp, setWhatsapp] = useState(state.settings.whatsapp);
  const [address, setAddress] = useState(state.settings.address);
  const [threshold, setThreshold] = useState(state.settings.lowStockThreshold);
  const [pending, setPending] = useState<PendingAction>(null);

  useEffect(() => {
    setBusinessName(state.settings.businessName);
    setOwnerName(state.settings.ownerName);
    setPhone(state.settings.phone);
    setWhatsapp(state.settings.whatsapp);
    setAddress(state.settings.address);
    setThreshold(state.settings.lowStockThreshold);
  }, [state.settings]);

  const saveProfile = () => {
    if (!businessName.trim()) {
      notify('Nama usaha wajib diisi', { tone: 'error' });
      return;
    }
    updateSettings({
      businessName: businessName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      address: address.trim(),
      lowStockThreshold: Math.max(0, Math.floor(threshold)),
    });
    notify('Pengaturan usaha disimpan');
  };

  const shareCatalog = async () => {
    if (!normalizePhone(whatsapp)) {
      notify('Atur nomor WhatsApp dulu', { tone: 'error', message: 'Nomor ini dipakai untuk menerima pesanan dari katalog.' });
      return;
    }
    const result = await share({
      title: `Katalog ${businessName}`,
      text: `Pesan bumbu rumahan dari ${businessName}. Pilih bumbu, kirim pesanan lewat WhatsApp.`,
      url: catalogUrl(),
    });
    if (result === 'copied') notify('Link katalog disalin', { message: 'Kirim ke warung lewat WhatsApp.' });
    if (result === 'failed') notify('Belum bisa membagikan link', { tone: 'error' });
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseBackup(text);
      setPending({ kind: 'import', state: imported });
    } catch (err) {
      notify('Backup tidak bisa dibuka', { tone: 'error', message: err instanceof Error ? err.message : undefined });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmPending = () => {
    if (!pending) return;
    if (pending.kind === 'reset') {
      resetAll();
      setPending(null);
      navigate('/');
      return;
    }
    if (pending.kind === 'demo') {
      replaceState(createDemoState());
      setPending(null);
      notify('Data contoh dimuat ulang');
      navigate('/');
      return;
    }
    replaceState(pending.state);
    setPending(null);
    notify('Backup berhasil dipulihkan');
    navigate('/');
  };

  return (
    <div className="settings-page">
      <PageHeader
        eyebrow="Pengaturan"
        title="Usaha & data"
        description="Atur identitas usaha, katalog pesanan, dan cadangan data."
      />

      <div className="settings-grid">
        <div className="settings-grid__main">
          <Card className="settings-section">
            <SectionHeader title="Profil usaha" description="Nama ini yang dilihat warung di katalog." />
            <div className="form-grid form-grid--2">
              <Field label="Nama usaha" htmlFor="settings-business">
                <Input id="settings-business" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Caca Bumbu" />
              </Field>
              <Field label="Nama pemilik" htmlFor="settings-owner">
                <Input id="settings-owner" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Caca" />
              </Field>
            </div>
            <div className="form-grid form-grid--2">
              <Field label="Nomor telepon" optional htmlFor="settings-phone">
                <Input id="settings-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xx…" />
              </Field>
              <Field label="Nomor WhatsApp penjual" htmlFor="settings-wa" hint="Untuk pesanan katalog">
                <Input id="settings-wa" type="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="08xx…" />
              </Field>
            </div>
            <Field label="Alamat" optional htmlFor="settings-address">
              <Textarea id="settings-address" rows={2} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Alamat dapur / titik ambil" />
            </Field>
            <div className="form-grid form-grid--2 settings-threshold">
              <Field label="Batas stok menipis" htmlFor="settings-threshold" hint="muncul di peringatan">
                <Input id="settings-threshold" type="number" min={0} value={threshold} onChange={(event) => setThreshold(Number(event.target.value) || 0)} />
              </Field>
              <div className="settings-save"><Button onClick={saveProfile} icon={<Check size={16} />}>Simpan pengaturan</Button></div>
            </div>
          </Card>

          <Card className="settings-section">
            <SectionHeader title="Katalog & pesanan" description="Warung bisa memilih bumbu lalu mengirim pesanan lewat WhatsApp." />
            <div className="catalog-preview">
              <span className="catalog-preview__stamp"><MessageCircle size={22} /></span>
              <div>
                <strong>{businessName || 'Caca Bumbu'}</strong>
                <p>{normalizePhone(whatsapp) ? `Pesanan diarahkan ke WhatsApp ${whatsapp}` : 'Nomor WhatsApp belum diatur, katalog belum bisa menerima pesanan.'}</p>
                <code>{catalogUrl()}</code>
              </div>
            </div>
            <div className="settings-actions">
              <Button variant="secondary" onClick={shareCatalog} icon={<Share2 size={16} />}>Bagikan katalog</Button>
              <Button variant="ghost" onClick={() => window.open(catalogUrl(), '_blank')} iconAfter={<ArrowRight size={15} />}>Lihat katalog</Button>
            </div>
            {!normalizePhone(whatsapp) ? (
              <div className="notice notice--warning"><Info size={17} /><div>Isi nomor WhatsApp lalu simpan, supaya pesanan dari katalog bisa masuk.</div></div>
            ) : null}
          </Card>

          <Card className="settings-section">
            <SectionHeader title="Data & cadangan" description="Data disimpan lokal di HP ini. Rutin cadangkan agar aman." />
            <div className="data-actions">
              <button type="button" onClick={() => { exportState(state); notify('Backup diunduh', { message: 'Simpan file JSON di tempat aman.' }); }}>
                <span className="data-actions__icon"><Download size={19} /></span>
                <div><strong>Unduh backup</strong><small>File JSON berisi semua data usaha</small></div>
                <ArrowRight size={16} />
              </button>
              <button type="button" onClick={() => fileRef.current?.click()}>
                <span className="data-actions__icon is-blue"><Upload size={19} /></span>
                <div><strong>Pulihkan backup</strong><small>Ganti data saat ini dengan file cadangan</small></div>
                <ArrowRight size={16} />
              </button>
              <button type="button" onClick={() => setPending({ kind: 'demo' })}>
                <span className="data-actions__icon is-gold"><RefreshCw size={19} /></span>
                <div><strong>Muat data contoh</strong><small>Latihan dengan transaksi dan warung contoh</small></div>
                <ArrowRight size={16} />
              </button>
            </div>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => void onImport(event.target.files?.[0])} />
            <div className="data-summary">
              <span><Database size={15} /> {state.sales.length + state.consignments.length} transaksi</span>
              <span><Store size={15} /> {state.warungs.length} warung</span>
              <span><Wallet size={15} /> {state.purchases.length} belanja</span>
            </div>
          </Card>

          <Card className="settings-section danger-zone">
            <SectionHeader title="Mulai ulang" description="Hapus data di perangkat ini dan kembali ke awal." />
            <Button variant="danger" onClick={() => setPending({ kind: 'reset' })} icon={<Trash2 size={16} />}>Hapus semua data</Button>
          </Card>
        </div>

        <aside className="settings-grid__side">
          <Card className="install-card">
            <span className="install-card__icon"><Smartphone size={24} /></span>
            <h2>{installed ? 'Aplikasi sudah terpasang' : 'Pasang di HP'}</h2>
            <p>{installed ? 'Caca Bumbu siap dibuka dari layar utama.' : 'Buka seperti aplikasi biasa, tanpa browser. Tetap ringan dan bisa luring.'}</p>
            {canInstall && !installed ? <Button full variant="secondary" onClick={() => void install()} icon={<Download size={16} />}>Pasang sekarang</Button> : null}
            {installed ? <Badge tone="green"><Check size={13} /> Terpasang</Badge> : null}
            <div className="install-card__tips">
              <span><CloudOff size={14} /> Bekerja luring</span>
              <span><ShieldCheck size={14} /> Tanpa akun</span>
              <span><LockKeyhole size={14} /> Data privat</span>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Tentang aplikasi" />
            <div className="about-list">
              <div><span>Versi</span><strong>1.0.0</strong></div>
              <div><span>Penyimpanan</span><strong>Lokal di HP</strong></div>
              <div><span>Produk</span><strong>{state.products.length} bumbu</strong></div>
            </div>
            <p className="muted-copy">Caca Bumbu membantu pemilik usaha bumbu rumahan mencatat jual langsung, titipan, stok, dan bahan.</p>
          </Card>

          <Card className="help-card">
            <span className="help-card__icon"><FileJson size={20} /></span>
            <h2>Kenapa data lokal?</h2>
            <p>Agar aplikasi cepat dan tetap bisa dipakai di warung tanpa sinyal. Cadangkan rutin dari menu ini.</p>
          </Card>
        </aside>
      </div>

      <Sheet
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending?.kind === 'reset' ? 'Hapus semua data?' : pending?.kind === 'demo' ? 'Muat data contoh?' : 'Pulihkan backup?'}
        description={
          pending?.kind === 'reset'
            ? 'Tindakan ini tidak bisa dibatalkan.'
            : pending?.kind === 'demo'
              ? 'Data yang ada sekarang akan diganti dengan data contoh.'
              : 'Data yang ada sekarang akan diganti dengan isi file backup.'
        }
        footer={
          <div className="sheet-actions">
            <Button full variant="secondary" onClick={() => setPending(null)}>Batal</Button>
            <Button full variant={pending?.kind === 'reset' ? 'danger' : 'primary'} onClick={confirmPending}>
              {pending?.kind === 'reset' ? 'Ya, hapus semua' : pending?.kind === 'demo' ? 'Muat data contoh' : 'Pulihkan backup'}
            </Button>
          </div>
        }
      >
        <div className="confirm-generic">
          <span className={`confirm-generic__icon ${pending?.kind === 'reset' ? 'is-danger' : ''}`}>
            {pending?.kind === 'reset' ? <Trash2 size={26} /> : pending?.kind === 'demo' ? <RefreshCw size={26} /> : <Upload size={26} />}
          </span>
          {pending?.kind === 'import' ? (
            <div className="confirm-generic__stats">
              <div><span>Transaksi</span><strong>{pending.state.sales.length + pending.state.consignments.length}</strong></div>
              <div><span>Warung</span><strong>{pending.state.warungs.length}</strong></div>
              <div><span>Produk</span><strong>{pending.state.products.length}</strong></div>
            </div>
          ) : (
            <p>Pastikan sudah membuat backup jika masih membutuhkan data saat ini.</p>
          )}
        </div>
      </Sheet>
    </div>
  );
}

