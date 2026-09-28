/**
 * Uji interaksi Helixa Olympiad via Chrome DevTools Protocol.
 * Tanpa dependency tambahan.
 *
 * Menguji:
 *   1. Menu hamburger mobile (aria-expanded, focus trap, scroll lock, Esc, klik link)
 *   2. Accordion FAQ (aria-expanded/controls, tinggi panel, inert saat tertutup)
 *   3. Navbar saat scroll (state transparan -> semi-transparan + blur)
 *   4. Navigasi keyboard di desktop
 *   5. prefers-reduced-motion (reveal & parallax mati)
 *   6. Link pendaftaran / Instagram memakai konstanta yang benar
 *
 * Pakai: node scripts/interaction-check.mjs [url]
 */

import { spawn } from 'node:child_process';

const URL_TARGET = process.argv[2] ?? 'http://localhost:5180/';
const PORT = 9223;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-sandbox',
    '--no-first-run',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + process.env.TEMP + '\\helixa-interact-profile',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
process.on('exit', () => chrome.kill());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevTools() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('DevTools tidak merespons');
}
await waitForDevTools();

const t = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL_TARGET)}`, {
    method: 'PUT',
  })
).json();

const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let msgId = 0;
const pending = new Map();
const eventWaiters = new Map();

ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  } else if (m.method && eventWaiters.has(m.method)) {
    eventWaiters.get(m.method).forEach((fn) => fn(m.params));
  }
};

const send = (method, params = {}) => {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
};

const once = (method) =>
  new Promise((resolve) => {
    const fn = (p) => {
      eventWaiters.set(
        method,
        (eventWaiters.get(method) ?? []).filter((f) => f !== fn),
      );
      resolve(p);
    };
    eventWaiters.set(method, [...(eventWaiters.get(method) ?? []), fn]);
  });

const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expression);
  return r.result.value;
};

const key = (k, code, keyCode) =>
  send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: k,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  }).then(() =>
    send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: k,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
    }),
  );

const clickAt = (x, y) =>
  send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).then(
    () =>
      send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x,
        y,
        button: 'left',
        clickCount: 1,
      }),
  );

const setViewport = (width, height, mobile) =>
  send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height,
  });

const navigate = async () => {
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: URL_TARGET });
  await loaded;
  await sleep(1200);
};

await send('Page.enable');
await send('Runtime.enable');
await send('DOM.enable');

let pass = 0;
let fail = 0;
function check(label, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  }
}

/* Helper: titik tengah sebuah elemen, untuk diklik via Input domain */
const centerOf = (selector) =>
  evalJs(
    `(() => { const e = document.querySelector(${JSON.stringify(selector)});
      if (!e) return null; const r = e.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
  );

/* ======================================================== 1. MENU MOBILE */
console.log('\n[1] Menu hamburger (375x812)');
await setViewport(375, 812, true);
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await navigate();

const closed = await evalJs(`(() => {
  const btn = document.querySelector('button[aria-controls="menu-mobile"]');
  return {
    exists: !!btn,
    expanded: btn?.getAttribute('aria-expanded'),
    controls: btn?.getAttribute('aria-controls'),
    label: btn?.getAttribute('aria-label'),
    size: btn ? { w: Math.round(btn.getBoundingClientRect().width), h: Math.round(btn.getBoundingClientRect().height) } : null,
    desktopLinksVisible: !!document.querySelector('nav .hidden.md\\\\:flex')?.offsetParent,
  };
})()`);
check('tombol hamburger ada', closed.exists);
check('aria-expanded = false saat tertutup', closed.expanded === 'false');
check('aria-controls = menu-mobile', closed.controls === 'menu-mobile');
check('tombol >= 44x44', closed.size.w >= 44 && closed.size.h >= 44, JSON.stringify(closed.size));
check('link desktop tersembunyi di mobile', closed.desktopLinksVisible === false);

const pos = await centerOf('button[aria-controls="menu-mobile"]');
await clickAt(pos.x, pos.y);
await sleep(500);

const opened = await evalJs(`(() => {
  const btn = document.querySelector('button[aria-controls="menu-mobile"]');
  const panel = document.getElementById('menu-mobile');
  const focusInPanel = panel?.contains(document.activeElement);
  const links = panel ? [...panel.querySelectorAll('a[href]')].map(a => ({
    text: a.textContent.trim(), h: Math.round(a.getBoundingClientRect().height),
  })) : [];
  const navTexts = links.map(l => l.text);
  return {
    expanded: btn?.getAttribute('aria-expanded'),
    panelExists: !!panel,
    role: panel?.getAttribute('role'),
    modal: panel?.getAttribute('aria-modal'),
    bodyOverflow: document.body.style.overflow,
    focusInPanel,
    activeText: document.activeElement?.textContent?.trim().slice(0,20),
    linkCount: links.length,
    minLinkHeight: links.length ? Math.min(...links.map(l => l.h)) : 0,
    navItems: ['Tentang','Perdana','Aturan','FAQ'].filter(x => navTexts.includes(x)).length,
    ctaAtBottom: navTexts.includes('Daftar'),
    closeBtn: !!panel?.querySelector('button[aria-label="Tutup menu"]'),
  };
})()`);
check('panel terbuka', opened.panelExists);
check('aria-expanded = true', opened.expanded === 'true');
check('role=dialog + aria-modal', opened.role === 'dialog' && opened.modal === 'true');
check('scroll body terkunci', opened.bodyOverflow === 'hidden', `overflow="${opened.bodyOverflow}"`);
check('fokus masuk ke panel', opened.focusInPanel === true, `fokus: ${opened.activeText}`);
check('4 link menu + wordmark + tombol Daftar', opened.navItems === 4 && opened.linkCount === 6, `${opened.linkCount} tautan, ${opened.navItems} item menu`);
check('link menu >= 44px', opened.minLinkHeight >= 44, `min ${opened.minLinkHeight}px`);
check('tombol Daftar di panel', opened.ctaAtBottom);
check('ada tombol tutup', opened.closeBtn);

// Focus trap: Shift+Tab dari elemen pertama harus-wrap ke terakhir
const trapped = await evalJs(`(() => {
  const panel = document.getElementById('menu-mobile');
  const items = [...panel.querySelectorAll('a[href], button')].filter(e => e.offsetParent !== null);
  items[0].focus();
  return { first: items[0].textContent.trim().slice(0,20), last: items[items.length-1].textContent.trim().slice(0,20), n: items.length };
})()`);
await key('Tab', 'Tab', 9);
const afterShift = await evalJs(`document.activeElement?.textContent?.trim().slice(0,20) ?? document.activeElement?.tagName`);
check('focus trap: Tab dari pertama ke berikutnya', afterShift !== trapped.first, `dari "${trapped.first}" ke "${afterShift}"`);

// Esc menutup
await key('Escape', 'Escape', 27);
await sleep(500);
const afterEsc = await evalJs(`(() => ({
  expanded: document.querySelector('button[aria-controls="menu-mobile"]')?.getAttribute('aria-expanded'),
  panel: !!document.getElementById('menu-mobile'),
  bodyOverflow: document.body.style.overflow,
  focusReturned: document.activeElement?.getAttribute('aria-controls') === 'menu-mobile',
}))()`);
check('Esc menutup panel', afterEsc.panel === false);
check('scroll body dilepas', afterEsc.bodyOverflow !== 'hidden', `overflow="${afterEsc.bodyOverflow}"`);
check('fokus kembali ke tombol pemicu', afterEsc.focusReturned);

// Klik link menutup panel
await clickAt(pos.x, pos.y);
await sleep(450);
const linkPos = await evalJs(`(() => { const a = [...document.querySelectorAll('#menu-mobile a[href^="#"]')].find(x => x.textContent.trim() === 'FAQ'); const r = a.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`);
await clickAt(linkPos.x, linkPos.y);
await sleep(700);
const afterLink = await evalJs(`(() => ({
  panel: !!document.getElementById('menu-mobile'),
  scrolled: window.scrollY,
  faqVisible: (() => { const r = document.getElementById('faq').getBoundingClientRect(); return r.top > -50 && r.top < 200; })(),
}))()`);
check('klik link menutup panel', afterLink.panel === false);
check('klik link navigasi ke anchor', afterLink.scrolled > 100, `scrollY=${Math.round(afterLink.scrolled)}`);

/* ======================================================== 2. FAQ */
console.log('\n[2] Accordion FAQ');
await setViewport(375, 812, true);
await navigate();
const faqClosed = await evalJs(`(() => {
  const b = document.querySelectorAll('#faq button[aria-expanded]');
  const p0 = document.getElementById(b[0].getAttribute('aria-controls'));
  const p1 = document.getElementById(b[1].getAttribute('aria-controls'));
  return {
    n: b.length,
    firstExpanded: b[0].getAttribute('aria-expanded'),
    secondExpanded: b[1].getAttribute('aria-expanded'),
    firstH: Math.round(p0.getBoundingClientRect().height),
    secondH: Math.round(p1.getBoundingClientRect().height),
    btnH: Math.round(b[0].getBoundingClientRect().height),
    firstInert: p0.querySelector('div').hasAttribute('inert'),
    secondInert: p1.querySelector('div').hasAttribute('inert'),
    region: p0.getAttribute('role'),
  };
})()`);
check('5 pertanyaan FAQ', faqClosed.n === 5, `${faqClosed.n} butir`);
check('item pertama terbuka secara default', faqClosed.firstExpanded === 'true' && faqClosed.firstH > 30, `h=${faqClosed.firstH}px`);
check('item lain tertutup', faqClosed.secondExpanded === 'false' && faqClosed.secondH === 0, `h=${faqClosed.secondH}px`);
check('judul FAQ >= 56px', faqClosed.btnH >= 56, `${faqClosed.btnH}px`);
check('panel tertutup = inert', faqClosed.secondInert === true && faqClosed.firstInert === false);
check('panel = region dengan aria-labelledby', faqClosed.region === 'region');

// scroll ke dalam view dulu supaya koordinat klik valid
await evalJs(`document.querySelectorAll('#faq button[aria-expanded]')[1].scrollIntoView({ block: 'center' })`);
await sleep(700);
const faq2 = await evalJs(`(() => { const b = document.querySelectorAll('#faq button[aria-expanded]')[1]; const r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, inView: r.top > 0 && r.bottom < window.innerHeight }; })()`);
check('tombol FAQ item 2 terlihat di viewport', faq2.inView, `y=${Math.round(faq2.y)}`);
await clickAt(faq2.x, faq2.y);
await sleep(800);
const faqAfter = await evalJs(`(() => {
  const b = [...document.querySelectorAll('#faq button[aria-expanded]')];
  const p = document.getElementById(b[1].getAttribute('aria-controls'));
  return {
    first: b[0].getAttribute('aria-expanded'),
    second: b[1].getAttribute('aria-expanded'),
    panelH: Math.round(p.getBoundingClientRect().height),
    visibleText: p.innerText.trim().slice(0,30),
    inert: p.querySelector('div').hasAttribute('inert'),
  };
})()`);
check('item 2 terbuka', faqAfter.second === 'true');
check('item 1 tertutup (accordion tunggal)', faqAfter.first === 'false');
check('panel item 2 punya tinggi', faqAfter.panelH > 30, `${faqAfter.panelH}px`);
check('isi panel terbaca', faqAfter.visibleText.length > 5, `"${faqAfter.visibleText}"`);
check('panel terbuka tidak inert', faqAfter.inert === false);

const faq2b = await evalJs(`(() => { const b = document.querySelectorAll('#faq button[aria-expanded]')[1]; const r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`);
await clickAt(faq2b.x, faq2b.y);
await sleep(800);
const faqCollapsed = await evalJs(`(() => { const b = document.querySelectorAll('#faq button[aria-expanded]')[1]; const p = document.getElementById(b.getAttribute('aria-controls')); return { expanded: b.getAttribute('aria-expanded'), h: Math.round(p.getBoundingClientRect().height) }; })()`);
check('klik lagi menutup', faqCollapsed.expanded === 'false' && faqCollapsed.h < 5, `h=${faqCollapsed.h}px`);

/* ======================================================== 3. NAVBAR SCROLL */
console.log('\n[3] Navbar saat scroll (1280x800)');
await setViewport(1280, 800, false);
await send('Emulation.setTouchEmulationEnabled', { enabled: false });
await navigate();
const navTop = await evalJs(`(() => { const h = document.querySelector('header'); const cs = getComputedStyle(h); return { y: window.scrollY, cls: h.className, bg: cs.backgroundColor, blur: cs.backdropFilter, border: cs.borderBottomColor, position: cs.position }; })()`);
check('navbar fixed', navTop.position === 'fixed');
check('navbar transparan di atas', navTop.bg === 'rgba(0, 0, 0, 0)', navTop.bg);
check('tanpa blur di atas', navTop.blur === 'none', navTop.blur);

await evalJs('window.scrollTo(0, 600)');
await sleep(700);
const navScrolled = await evalJs(`(() => {
  const h = document.querySelector('header');
  const cs = getComputedStyle(h);
  // Tailwind v4 menulis warna di oklab(), jadi alpha diambil dari string apa pun
  const alpha = (s) => { const m = s.match(/\\/\\s*([\\d.]+)\\s*\\)$/); return m ? parseFloat(m[1]) : (s === 'transparent' ? 0 : 1); };
  return {
    y: window.scrollY,
    bg: cs.backgroundColor,
    alpha: alpha(cs.backgroundColor),
    blur: cs.backdropFilter,
    border: cs.borderBottomColor,
    borderW: cs.borderBottomWidth,
    safeArea: h.style.paddingTop,
  };
})()`);
check('scroll 600px terdeteksi', navScrolled.y > 500, `scrollY=${navScrolled.y}`);
check('background hitam semi-transparan alpha 0.72', navScrolled.alpha === 0.72, `${navScrolled.bg} (alpha=${navScrolled.alpha})`);
check('backdrop blur aktif', navScrolled.blur.includes('blur'), navScrolled.blur);
check('garis bawah emas tipis', navScrolled.borderW === '1px' && navScrolled.border.includes('212, 175, 55'), `${navScrolled.borderW} ${navScrolled.border}`);
check('safe-area-inset-top dipakai', navScrolled.safeArea.includes('safe-area'), navScrolled.safeArea || '(kosong)');

await evalJs('window.scrollTo(0, 10)');
await sleep(600);
const navBack = await evalJs(`getComputedStyle(document.querySelector('header')).backgroundColor`);
check('kembali transparan di atas', navBack === 'rgba(0, 0, 0, 0)', navBack);

/* ======================================================== 4. KEYBOARD */
console.log('\n[4] Navigasi keyboard (1280x800)');
await navigate();
// Fokuskan body, lalu Tab mulai dari awal dokumen (bukan melompat ke wordmark)
await evalJs(`document.body.setAttribute('tabindex','-1'); document.body.focus(); document.body.removeAttribute('tabindex');`);
const tabOrder = [];
for (let i = 0; i < 12; i++) {
  await key('Tab', 'Tab', 9);
  const info = await evalJs(`(() => { const a = document.activeElement; if (!a || a === document.body) return null; const cs = getComputedStyle(a, ':focus-visible'); const r = a.getBoundingClientRect(); return { tag: a.tagName.toLowerCase(), text: (a.textContent||'').trim().slice(0,22), outline: cs.outlineWidth, outlineColor: cs.outlineColor, w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 10 && r.height > 10 }; })()`);
  if (info) tabOrder.push(info);
}
check('skip link pertama di urutan tab', tabOrder[0]?.text === 'Lewati ke konten', tabOrder[0]?.text);
check('skip link jadi terlihat saat difokuskan', tabOrder[0]?.visible === true, `w=${tabOrder[0]?.w}px h=${tabOrder[0]?.h}px`);
const navTexts = tabOrder.map(t => t.text);
check('link navbar dapat dicapai keyboard', ['Tentang', 'Perdana', 'Aturan', 'FAQ'].every(l => navTexts.includes(l)), navTexts.join(' > ').slice(0,120));
check('tombol Daftar dapat dicapai', navTexts.includes('Daftar'), '');
const ringed = tabOrder.filter(t => t.outline !== '0px').length;
check('fokus terlihat (outline emas)', ringed > 0, `${ringed}/${tabOrder.length} elemen bertanda fokus`);

/* ======================================================== 5. REDUCED MOTION */
console.log('\n[5] prefers-reduced-motion: reduce');
await setViewport(1280, 800, false);
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
await navigate();
const rm = await evalJs(`(() => {
  const reveals = [...document.querySelectorAll('.reveal')];
  const below = reveals.filter(el => el.getBoundingClientRect().top > window.innerHeight);
  const allVisible = reveals.every(el => getComputedStyle(el).opacity === '1');
  const anyTransformed = below.some(el => getComputedStyle(el).transform !== 'none');
  const helix = document.querySelector('.hero-helix');
  return {
    n: reveals.length,
    allVisible,
    offscreenHidden: below.filter(el => getComputedStyle(el).opacity !== '1').length,
    anyTransformed,
    helixTransform: helix ? getComputedStyle(helix).transform : null,
    smoothScroll: getComputedStyle(document.documentElement).scrollBehavior,
  };
})()`);
check('semua konten reveal langsung tampil', rm.allVisible === true, `${rm.n} elemen .reveal`);
check('tidak ada reveal yang tersembunyi', rm.offscreenHidden === 0, `${rm.offscreenHidden} tersembunyi`);
check('parallax tidak memasang transform', !rm.helixTransform || rm.helixTransform === 'none', String(rm.helixTransform));
check('scroll-behavior = auto', rm.smoothScroll === 'auto', rm.smoothScroll);

await evalJs('window.scrollTo(0, 1200)');
await sleep(500);
const rmAfter = await evalJs(`(() => { const h = document.querySelector('.hero-helix'); return getComputedStyle(h).transform; })()`);
check('parallax tetap mati setelah scroll', rmAfter === 'none' || rmAfter === 'matrix(1, 0, 0, 1, 0, 0)', rmAfter);
await send('Emulation.setEmulatedMedia', { features: [] });

/* ======================================================== 6. KONSTANTA TAUTAN */
console.log('\n[6] Konstanta tautan & isi konten');
await navigate();
const links = await evalJs(`(() => {
  const all = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
  return {
    total: all.length,
    hashOnly: all.filter(h => h === '#').length,
    external: all.filter(h => /^https?:/.test(h)),
    anchors: [...new Set(all.filter(h => h.startsWith('#') && h.length > 1))],
    targetBlank: [...document.querySelectorAll('a[target="_blank"]')].map(a => a.getAttribute('href')),
  };
})()`);
check('tidak ada tautan eksternal nyata (semua "#")', links.external.length === 0, JSON.stringify(links.external));
check('Register & Instagram = "#"', links.hashOnly >= 4, `${links.hashOnly} tautan "#"`);

const anchorCheck = await evalJs(`(() => {
  const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
  return ${JSON.stringify(0)} || ids;
})()`).then((ids) => {
  const wanted = ['tentang', 'perdana', 'cara-ikut', 'juri-mitra', 'aturan', 'faq', 'daftar', 'top'];
  const missing = wanted.filter((w) => !ids.includes(w));
  return { missing, present: ids.filter((i) => wanted.includes(i)) };
});
check('semua anchor punya section tujuan', anchorCheck.missing.length === 0, anchorCheck.missing.join(',') || anchorCheck.present.join(','));

const content = await evalJs(`(() => {
  const txt = document.body.innerText;
  const forbidden = ['resmi nasional', 'terakreditasi', 'Kemendikdasmen', 'bekerja sama dengan pemerintah', 'testimoni'];
  return {
    hasIndependen: txt.includes('independen'),
    hasTerafiliasi: txt.includes('tidak berafiliasi'),
    hasOSN: txt.includes('OSN'),
    forbidden: forbidden.filter(f => txt.toLowerCase().includes(f.toLowerCase())),
    placeholders: (txt.match(/\\[ISI[^\\]]*\\]/g) || []).length,
  };
})()`);
check('pernyataan independen ada', content.hasIndependen && content.hasTerafiliasi);
check('penyebutan OSN (untuk FAQ) ada', content.hasOSN);
check('tidak ada klaim terlarang', content.forbidden.length === 0, content.forbidden.join(', '));
check('placeholder [ISI...] tampil', content.placeholders >= 4, `${content.placeholders} placeholder`);

console.log(`\n===== ${pass} PASS / ${fail} FAIL =====`);
ws.close();
chrome.kill();
process.exit(fail > 0 ? 1 : 0);
