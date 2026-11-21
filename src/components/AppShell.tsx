import { useState, type ReactNode } from 'react';
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  Download,
  History,
  Home,
  Menu,
  Package,
  PackageCheck,
  Settings,
  Share2,
  ShoppingBag,
  Store,
  Wallet,
} from 'lucide-react';
import { Brand, BrandSymbol } from './Brand';
import { Avatar, Badge, Button, IconButton, Sheet } from './ui';
import { SyncStatusBadge, useSyncSummary } from './SyncBadge';
import { useStore } from '../store/StoreContext';
import { useAuth } from '../store/AuthContext';
import { navigate, pathStartsWith, useLocation } from '../lib/router';
import { useInstallPrompt, useShare } from '../lib/hooks';
import { useToast } from './Toast';
import { formatDate, todayKey } from '../lib/date';
import { normalizePhone } from '../lib/format';
import { outstandingTotal } from '../lib/domain';
import { sharedCatalogUrl } from '../lib/catalog';

const MAIN_NAV = [
  { to: '/', label: 'Beranda', icon: Home, exact: true },
  { to: '/jual', label: 'Jual', icon: ShoppingBag },
  { to: '/titip', label: 'Titip', icon: PackageCheck },
  { to: '/warung', label: 'Warung', icon: Store },
  { to: '/analisa', label: 'Analisa', icon: BarChart3 },
];

const SECONDARY_NAV = [
  { to: '/riwayat', label: 'Riwayat transaksi', icon: History },
  { to: '/produk', label: 'Produk & stok', icon: Package },
  { to: '/bahan', label: 'Bahan & belanja', icon: BookOpen },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings },
];

