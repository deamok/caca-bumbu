import { useState, type FormEvent } from 'react';
import { ArrowRight, Cloud, CloudOff, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useStore } from '../store/StoreContext';
import { useToast } from '../components/Toast';
import { Brand } from '../components/Brand';
import { Button, Field, InlineNotice, Input } from '../components/ui';
import { navigate } from '../lib/router';

type Mode = 'masuk' | 'daftar';

export function AuthPage() {
  const { state } = useStore();
  const { signIn, signUp, resetPassword, continueOffline, error, clearError } = useAuth();
  const { notify } = useToast();
  const [mode, setMode] = useState<Mode>('masuk');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const hasLocalData = state.meta.onboarded;

  const changeMode = (next: Mode) => {
    setMode(next);
    setResetSent(false);
    clearError();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) {
      notify('Isi email dan password', { tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      if (mode === 'masuk') {
        await signIn(email, password);
        notify('Berhasil masuk', { message: 'Data usaha disinkronkan ke perangkat ini.' });
        navigate('/');
      } else {
        const result = await signUp(email, password);
        if (result === 'confirm-email') {
          notify('Akun dibuat', { message: 'Cek email untuk konfirmasi, lalu masuk.' });
          setMode('masuk');
        } else {
          notify('Akun siap dipakai', { message: 'Selamat datang di Caca Bumbu.' });
          navigate('/');
        }
      }
    } catch {
      // pesan error sudah ditampilkan lewat state AuthContext
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async () => {
    if (!email.trim()) {
      notify('Isi email dulu', { tone: 'error' });
      return;
    }
    try {
      await resetPassword(email);
      setResetSent(true);
      notify('Tautan dikirim', { message: 'Buka email untuk mengatur ulang password.' });
    } catch {
      // error sudah ditangani AuthContext
    }
  };

  const useWithoutAccount = () => {
    continueOffline();
    notify('Mode lokal aktif', { message: 'Data disimpan di HP ini. Masuk kapan saja untuk sinkron.' });
  };

  return (
    <div className="auth-page">
      <div className="auth-page__glow" aria-hidden="true" />
      <div className="auth-card">
        <header className="auth-card__head">
          <Brand />
          {hasLocalData ? (
            <button type="button" className="auth-back" onClick={() => navigate('/pengaturan')}>
              Kembali
            </button>
          ) : (
            <span className="auth-card__badge"><ShieldCheck size={14} /> Data milik Anda</span>
          )}
        </header>

        <div className="auth-card__intro">
          <p className="eyebrow">{mode === 'masuk' ? 'Akun usaha' : 'Akun baru'}</p>
          <h1>{mode === 'masuk' ? 'Masuk ke Caca Bumbu' : 'Buat akun Caca Bumbu'}</h1>
          <p>
            {hasLocalData
              ? 'Data di HP ini akan digabung dengan data akun, lalu tersimpan aman di cloud.'
              : 'Satu akun untuk semua perangkat. Data usaha tersimpan aman dan bisa dibuka dari HP lain.'}
          </p>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Pilih masuk atau daftar">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'masuk'}
            className={mode === 'masuk' ? 'is-active' : ''}
            onClick={() => changeMode('masuk')}
          >
            Masuk
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'daftar'}
            className={mode === 'daftar' ? 'is-active' : ''}
            onClick={() => changeMode('daftar')}
          >
            Daftar
          </button>
        </div>

        <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
          <Field label="Email" htmlFor="auth-email">
            <div className="auth-input">
              <Mail size={17} />
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
                required
              />
            </div>
          </Field>
          <Field
            label="Password"
            htmlFor="auth-password"
            hint={mode === 'daftar' ? 'minimal 6 karakter' : undefined}
          >
            <div className="auth-input">
              <LockKeyhole size={17} />
              <Input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
                required
              />
              <button
                type="button"
                className="auth-input__toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>

          {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
          {resetSent ? (
            <InlineNotice tone="success">
              Tautan atur ulang sudah dikirim ke {email}. Setelah membuka tautan, Anda masuk otomatis — lalu ganti password di
              Pengaturan → Akun → Ganti password.
            </InlineNotice>
          ) : null}

          <Button type="submit" full size="lg" loading={busy} iconAfter={<ArrowRight size={17} />}>
            {mode === 'masuk' ? 'Masuk' : 'Daftar'}
          </Button>

          {mode === 'masuk' ? (
            <button type="button" className="auth-link" onClick={() => void sendReset()}>
              Lupa password?
            </button>
          ) : null}
        </form>

        <div className="auth-divider"><span>atau</span></div>

        <div className="auth-offline">
          <div>
            <strong><CloudOff size={16} /> Tetap pakai di HP ini</strong>
            <p>Data disimpan lokal, bisa dipakai di warung tanpa sinyal. Masuk nanti untuk sinkron.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={useWithoutAccount}>Lanjut tanpa akun</Button>
        </div>

        <footer className="auth-card__foot">
          <span><Cloud size={14} /> Sinkron otomatis antar perangkat</span>
          <span><ShieldCheck size={14} /> Dilindungi aturan akses per akun</span>
        </footer>
      </div>
    </div>
  );
}
