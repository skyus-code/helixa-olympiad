/**
 * Audit responsif Helixa Olympiad via Chrome DevTools Protocol.
 * Tanpa dependency tambahan - memakai WebSocket bawaan Node.
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

const URL_TARGET = process.argv[2] ?? 'http://localhost:4200/';
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
// Headless Chrome default-nya prefers-reduced-motion: reduce - paksa animasi aktif
// supaya screenshot & pengukuran mencerminkan keadaan normal.
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
});

/* ------------------------------------------------------- audit in-page js */

const AUDIT = `(() => {
  const de = document.documentElement;
  const vw = de.clientWidth;

  const hasHScroll = de.scrollWidth > vw + 1;
  const overflowAmount = de.scrollWidth - vw;

  // Elemen yang melewati viewport, diabaikan bila ancestor-nya memang
  // meng-clip (ornamen dekoratif memang begitu desainnya).
  const isClipped = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const ov = getComputedStyle(p).overflowX;
      if (ov === 'clip' || ov === 'hidden' || ov === 'auto' || ov === 'scroll') return true;
      p = p.parentElement;
    }
    return false;
  };

  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      if (!isClipped(el)) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (typeof el.className === 'string' ? el.className : '').slice(0, 60),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
    }
  }

  // Teks yang terpotong vertikal: scrollHeight jauh lebih besar dari tinggi.
  const clipped = [];
  for (const el of document.querySelectorAll('h1,h2,h3,p,span,a,li,button,dd,dt')) {
    if (el.children.length > 0) continue;
    // Skip link sr-only sengaja diklip 1px: itu cara kerjanya, bukan bug.
    if (el.classList.contains('sr-only') || el.closest('.sr-only')) continue;
    // Elemen dengan clip-path juga disengaja secara visual, bukan terpotong.
    const cs = getComputedStyle(el);
    if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') {
      if (el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 0) {
        clipped.push({ tag: el.tagName.toLowerCase(), text: (el.textContent||'').slice(0,40) });
      }
    }
  }

  return {
    width: vw,
    hasHScroll,
    overflowAmount,
    offenders: offenders.slice(0, 8),
    clipped: clipped.slice(0, 6),
    docHeight: document.body.scrollHeight,
  };
})()`;

/* ------------------------------------------------------------------- run */

const results = [];
let failures = 0;

for (const vp of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 1,
    mobile: vp.mobile,
    screenWidth: vp.width,
    screenHeight: vp.height,
  });
  // Pointer presisi di viewports non-mobile supaya kursor/magnet aktif.
  if (!vp.mobile) {
    await send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-reduced-motion', value: 'no-preference' },
        { name: 'any-pointer', value: 'fine' },
        { name: 'any-hover', value: 'hover' },
      ],
    });
  }

  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: URL_TARGET });
  await loaded;
  // Beri waktu untuk animasi load hero, import three.js, dan SplitText selesai.
  await sleep(3200);

  const audit = await send('Runtime.evaluate', {
    expression: AUDIT,
    returnByValue: true,
  });

  const r = audit.result.value;
  const problems = [];
  if (r.hasHScroll) problems.push('H-SCROLL ' + r.overflowAmount + 'px');
  if (r.offenders.length) problems.push('MELUBER ' + r.offenders.length);
  if (r.clipped.length) problems.push('TERPOTONG ' + r.clipped.length);

  if (problems.length) failures++;

  results.push({ viewport: vp.name, ...r, problems });

  console.log(
    (problems.length ? 'FAIL ' : 'ok   ') +
      vp.name.padEnd(16) +
      ' w=' + String(r.width).padEnd(5) +
      ' h=' + String(r.docHeight).padEnd(6) +
      (problems.length ? problems.join(' | ') : ''),
  );
  if (r.offenders.length) {
    r.offenders.forEach((o) => console.log('        meluber: ' + o.tag + '.' + o.cls));
  }
  if (r.clipped.length) {
    r.clipped.forEach((c) => console.log('        terpotong: "' + c.text + '"'));
  }

  // Screenshot full-page
  const metrics = await send('Page.getLayoutMetrics');
  const full = metrics.cssContentSize;
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: full.width, height: Math.min(full.height, 24000), scale: 1 },
  });
  writeFileSync(`${OUT_DIR}/${vp.name}.png`, Buffer.from(shot.data, 'base64'));
}

writeFileSync(`${OUT_DIR}/audit.json`, JSON.stringify(results, null, 2));
console.log('\n' + (VIEWPORTS.length - failures) + '/' + VIEWPORTS.length + ' viewport bersih.');
console.log('Screenshot + audit.json di ' + OUT_DIR + '/');

ws.close();
chrome.kill();
process.exit(0);