function isActive(path: string, to: string, exact = false): boolean {
  return exact ? path === to : pathStartsWith(path, to);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { notify } = useToast();
  const share = useShare();
  const { canInstall, installed, install } = useInstallPrompt();
  const sync = useSyncSummary();
  const { cloudEnabled, session } = useAuth();
  const receivable = outstandingTotal(state);

  const handleShare = async () => {
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

  const goto = (to: string) => {
    setMenuOpen(false);
    navigate(to);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <Brand />
        </div>
        <nav className="sidebar__nav" aria-label="Navigasi utama">
          <p className="sidebar__label">Menu utama</p>
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(location.path, item.to, item.exact);
            return (
              <button key={item.to} type="button" className={`sidebar__link ${active ? 'is-active' : ''}`} onClick={() => goto(item.to)}>
                <Icon size={19} strokeWidth={active ? 2.4 : 1.9} />
                <span>{item.label}</span>
                {item.to === '/titip' && state.consignments.filter((item) => item.status === 'aktif').length > 0 ? (
                  <i className="sidebar__count">{state.consignments.filter((item) => item.status === 'aktif').length}</i>
                ) : null}
                {active ? <span className="sidebar__active-dot" /> : null}
              </button>
            );
          })}
          <p className="sidebar__label sidebar__label--spaced">Kelola usaha</p>
          {SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.to} type="button" className={`sidebar__link ${isActive(location.path, item.to) ? 'is-active' : ''}`} onClick={() => goto(item.to)}>
                <Icon size={19} strokeWidth={1.9} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar__bottom">
          <div className="sidebar__catalog">
            <span className="sidebar__catalog-icon"><Share2 size={18} /></span>
            <strong>Katalog untuk warung</strong>
            <p>Warung bisa pilih bumbu dan order lewat WhatsApp.</p>
            <Button size="sm" variant="gold" onClick={handleShare} icon={<Share2 size={14} />}>Bagikan</Button>
          </div>
          <button type="button" className="sidebar__profile" onClick={() => goto('/pengaturan')}>
            <Avatar name={state.settings.ownerName || state.settings.businessName} tone="gold" />
            <span>
              <strong>{state.settings.ownerName || 'Pemilik'}</strong>
              <small>{state.settings.businessName}</small>
            </span>
            <ChevronRight size={15} />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-topbar">
          <button type="button" className="mobile-topbar__brand" onClick={() => goto('/')} aria-label="Beranda Caca Bumbu">
            <BrandSymbol size={34} />
            <span>
              <strong>{state.settings.businessName}</strong>
              <small>{sync.label}</small>
            </span>
          </button>
          <div className="mobile-topbar__actions">
            {receivable > 0 ? <span className="topbar-due" aria-label="Ada piutang">●</span> : null}
            <IconButton label="Buka menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></IconButton>
          </div>
        </header>

        <header className="desktop-topbar">
          <div className="desktop-topbar__meta">
            <span>{formatDate(todayKey(), 'full')}</span>
            <span className="desktop-topbar__sep" />
            <span className={`online-dot ${sync.offline ? 'is-offline' : ''}`}>{sync.label}</span>
          </div>
          <div className="desktop-topbar__actions">
            {canInstall && !installed ? (
              <Button variant="ghost" size="sm" icon={<Download size={15} />} onClick={() => void install()}>Pasang aplikasi</Button>
            ) : null}
            <Button variant="secondary" size="sm" icon={<Share2 size={15} />} onClick={handleShare}>Bagikan katalog</Button>
          </div>
        </header>

        <main className="page">{children}</main>

        <nav className="bottom-nav" aria-label="Navigasi utama">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(location.path, item.to, item.exact);
            return (
              <button
                key={item.to}
                type="button"
                className={`bottom-nav__item ${active ? 'is-active' : ''}`}
                onClick={() => goto(item.to)}
                aria-current={active ? 'page' : undefined}
              >
                <span className="bottom-nav__icon">
                  <Icon size={21} strokeWidth={active ? 2.5 : 1.9} />
                  {active ? <i /> : null}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" description="Semua yang Ibu butuhkan untuk mengelola bumbu.">
        <div className="menu-profile">
          <Avatar name={state.settings.ownerName || state.settings.businessName} tone="gold" size="lg" />
          <div>
            <strong>{state.settings.ownerName || 'Pemilik'}</strong>
            <p>{state.settings.businessName}</p>
          </div>
          <Badge tone={state.meta.demo ? 'gold' : 'green'}>{state.meta.demo ? 'Data contoh' : 'Data asli'}</Badge>
        </div>
        <div className="menu-sync">
          <SyncStatusBadge />
          <small>{cloudEnabled && session ? 'Tersambung ke akun cloud' : 'Data hanya di perangkat ini'}</small>
        </div>
        <div className="menu-links">
          {[...MAIN_NAV, ...SECONDARY_NAV].map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.to} type="button" onClick={() => goto(item.to)}>
                <span className="menu-links__icon"><Icon size={19} /></span>
                <span>{item.label}</span>
                <ChevronRight size={17} />
              </button>
            );
          })}
          <button type="button" onClick={() => { setMenuOpen(false); void handleShare(); }}>
            <span className="menu-links__icon"><Share2 size={19} /></span>
            <span>Bagikan katalog pesanan</span>
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="menu-footer">
          <div className="menu-footer__info">
            <Wallet size={17} />
            <span>Piutang saat ini <strong>{formatMoneyShort(receivable)}</strong></span>
          </div>
          <p>
            {cloudEnabled && session
              ? 'Data tersimpan di cloud akun ini dan tetap bisa dibuka tanpa sinyal.'
              : 'Aplikasi bekerja luring. Data tersimpan di perangkat ini dan bisa dicadangkan dari Pengaturan.'}
          </p>
          {state.meta.demo ? <Badge tone="gold">Mode data contoh</Badge> : null}
        </div>
      </Sheet>
    </div>
  );
}

function formatMoneyShort(value: number): string {
  return value > 0 ? `Rp ${value.toLocaleString('id-ID')}` : 'Rp 0';
}
