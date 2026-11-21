import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Deploy di root domain (Netlify). Hash router membuat tautan dalam tetap aman.
  base: '/',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 4173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
