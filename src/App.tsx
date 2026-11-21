import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StoreProvider, useStore } from './store/StoreContext';
import { AuthProvider, useAuth } from './store/AuthContext';
import { SyncProvider } from './store/SyncContext';
import { ToastProvider } from './components/Toast';
import { AppShell } from './components/AppShell';
import { matchRoute, useLocation, useScrollTopOnNavigate } from './lib/router';
import { useDocumentTitle } from './lib/hooks';
import { WelcomePage } from './pages/WelcomePage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { SalePage } from './pages/SalePage';
import { ConsignmentsPage } from './pages/ConsignmentsPage';
import { NewConsignmentPage } from './pages/NewConsignmentPage';
import { ConsignmentDetailPage } from './pages/ConsignmentDetailPage';
import { WarungsPage } from './pages/WarungsPage';
import { WarungDetailPage } from './pages/WarungDetailPage';
import { ProductsPage } from './pages/ProductsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { PurchaseFormPage } from './pages/PurchaseFormPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { OrderCatalogPage } from './pages/OrderCatalogPage';
import { Button, Card, EmptyState } from './components/ui';
import { Brand, EmptyBowl } from './components/Brand';
import { navigate } from './lib/router';

const TITLES: Array<[string, string]> = [
  ['/', 'Beranda'],
  ['/jual', 'Jual langsung'],
  ['/titip', 'Titipan'],
  ['/warung', 'Warung'],
  ['/analisa', 'Analisa'],
  ['/riwayat', 'Riwayat'],
  ['/produk', 'Produk & stok'],
  ['/bahan', 'Bahan & belanja'],
  ['/pengaturan', 'Pengaturan'],
];

function LoadingScreen() {
  return (
    <div className="boot-screen">
      <Brand />
      <div className="boot-screen__progress" aria-hidden="true"><span /></div>
      <p>Menyiapkan data usaha…</p>
    </div>
  );
}

function Router() {
  const location = useLocation();
  const { state } = useStore();
  const { cloudEnabled, session, offline, status } = useAuth();
  useScrollTopOnNavigate(location.path);
  const pageTitle = TITLES.find(([path]) => location.path === path)?.[1]
    ?? (location.path.startsWith('/titip') ? 'Titipan' : location.path.startsWith('/warung') ? 'Warung' : location.path.startsWith('/bahan') ? 'Bahan & belanja' : 'Caca Bumbu');
  useDocumentTitle(pageTitle);

  // Katalog pesanan bersifat publik: warung tidak perlu akun.
  if (location.path === '/katalog') return <OrderCatalogPage />;

  if (status === 'loading') return <LoadingScreen />;

  if (location.path === '/masuk') return <AuthPage />;

  const needsAccount = cloudEnabled && !session && !offline;
  if (needsAccount) return <AuthPage />;

  if (!state.meta.onboarded) return <WelcomePage />;

  let page: ReactNode;
  if (location.path === '/') page = <DashboardPage />;
  else if (location.path === '/jual') page = <SalePage />;
  else if (location.path === '/titip') page = <ConsignmentsPage />;
  else if (location.path === '/titip/baru') page = <NewConsignmentPage />;
  else if (matchRoute('/titip/:id', location.path)) page = <ConsignmentDetailPage />;
  else if (location.path === '/warung') page = <WarungsPage />;
  else if (matchRoute('/warung/:id', location.path)) page = <WarungDetailPage />;
  else if (location.path === '/produk') page = <ProductsPage />;
  else if (location.path === '/bahan') page = <PurchasesPage />;
  else if (location.path === '/bahan/beli') page = <PurchaseFormPage />;
  else if (location.path === '/analisa') page = <AnalysisPage />;
  else if (location.path === '/riwayat') page = <HistoryPage />;
  else if (location.path === '/pengaturan') page = <SettingsPage />;
  else {
    page = (
      <div>
        <Card className="no-border">
          <EmptyState
            illustration={<EmptyBowl size={58} />}
            title="Halaman tidak ditemukan"
            description="Tautan yang Ibu buka mungkin sudah berubah."
            action={<Button onClick={() => navigate('/')}>Kembali ke beranda</Button>}
          />
        </Card>
      </div>
    );
  }

  return <AppShell>{page}</AppShell>;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Caca Bumbu error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal-screen">
          <EmptyBowl size={58} />
          <h1>Terjadi kendala kecil</h1>
          <p>Muat ulang aplikasi. Data yang sudah tersimpan tetap aman di HP ini.</p>
          <Button onClick={() => window.location.reload()}>Muat ulang</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <StoreProvider>
        <AuthProvider>
          <SyncProvider>
            <ToastProvider>
              <Router />
            </ToastProvider>
          </SyncProvider>
        </AuthProvider>
      </StoreProvider>
    </AppErrorBoundary>
  );
}
