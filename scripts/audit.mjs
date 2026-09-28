/**
 * Audit responsif Helixa Olympiad via Chrome DevTools Protocol.
 * Tanpa dependency tambahan — memakai WebSocket bawaan Node 18+.
 *
 * Untuk setiap lebar:
 *   - deteksi scroll horizontal + elemen yang meluber
 *   - cek teks yang tumpang tindih / terpotong
 *   - screenshot full-page
 *
 * Pakai: node scripts/audit.mjs [url]
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const URL_TARGET = process.argv[2] ?? 'http://localhost:5180/';
const OUT_DIR = 'screenshots';
const PORT = 9222;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const VIEWPORTS = [
  { name: 'w320', width: 320, height: 720, mobile: true },
  { name: 'w375', width: 375, height: 812, mobile: true },
  { name: 'w430', width: 430, height: 932, mobile: true },
  { name: 'w768', width: 768, height: 1024, mobile: false },
  { name: 'w1024', width: 1024, height: 768, mobile: false },
  { name: 'w1280', width: 1280, height: 800, mobile: false },
  { name: 'w1440', width: 1440, height: 900, mobile: false },
  { name: 'w1920', width: 1920, height: 1080, mobile: false },
  { name: 'land-844x390', width: 844, height: 390, mobile: true },
  { name: 'land-740x360', width: 740, height: 360, mobile: true },
  { name: 'land-1024x768', width: 1024, height: 768, mobile: false },
];

mkdirSync(OUT_DIR, { recursive: true });

/* ------------------------------------------------------------------ chrome */

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-sandbox',
    '--no-first-run',
    '--disable-extensions',
    '--force-color-profile=srgb',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=' + process.env.TEMP + '\\helixa-audit-profile',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

process.on('exit', () => chrome.kill());

async function waitForDevTools() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      /* belum siap */
    }
    await sleep(250);
  }
  throw new Error('DevTools tidak merespons');
}

await waitForDevTools();

const targetRes = await fetch(
  `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL_TARGET)}`,
  { method: 'PUT' },
);
const target = await targetRes.json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

/* ------------------------------------------------------------- cdp client */

let msgId = 0;
const pending = new Map();
const events = new Map();

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  } else if (msg.method && events.has(msg.method)) {
    events.get(msg.method).forEach((fn) => fn(msg.params));
  }
};

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function once(method) {
  return new Promise((resolve) => {
    const list = events.get(method) ?? [];
    const fn = (p) => {
      events.set(method, events.get(method).filter((f) => f !== fn));
      resolve(p);
    };
    events.set(method, [...list, fn]);
  });
}

await send('Page.enable');
await send('Runtime.enable');
// Headless Chrome default-nya prefers-reduced-motion: reduce — paksa animasi aktif
// supaya screenshot & pengukuran mencerminkan keadaan normal.
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
});

/* ------------------------------------------------------- audit in-page js */

