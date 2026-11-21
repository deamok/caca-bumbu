import { ArrowRight, Check, CloudOff, LineChart, PackageCheck, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { Brand, BrandSymbol, EmptyBowl } from '../components/Brand';
import { Button } from '../components/ui';
import { useToast } from '../components/Toast';
import { navigate } from '../lib/router';
import { useInstallPrompt } from '../lib/hooks';

export function WelcomePage() {
  const { state, start } = useStore();
  const { notify } = useToast();
  const { canInstall, installed, install } = useInstallPrompt();

  const choose = (mode: 'demo' | 'clean') => {
    start(mode);
    if (mode === 'demo') {
      notify('Data contoh siap dicoba', { message: 'Semua transaksi contoh bisa dihapus kapan saja.' });
      navigate('/');
    } else {
      notify('Usaha baru siap dimulai', { message: 'Atur stok awal produk sebelum berjualan.' });
      navigate('/produk');
    }
  };

  return (
    <div className="welcome">
      <div className="welcome__texture" aria-hidden="true" />
      <header className="welcome__top">
        <Brand />
        <span className="welcome__badge"><ShieldCheck size={14} /> Data di HP sendiri</span>
      </header>
      <main className="welcome__main">
        <section className="welcome__copy">
          <p className="eyebrow eyebrow--light">Aplikasi usaha bumbu rumahan</p>
          <h1>Bumbu rapi.<br /><em>Warung senang.</em></h1>
          <p className="welcome__lead">
            Catat jualan langsung dan titipan warung dalam satu tempat. Tahu bumbu mana yang laku,
            siapa yang belum setor, dan bahan apa yang perlu dibeli.
          </p>
          <div className="welcome__features">
            <span><ShoppingBag size={16} /> Jual langsung</span>
            <span><PackageCheck size={16} /> Titip & hitung berkala</span>
            <span><LineChart size={16} /> Analisa usaha</span>
          </div>
          <div className="welcome__actions">
            <Button variant="gold" size="lg" onClick={() => choose('demo')} icon={<Sparkles size={18} />} iconAfter={<ArrowRight size={17} />}>
              Coba dengan data contoh
            </Button>
            <Button variant="welcome" size="lg" onClick={() => choose('clean')} icon={<Check size={18} />}>
              Mulai dari nol
            </Button>
          </div>
          <p className="welcome__note">
            <CloudOff size={14} /> Tanpa akun, tanpa langganan. Bekerja luring setelah dibuka pertama kali.
          </p>
          {canInstall && !installed ? (
            <button type="button" className="welcome__install" onClick={() => void install()}>
              Pasang di layar utama Android
            </button>
          ) : null}
        </section>

        <section className="welcome__visual" aria-label="Ilustrasi aplikasi">
          <div className="welcome__sun" />
          <div className="welcome__leaf welcome__leaf--one" />
          <div className="welcome__leaf welcome__leaf--two" />
          <div className="phone-preview">
            <div className="phone-preview__notch" />
            <div className="phone-preview__screen">
              <div className="phone-preview__top">
                <BrandSymbol size={26} />
                <span>Dapur Caca</span>
                <i />
              </div>
              <div className="phone-preview__hero">
                <small>Omzet hari ini</small>
                <strong>Rp 285.000</strong>
                <span>↑ 18% dari kemarin</span>
                <div className="phone-preview__stamp"><EmptyBowl size={46} /></div>
              </div>
              <div className="phone-preview__quick">
                <span><ShoppingBag size={15} /> Jual</span>
                <span><PackageCheck size={15} /> Titip</span>
                <span><LineChart size={15} /> Analisa</span>
              </div>
              <div className="phone-preview__box">
                <div className="phone-preview__boxhead">
                  <span>Kunjungan hari ini</span>
                  <small>3 warung</small>
                </div>
                {[
                  ['Warung Bu Sari', 'Hari ini'],
                  ['Warung Pak Ahmad', 'Besok'],
                  ['Warung Mpok Rina', 'Terlambat 2 hari'],
                ].map(([name, status], index) => (
                  <div className="phone-preview__visit" key={name}>
                    <i>{name.charAt(8) || 'W'}</i>
                    <div><strong>{name}</strong><small>{status}</small></div>
                    <span>{index === 0 ? 'Hitung' : '›'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="welcome__floating welcome__floating--a">
            <span><PackageCheck size={16} /></span>
            <div><strong>8 pack kembali</strong><small>stok otomatis masuk</small></div>
          </div>
          <div className="welcome__floating welcome__floating--b">
            <span><LineChart size={16} /></span>
            <div><strong>Rendang paling laku</strong><small>38 pack bulan ini</small></div>
          </div>
        </section>
      </main>
      <footer className="welcome__footer">
        <span>{state.products.length} bumbu dari daftar Ibu sudah siap</span>
        <span>Dibuat untuk warung, dari dapur sendiri.</span>
      </footer>
    </div>
  );
}
