/**
 * Lighthouse Mobile untuk build produksi.
 *
 * Kenapa file ini ada: CLI lighthouse tidak bisa dipanggil di mesin ini —
 * `npx lighthouse` gagal dengan ECOMPROMISED, dan memanggil
 * `lighthouse/cli/bin.js` langsung keluar dengan kode 0 tanpa menulis
 * laporan apa pun (dicek dengan empat cara berbeda: output-path relatif,
 * absolut, stdout, dan tanpa --quiet). Jadi laporan diambil lewat Node API
 * dengan chrome-launcher yang eksplisit, yang terbukti bekerja.
 *
 * Beban throttling dibiarkan sesuai bawaan Lighthouse (4x CPU, Slow 4G) —
 * angka yang comparable dengan catatan sebelumnya. Jangan diubah tanpa
 * menyebutkannya di README.
 *
 * PENTANG saat membaca keluarannya: angka TBT di mesin ini berfluktuasi lebar
 * karena beban CPU host ikut memotong trace. Selalu jalankan beberapa kali dan
 * laporkan rentang, jangan satu angka. Detailnya di README.
 *
 * Pakai: node scripts/lighthouse.mjs [url] [keluaran.json]
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const LH_ROOT = join(tmpdir(), 'helixa-lh', 'node_modules');
const lighthouse = require(join(LH_ROOT, 'lighthouse')).default;
const chromeLauncher = require(join(LH_ROOT, 'chrome-launcher'));

const url = process.argv[2] ?? 'http://localhost:4299/';
const out = process.argv[3] ?? 'lh.json';

const chrome = await chromeLauncher.launch({
  chromeFlags: ['--headless=new', '--no-sandbox'],
});
try {
  const result = await lighthouse(url, {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor: 'mobile',
    screenEmulation: {
      mobile: true,
      width: 412,
      height: 823,
      deviceScaleFactor: 1.75,
      disabled: false,
    },
  });
  writeFileSync(out, result.report);

  const r = JSON.parse(result.report);
  const line = (k) => `${k.padEnd(12)} ${Math.round(r.categories[k].score * 100)}`;
  console.log(['performance', 'accessibility', 'best-practices', 'seo'].map(line).join('\n'));
  console.log('---');
  for (const k of [
    'first-contentful-paint',
    'largest-contentful-paint',
    'speed-index',
    'total-blocking-time',
    'cumulative-layout-shift',
    'interactive',
  ]) {
    const a = r.audits[k];
    // Skor per metrik ikut dicetak: skor kategori saja
    // menyembunyikan WHICH metrik yang menahan, dan bobotnya berbeda-beda
    // (TBT 30, LCP 25, CLS 25, FCP 10, SI 10).
    const s = a.score === null ? 'n/a' : String(Math.round(a.score * 100));
    console.log(`${k.padEnd(28)} ${String(a.displayValue).padEnd(10)} skor ${s}`);
  }
  console.log('---');
  console.log('laporan:', out);
} finally {
  await chrome.kill();
}