import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Módulo COLABORADOR (desktop). Servido em "/painel/". Mesma estratégia de arquivos públicos do cliente. */
export default defineConfig({
  root: 'apps/painel',
  base: '/painel/',
  plugins: [react()],
  publicDir: '../../publico',
  build: { outDir: '../../dist/painel', emptyOutDir: true, copyPublicDir: false, sourcemap: false },
  server: {
    host: true,
    port: 5174,
    proxy: { '/api': 'http://localhost:8080' },
  },
});
