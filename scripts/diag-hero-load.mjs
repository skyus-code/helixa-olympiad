/**
 * Cek animasi load hero: apakah headline/subteks/tombol benar-benar
 * muncul berurutan (fade + naik 24px, jeda 100ms)?
 *
 * Pakai: node scripts/diag-hero-load.mjs [url]
 */

import { spawn } from 'node:child_process';

const URL_TARGET = process.argv[2] ?? 'http://localhost:5180/';
const PORT = 9226;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const chrome = spawn(
  CHROME,
  ['--headless=new','--disable-gpu','--hide-scrollbars','--no-sandbox','--no-first-run',
   '--remote-debugging-port=' + PORT,
   '--user-data-dir=' + process.env.TEMP + '\\helixa-diag2-profile','about:blank'],
  { stdio: 'ignore' },
);
process.on('exit', () => chrome.kill());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ready() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return; } catch {}
    await sleep(250);
  }
  throw new Error('DevTools tidak merespons');
}
await ready();

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL_TARGET)}`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0; const pend = new Map(); const waiters = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  else if (m.method && waiters.has(m.method)) waiters.get(m.method).forEach((f) => f(m.params));
};
const send = (m, p = {}) => { const n = ++id; return new Promise((res, rej) => { pend.set(n, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: n, method: m, params: p })); }); };
const once = (m) => new Promise((res) => { const f = (p) => { waiters.set(m, (waiters.get(m) ?? []).filter((x) => x !== f)); res(p); }; waiters.set(m, [...(waiters.get(m) ?? []), f]); });
const evalJs = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 900 });

const loaded = once('Page.loadEventFired');
await send('Page.navigate', { url: URL_TARGET });
await loaded;

// Rekam jejak animasi pada 5 elemen hero selama halaman memuat
console.log('=== JEJAK ANIMASI LOAD HERO ===');
const trace = await evalJs(`(async () => {
  const samples = [];
  const grab = () => {
    const h1 = document.querySelector('h1');
    const hero = document.querySelector('.hero-section');
    if (!h1) return null;
    const grab1 = (el) => el ? { o: +getComputedStyle(el).opacity, t: getComputedStyle(el).transform } : null;
    // cari subteks & tombol di dalam hero
    const kids = hero ? [...hero.querySelectorAll('h1, p, a.btn')].slice(0, 5) : [];
    return {
      t: Math.round(performance.now()),
      anims: document.getAnimations().length,
      h1: grab1(h1),
      heroKids: kids.map((k) => ({ tag: k.tagName, o: +getComputedStyle(k).opacity, y: (getComputedStyle(k).transform.match(/,\\s*(-?[\\d.]+)\\)$/) || [])[1] })),
    };
  };
  for (let i = 0; i < 14; i++) {
    samples.push(grab());
    await new Promise(r => setTimeout(r, 110));
  }
  return samples;
})()`);

for (const s of trace) {
  if (!s) { console.log('  (h1 belum ada)'); continue; }
  const kids = s.heroKids.map(k => `${k.tag}:o${k.o.toFixed(2)}${k.y ? '/y' + k.y : ''}`).join(' ');
  console.log(`  t=${String(s.t).padStart(5)}ms anims=${s.anims}  ${kids}`);
}

console.log('\n=== APAKAH ELEMEN HERO PUNYA STYLE INLINE DARI MOTION? ===');
console.log(await evalJs(`(() => {
  const hero = document.querySelector('.hero-section');
  const kids = [...hero.querySelectorAll('h1, p, a.btn')].slice(0,5);
  return kids.map(k => ({
    tag: k.tagName,
    inlineTransform: k.style.transform || '(kosong)',
    inlineOpacity: k.style.opacity || '(kosong)',
    computedOpacity: getComputedStyle(k).opacity,
  }));
})()`));

console.log('\n=== FINAL STATE (setelah semua animasi selesai) ===');
console.log(await evalJs(`(() => {
  const hero = document.querySelector('.hero-section');
  const kids = [...hero.querySelectorAll('h1, p, a.btn')].slice(0,5);
  const opac = kids.map(k => getComputedStyle(k).opacity);
  return {
    allVisible: opac.every(o => parseFloat(o) > 0.99),
    opacities: opac,
    runningAnimations: document.getAnimations().length,
  };
})()`));

ws.close(); chrome.kill(); process.exit(0);
