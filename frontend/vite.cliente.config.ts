import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Módulo CLIENTE (smartphone). Servido na raiz do site ("/").
 * - publicDir aponta para a pasta "publico" (imagens e configuração visual): no modo
 *   desenvolvimento o Vite a serve em /imagens e /config.
 * - Em produção essa pasta NÃO é copiada para o build: o nginx a monta como volume,
 *   permitindo trocar imagens e o tema sem recompilar (veja docs/PERSONALIZACAO.md).
 */
export default defineConfig({
  root: 'apps/cliente',
  base: '/',
  plugins: [react()],
  publicDir: '../../publico',
  build: { outDir: '../../dist/cliente', emptyOutDir: true, copyPublicDir: false, sourcemap: false },
  server: {
    host: true, // aceita acesso pela rede local (teste no celular)
    port: 5173,
    proxy: { '/api': 'http://localhost:8080' },
  },
});
