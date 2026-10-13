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

/**
 * Alamat API saat pengembangan.
 *
 * Klien memanggil `/api/...` dengan path relatif, dan Vite yang meneruskannya
 * ke server Express. Dua alasan:
 *   1. Origin-nya jadi sama, sehingga tidak ada preflight/CORS yang perlu
 *      diurus dan cookie/token berperilaku sama seperti di produksi.
 *   2. Yang tersimpan di kode klien adalah path relatif, bukan
 *      `http://localhost:4000`. Kalau alamat absolut ditulis di kode, build
 *      produksi ikut membawa alamat lokal itu - kesalahan yang baru ketahuan
 *      setelah deploy.
 *
 * Kalau situs dan API dipisah ke host berbeda di produksi, isi `VITE_API_URL`
 * dan klien akan memakai alamat itu sebagai gantinya.
 */
const API_TARGET = process.env.API_TARGET ?? 'http://localhost:4000';
const proxy = {
  '/api': { target: API_TARGET, changeOrigin: true },
};

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
  build: {
    outDir: 'dist',
    target: 'es2020',
    cssMinify: true,
  },
});
