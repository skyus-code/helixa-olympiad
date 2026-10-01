/**
 * Uji wajib terpisah: matikan WebGL, pastikan hero jatuh ke SVG helix.
 *
 * Kenapa file sendiri, bukan blok di verify.mjs: mematikan WebGL butuh flag
 * saat Chrome start (`--disable-3d-apis`, setara "Disable WebGL" di DevTools >
 * Rendering). Flag tidak bisa diubah pada browser yang sudah jalan, sedangkan
 * verify.mjs memakai satu instance Chrome untuk semua bloknya. Jadi kondisi ini
 * tidak bisa diuji dari dalam verify.mjs tanpa mengorbankan blok lain.
 *
 * Yang diperiksa:
 *   1. WebGL benar-benar mati (getContext('webgl2') -> null). Kalau tidak, uji
 *      ini tidak valid karena tidak sedang menguji apa pun.
 *   2. Tidak ada canvas three.js di hero.
 *   3. SVG helix fallback ADA, dan punya dimensi nyata di layar - bukan elemen
 *      0x0 yang secara teknis "ada" tapi tidak terlihat.
 *   4. Headline hero tetap ada. Konten tidak boleh hilang bersama canvas.
 *   5. Nol error console.
 *
 * Jalankan: node scripts/verify-webgl-off.mjs [url]   (setelah `npm run build`)
 */
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2] ?? 'http://localhost:4200/';
const PORT = 9372;

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log('  ok   ' + name + (detail ? '  (' + detail + ')' : ''));
  } else {
    fail++;
    console.log('  FAIL ' + name + (detail ? '  (' + detail + ')' : ''));
  }
}

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    // INI yang mematikan WebGL, setara "Disable WebGL" di DevTools Rendering.
    '--disable-3d-apis',
    '--hide-scrollbars',
    '--no-sandbox',
    '--no-first-run',
    '--force-color-profile=srgb',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), 'helixa-nogl')}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);
process.on('exit', () => chrome.kill());

for (let i = 0; i < 80; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break;
  } catch {
    /* belum siap */
  }
  await sleep(250);
}

const target = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const consoleErrors = [];
let id = 0;
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(d.params.exceptionDetails?.text ?? 'exception');
  }
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') {
    consoleErrors.push(d.params.entry.text);
  }
  if (d.id && pending.has(d.id)) {
    pending.get(d.id)(d.result);
    pending.delete(d.id);
  }
};
await new Promise((r) => {
  ws.onopen = r;
});
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
});
// Tanpa ini pointer terbaca coarse, halaman jatuh ke mode 'simple', dan yang
// diuji bukan jalur fallback WebGL sama sekali.
await send('Emulation.setTouchEmulationEnabled', { enabled: false });
await send('Page.navigate', { url });

const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  }
  return r.result.value;
};

/*
 * Tunggu hero selesai mencoba membuat WebGL dan jatuh ke fallback.
 *
 * Menunggu angka detik tetap tidak bisa diandalkan di sini: chunk three.js
 * berukuran lebih dari setengah megabyte, jadi waktu gagalnya_create context
 * berbeda jauh antara mesin cepat dan lambat. Kalau dipanggil terlalu cepat,
 * SVG helix belum ada dan ujinya salah menyimpulkan "fallback tidak muncul".
 */
let helixReady = false;
for (let i = 0; i < 60; i++) {
  await sleep(250);
  helixReady = await evalJs("!!document.querySelector('.hero-dna-helix')");
  if (helixReady) break;
}
await sleep(500);

console.log('\n=== B17. WEBGL DIMATIKAN: HERO JATUH KE SVG HELIX ===');

const d = JSON.parse(
  await evalJs(String.raw`(() => {
    const probe = document.createElement('canvas');
    const helix = document.querySelector('.hero-dna-helix');
    const box = helix ? helix.getBoundingClientRect() : null;
    const h1 = document.querySelector('h1');
    return JSON.stringify({
      webgl2Available: !!probe.getContext('webgl2'),
      webgl1Available: !!probe.getContext('webgl'),
      heroCanvasCount: document.querySelectorAll('.hero-section canvas').length,
      svgHelixPresent: !!helix,
      svgHelixBox: box
        ? { w: Math.round(box.width), h: Math.round(box.height), x: Math.round(box.x) }
        : null,
      headlinePresent: !!h1,
      headlineLen: h1 ? (h1.textContent || '').trim().length : 0,
      // Fallback juga harus diam: tidak boleh ada animasi yang berjalan, karena
      // pengguna ini tidak meminta reduced-motion.
      helixAnimations: helix ? helix.getAnimations().length : -1,
    });
  })()`),
);

check('WebGL benar-benar mati di browser ini (uji valid)',
  !d.webgl2Available && !d.webgl1Available,
  'webgl2=' + d.webgl2Available + ' webgl1=' + d.webgl1Available);
check('Tidak ada canvas three.js di hero', d.heroCanvasCount === 0,
  d.heroCanvasCount + ' canvas');
check('SVG helix fallback muncul', d.svgHelixPresent);
check('SVG helix punya dimensi nyata di layar (bukan 0x0)',
  !!d.svgHelixBox && d.svgHelixBox.w > 100 && d.svgHelixBox.h > 100,
  d.svgHelixBox ? d.svgHelixBox.w + 'x' + d.svgHelixBox.h : 'tidak ada');
check('Headline hero tetap utuh (konten tidak hilang bersama canvas)',
  d.headlinePresent && d.headlineLen > 10, d.headlineLen + ' karakter');
check('SVG helix diam (tidak ada animasi)', d.helixAnimations === 0,
  d.helixAnimations + ' animasi');
check('Nol error console', consoleErrors.length === 0,
  consoleErrors.length ? consoleErrors.join(' | ') : 'bersih');

console.log('\n' + '='.repeat(58));
console.log('  TOTAL: ' + pass + ' PASS / ' + fail + ' FAIL');
console.log('='.repeat(58));

process.exit(fail > 0 ? 1 : 0);