const AUDIT = `(() => {
  const de = document.documentElement;
  const vw = de.clientWidth;

  // 1. Scroll horizontal
  const hasHScroll = de.scrollWidth > vw + 1;
  const overflowAmount = de.scrollWidth - vw;

  // 2. Elemen yang melewati viewport (abaikan yang memang di-clipe ancestor-nya)
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    // Abaikan bila sudah di-clip oleh ancestor-nya (overflow-x hidden/clip)
    let clipped = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      if (/hidden|clip/.test(pcs.overflowX)) { clipped = true; break; }
    }
    if (clipped) continue;
    if (r.right > vw + 1 || r.left < -1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && typeof el.className === 'string')
          ? el.className.slice(0, 70) : '',
        left: Math.round(r.left), right: Math.round(r.right),
      });
    }
  }

  // 3. Elemen yang meluber ke kanan viewport (indeks)
  const bodyOverflow = document.body.scrollWidth - de.clientWidth;

  // 4. Teks terpotong (scrollWidth > clientWidth pada elemen teks)
  const clippedText = [];
  for (const el of document.querySelectorAll('h1,h2,h3,p,a,button,span,dt,dd,li')) {
    if (el.children.length > 0 && el.tagName !== 'BUTTON' && el.tagName !== 'A') continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      const cs = getComputedStyle(el);
      if (cs.overflow === 'visible' && cs.textOverflow !== 'ellipsis') {
        clippedText.push({ tag: el.tagName.toLowerCase(), text: (el.textContent||'').trim().slice(0,40) });
      }
    }
  }

  // 5. Target sentuh terlalu kecil
  const smallTargets = [];
  for (const el of document.querySelectorAll('a,button')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (getComputedStyle(el).display === 'inline' && el.closest('p,li,dd')) continue;
    if (r.height < 43.5 || r.width < 43.5) {
      smallTargets.push({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent||'').trim().slice(0,30),
        w: Math.round(r.width), h: Math.round(r.height),
      });
    }
  }

  // 6. Font heading yang terlalu kecil (< 28px) memakai Cormorant
  const smallDisplay = [];
  for (const el of document.querySelectorAll('h1,h2,h3,span,p,a,button')) {
    const fam = getComputedStyle(el).fontFamily;
    if (!/Cormorant/i.test(fam)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    const text = (el.textContent||'').trim();
    if (size < 28 && text && !el.querySelector('*') && text.length > 2) {
      smallDisplay.push({ tag: el.tagName.toLowerCase(), size: Math.round(size), text: text.slice(0,32) });
    }
  }

  // 7. Lebar shell harus <= 1120
  const shell = document.querySelector('.shell');
  const shellWidth = shell ? Math.round(shell.getBoundingClientRect().width) : null;

  // 7b. Konten yang meluber dari induknya (overflow visible) — mis. placeholder panjang
  const parentOverflow = [];
  for (const el of document.querySelectorAll('h1,h2,h3,p,span,a,li,dd,dt,button')) {
    const p = el.parentElement;
    if (!p) continue;
    if (getComputedStyle(el).display === 'inline') continue;
    const cs = getComputedStyle(el);
    const pcs = getComputedStyle(p);
    if (cs.overflow !== 'visible' || /hidden|clip|auto|scroll/.test(pcs.overflowX)) continue;
    if (el.scrollWidth > p.clientWidth + 2 && p.clientWidth > 0) {
      parentOverflow.push({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent||'').trim().slice(0,34),
        elW: el.scrollWidth, parentW: p.clientWidth,
      });
    }
  }

  // 8. Tinggi hero
  const hero = document.querySelector('.hero-section');
  const heroH = hero ? Math.round(hero.getBoundingClientRect().height) : null;
  const vh = window.innerHeight;

  return {
    vw, hasHScroll, overflowAmount, bodyOverflow,
    offenders: offenders.slice(0, 8),
    clippedText: clippedText.slice(0, 8),
    smallTargets: smallTargets.slice(0, 8),
    smallDisplay: smallDisplay.slice(0, 8),
    parentOverflow: parentOverflow.slice(0, 8),
    shellWidth, heroH, vh,
  };
})()`;

/* ------------------------------------------------------------------ loop */

const results = [];

for (const vp of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 1,
    mobile: vp.mobile,
    screenWidth: vp.width,
    screenHeight: vp.height,
  });

  if (vp.mobile) {
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  } else {
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  }

  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: URL_TARGET });
  await loaded;
  await sleep(1400); // tunggu animasi load + reveal
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0,0)' });
  await sleep(600);

  // Gulik seluruh halaman supaya semua .reveal terpicu, lalu kembali ke atas.
  // Ini memastikan elemen yang tadinya opacity:0 tidak diukur sebagai "kosong".
  await send('Runtime.evaluate', {
    expression: `(async () => {
      const step = window.innerHeight * 0.6;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
    })()`,
    awaitPromise: true,
  });
  await sleep(1200);

  const audit = await send('Runtime.evaluate', {
    expression: AUDIT,
    returnByValue: true,
  });

  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  writeFileSync(`${OUT_DIR}/${vp.name}.png`, Buffer.from(shot.data, 'base64'));

  const r = audit.result.value;
  results.push({ vp: vp.name, ...r });

  const flag = r.hasHScroll ? 'H-SCROLL!' : 'ok';
  console.log(
    `${vp.name.padEnd(14)} ${flag.padEnd(11)} vw=${r.vw} shell=${r.shellWidth} hero=${r.heroH}/${r.vh}` +
      (r.hasHScroll ? ` overflow=+${r.overflowAmount}px` : '') +
      (r.offenders.length ? ` offenders=${r.offenders.length}` : '') +
      (r.clippedText.length ? ` clippedText=${r.clippedText.length}` : '') +
      (r.smallTargets.length ? ` smallTargets=${r.smallTargets.length}` : '') +
      (r.smallDisplay.length ? ` smallDisplay=${r.smallDisplay.length}` : '') +
      (r.parentOverflow.length ? ` parentOverflow=${r.parentOverflow.length}` : ''),
  );

  if (r.offenders.length) console.log('   leuber:', JSON.stringify(r.offenders));
  if (r.clippedText.length) console.log('   teks terpotong:', JSON.stringify(r.clippedText));
  if (r.smallTargets.length) console.log('   target < 44px:', JSON.stringify(r.smallTargets));
  if (r.smallDisplay.length) console.log('   display < 28px:', JSON.stringify(r.smallDisplay));
  if (r.parentOverflow.length) console.log('   luber dari induk:', JSON.stringify(r.parentOverflow));
}

writeFileSync(`${OUT_DIR}/audit.json`, JSON.stringify(results, null, 2));
console.log(`\nSelesai. Screenshot + audit.json di ${OUT_DIR}/`);
ws.close();
chrome.kill();
process.exit(0);
