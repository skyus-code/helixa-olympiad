import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Base path.
 *
 * - Default `/` untuk `npm run dev` dan `npm run preview` lokal.
 * - Disetel lewat env `PUBLIC_BASE` saat build di CI (GitHub Pages), karena
 *   project page dilayani dari `/<nama-repo>/`, bukan root domain.
 *   Workflow mengambil nilainya otomatis dari `actions/configure-pages`.
 */
const rawBase = process.env.PUBLIC_BASE ?? '/';
const base = rawBase === '/' ? '/' : `${rawBase.replace(/\/+$/, '')}/`;

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    cssMinify: true,
  },
});
