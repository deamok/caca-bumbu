import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import './styles.css';
import './styles-dashboard-sale.css';
import './styles-consignments.css';
import './styles-operations.css';
import './styles-insights.css';
import './styles-responsive.css';
import App from './App';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/**
 * Sebagian hosting (mis. Netlify free) menyisipkan iframe badge promosi di
 * sudut bawah. Saat badge muncul, tambahkan kelas pada <html> supaya navigasi
 * bawah dan tombol aksi tidak tertutup (lihat --host-badge-offset di CSS).
 */
function trackHostingBadge(): void {
  const root = document.documentElement;
  const sync = () => {
    root.classList.toggle('has-hosting-badge', Boolean(document.getElementById('nl-badge-frame')));
  };
  const start = () => {
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', sync);
    window.setTimeout(sync, 1200);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}

trackHostingBadge();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemen root tidak ditemukan');
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker tidak aktif', error);
    });
  });
}
