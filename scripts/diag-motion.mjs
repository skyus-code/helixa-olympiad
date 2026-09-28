/**
 * Diagnostik: apakah parallax & scroll-reveal benar-benar bekerja?
 * Mengukur nilai transform/opacity nyata sebelum & sesudah scroll.
 *
 * Pakai: node scripts/diag-motion.mjs [url]
 */

import { spawn } from 'node:child_process';

const URL_TARGET = process.argv[2] ?? 'http://localhost:5180/';
const PORT = 9225;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox', '--no-first-run',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + process.env.TEMP + '\\helixa-diag-profile',
    'about:blank',
  ],
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
const send = (method, params = {}) => { const n = ++id; return new Promise((resolve, reject) => { pend.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); }); };
const once = (m) => new Promise((res) => { const f = (p) => { waiters.set(m, (waiters.get(m) ?? []).filter((x) => x !== f)); res(p); }; waiters.set(m, [...(waiters.get(m) ?? []), f]); });
const evalJs = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + e.slice(0,120)); return r.result.value; };

await send('Page.enable'); await send('Runtime.enable');

// Paksa animasi aktif
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
// Desktop + pointer presisi (mouse) + >= 1024px agar parallax aktif
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 900 });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'any-pointer', value: 'fine' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });

const loaded = once('Page.loadEventFired');
await send('Page.navigate', { url: URL_TARGET });
await loaded;
await sleep(1600);

console.log('=== KONDISI LINGKUNGAN ===');
console.log(await evalJs(`(() => ({
  innerWidth: window.innerWidth,
  matchPointerFine: matchMedia('(pointer: fine)').matches,
  matchWide: matchMedia('(min-width: 1024px)').matches,
  matchReduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  matchNoPref: matchMedia('(prefers-reduced-motion: no-preference)').matches,
  hoverHover: matchMedia('(hover: hover)').matches,
  pointerFine: matchMedia('(pointer: fine)').matches,
}))()`));

console.log('\n=== SCROLL REVEAL: state awal ===');
const initial = await evalJs(`(() => {
  const rs = [...document.querySelectorAll('.reveal')];
  const byVisible = { v: 0, h: 0 };
  rs.forEach(e => e.dataset.visible === 'true' ? byVisible.v++ : byVisible.h++);
  return {
    total: rs.length, visibleTrue: byVisible.v, hiddenFalse: byVisible.h,
    opacityOfHidden: rs.filter(e => e.dataset.visible !== 'true').slice(0,5).map(e => getComputedStyle(e).opacity),
    cssRuleExists: [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].map(r => r.cssText); } catch { return []; } })
      .filter(t => t.includes('.reveal')).slice(0,3),
  };
})()`);
console.log(initial);

console.log('\n=== SCROLL:ikat observer aktif? ===');
// Tambahkan penanda: hitung berapa .reveal berubah ke visible=true setelah scroll bertahap
const scrollResult = await evalJs(`(async () => {
  const total = document.querySelectorAll('.reveal').length;
  const state = () => [...document.querySelectorAll('.reveal')].filter(e => e.dataset.visible === 'true').length;
  const startVisible = state();
  const startOpacities = [...document.querySelectorAll('.reveal')].map(e => getComputedStyle(e).opacity);
  const hiddenBefore = startOpacities.filter(o => parseFloat(o) < 0.99).length;

  const step = Math.round(window.innerHeight * 0.5);
  const maxY = document.body.scrollHeight;
  for (let y = 0; y <= maxY; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 260));
  }
  await new Promise(r => setTimeout(r, 900));

  const endVisible = state();
  const hiddenAfter = [...document.querySelectorAll('.reveal')].map(e => getComputedStyle(e).opacity).filter(o => parseFloat(o) < 0.99).length;
  return { total, startVisible, endVisible, hiddenBefore, hiddenAfter, scrollY: window.scrollY, docH: document.body.scrollHeight };
})()`);
console.log(scrollResult);

console.log('\n=== PARALLAX: transform hero-helix saat scroll ===');
const parallax = await evalJs(`(async () => {
  const h = document.querySelector('.hero-helix');
  const g = document.querySelector('.hero-glow');
  const read = () => ({ h: getComputedStyle(h).transform, g: getComputedStyle(g).transform, inlineH: h.style.transform, inlineG: g.style.transform, y: Math.round(window.scrollY) });
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 500));
  const at0 = read();
  window.scrollTo(0, 300);
  await new Promise(r => setTimeout(r, 400));
  const at300 = read();
  window.scrollTo(0, 600);
  await new Promise(r => setTimeout(r, 400));
  const at600 = read();
  return { at0, at300, at600,
    changed: new Set([at0.h, at300.h, at600.h]).size > 1,
    glowChanged: new Set([at0.g, at300.g, at600.g]).size > 1,
  };
})()`);
console.log(JSON.stringify(parallax, null, 2));

console.log('\n=== PARALLAX: simbol dekoratif Kenapa Helixa ===');
console.log(await evalJs(`(async () => {
  const sec = document.querySelector('#tentang');
  const inner = sec.querySelector('[aria-hidden="true"] > div');
  const read = () => getComputedStyle(inner).transform;
  window.scrollTo(0, sec.offsetTop - 200);
  await new Promise(r => setTimeout(r, 500));
  const a = read();
  window.scrollTo(0, sec.offsetTop + 200);
  await new Promise(r => setTimeout(r, 500));
  const b = read();
  return { found: !!inner, atA: a, atB: b, changed: a !== b };
})()`));

console.log('\n=== ANIMASI AKTIF saat halaman load ===');
console.log(await evalJs(`(() => {
  const anims = document.getAnimations();
  return {
    count: anims.length,
    details: anims.slice(0, 8).map(a => ({
      type: a.constructor.name,
      target: a.effect?.target?.tagName + '.' + (typeof a.effect?.target?.className === 'string' ? a.effect.target.className.slice(0,20) : ''),
      dur: a.effect?.getTiming?.().duration,
      props: a.effect?.getKeyframes?.().length,
    })),
  };
})()`));

console.log('\n=== HERO: apakah animasi load jalan ===');
console.log(await evalJs(`(() => {
  const h1 = document.querySelector('h1');
  const p = document.querySelector('h1').closest('div').parentElement.querySelectorAll('p');
  return {
    h1Opacity: getComputedStyle(h1).opacity,
    h1Transform: getComputedStyle(h1).transform,
    h1InView: h1.getBoundingClientRect().top > -50,
    eyebrowOpacity: getComputedStyle(h1.previousElementSibling).opacity,
  };
})()`));

ws.close(); chrome.kill(); process.exit(0);
