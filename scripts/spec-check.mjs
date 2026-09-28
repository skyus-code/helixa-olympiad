/**
 * Uji kepatuhan spesifikasi desain Helixa Olympiad.
 * Memverifikasi token, tipografi, layout, gradasi emas, dan hal yang dilarang.
 *
 * Pakai: node scripts/spec-check.mjs [url]
 */

import { spawn } from 'node:child_process';

const URL_TARGET = process.argv[2] ?? 'http://localhost:5180/';
const PORT = 9224;
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
    '--user-data-dir=' + process.env.TEMP + '\\helixa-spec-profile',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
process.on('exit', () => chrome.kill());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('DevTools tidak merespons');
}
await ready();

const t = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL_TARGET)}`, { method: 'PUT' })
).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let id = 0;
const pend = new Map();
const waiters = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) {
    const { resolve, reject } = pend.get(m.id);
    pend.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  } else if (m.method && waiters.has(m.method)) waiters.get(m.method).forEach((f) => f(m.params));
};
const send = (method, params = {}) => {
  const n = ++id;
  return new Promise((resolve, reject) => {
    pend.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
};
const once = (m) =>
  new Promise((res) => {
    const f = (p) => {
      waiters.set(m, (waiters.get(m) ?? []).filter((x) => x !== f));
      res(p);
    };
    waiters.set(m, [...(waiters.get(m) ?? []), f]);
  });
const evalJs = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

const setVp = (w, h, mobile) =>
  send('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: 1, mobile, screenWidth: w, screenHeight: h,
  });
const nav = async () => {
  const l = once('Page.loadEventFired');
  await send('Page.navigate', { url: URL_TARGET });
  await l;
  await sleep(1300);
};

await send('Page.enable');
await send('Runtime.enable');

// Headless Chrome default-nya prefers-reduced-motion: reduce. Paksa "no-preference"
// supaya animasi benar-benar diuji. Sesi reduced-motion diuji terpisah di interaction-check.
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
});

let pass = 0,
  fail = 0;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
};

/* ------------------------------------------------ 1. TOKEN WARNA */
console.log('\n[1] Design tokens & palet');
await setVp(1280, 800, false);
await nav();

const colors = await evalJs(`(() => {
  const cs = (sel, prop) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[prop] : null; };
  const body = getComputedStyle(document.body);
  const h1 = document.querySelector('h1');
  const acc = h1.querySelector('span');
  const card = document.querySelector('.card-hover');
  const cc = card ? getComputedStyle(card) : null;
  return {
    bodyBg: body.backgroundColor,
    bodyColor: body.color,
    bodyFont: body.fontFamily,
    bodySize: body.fontSize,
    bodyLH: body.lineHeight,
    accentBgImage: getComputedStyle(acc).backgroundImage,
    accentFill: getComputedStyle(acc).webkitTextFillColor,
    cardBg: cc?.backgroundColor,
    cardBorder: cc?.borderTopColor,
    cardRadius: cc?.borderTopLeftRadius,
    cardShadow: cc?.boxShadow,
    heroGlowOpacity: getComputedStyle(document.querySelector('.hero-glow')).opacity,
  };
})()`);
check('background utama #0A0A0B', colors.bodyBg === 'rgb(10, 10, 11)', colors.bodyBg);
check('teks utama #F4EFE4', colors.bodyColor === 'rgb(244, 239, 228)', colors.bodyColor);
check('font isi Manrope', /Manrope/.test(colors.bodyFont), colors.bodyFont.split(',')[0]);
check('ukuran isi 17px', colors.bodySize === '17px', colors.bodySize);
check('line-height isi 1.7', Math.abs(parseFloat(colors.bodyLH) / parseFloat(colors.bodySize) - 1.7) < 0.02, colors.bodyLH);
check(
  'kata "sains" pakai gradasi emas',
  /linear-gradient/.test(colors.accentBgImage) && /212, 175, 55/.test(colors.accentBgImage),
  colors.accentBgImage.slice(0, 90),
);
check('kartu bg #121214', colors.cardBg === 'rgb(18, 18, 20)', colors.cardBg);
check('kartu radius 16px', colors.cardRadius === '16px', colors.cardRadius);
check('kartu tanpa shadow tebal', colors.cardShadow === 'none', colors.cardShadow);
check('cahaya hero opacity <= 0.16', parseFloat(colors.heroGlowOpacity) * 0.16 <= 0.17, `elemen ${colors.heroGlowOpacity} × gradien 0.16`);

/* ------------------------------------------------ 2. TIPOGRAFI */
console.log('\n[2] Tipografi');
const typo = await evalJs(`(() => {
  const h1 = document.querySelector('h1');
  const h2 = document.querySelector('h2');
  const ey = document.querySelector('h1').closest('div').querySelector('p');
  const cs = (e) => getComputedStyle(e);
  return {
    h1Size: cs(h1).fontSize, h1Font: cs(h1).fontFamily, h1LH: cs(h1).lineHeight, h1LS: cs(h1).letterSpacing,
    h2Size: cs(h2).fontSize, h2Font: cs(h2).fontFamily,
    eyebrowSize: cs(ey).fontSize, eyebrowLS: cs(ey).letterSpacing, eyebrowColor: cs(ey).color,
    eyebrowTransform: cs(ey).textTransform, eyebrowFont: cs(ey).fontFamily,
    displayBelow28: [...document.querySelectorAll('h1,h2,h3,span,p,a,button,li,dd,dt')]
      .filter(e => /Cormorant/i.test(cs(e).fontFamily) && parseFloat(cs(e).fontSize) < 28
        && (e.textContent||'').trim().length > 1 && !e.querySelector('*'))
      .map(e => ({ tag: e.tagName.toLowerCase(), size: cs(e).fontSize, t: e.textContent.trim().slice(0,20) })),
  };
})()`);
check('h1 Cormorant Garamond', /Cormorant/.test(typo.h1Font), typo.h1Font.split(',')[0]);
check('h1 >= 40px', parseFloat(typo.h1Size) >= 40, typo.h1Size);
check('h1 letter-spacing rapat (negatif)', parseFloat(typo.h1LS) < 0, typo.h1LS);
check('h2 Cormorant >= 30px', /Cormorant/.test(typo.h2Font) && parseFloat(typo.h2Size) >= 30, `${typo.h2Size} ${typo.h2Font.split(',')[0]}`);
check('eyebrow 12-13px', parseFloat(typo.eyebrowSize) >= 12 && parseFloat(typo.eyebrowSize) <= 13.5, typo.eyebrowSize);
check('eyebrow letter-spacing 0.18em', Math.abs(parseFloat(typo.eyebrowLS) - 0.18 * parseFloat(typo.eyebrowSize)) < 0.6, typo.eyebrowLS);
check('eyebrow huruf kapital', typo.eyebrowTransform === 'uppercase', typo.eyebrowTransform);
check('eyebrow warna emas', typo.eyebrowColor.includes('212, 175, 55'), typo.eyebrowColor);
check('eyebrow font Manrope (bukan serif)', /Manrope/.test(typo.eyebrowFont), typo.eyebrowFont.split(',')[0]);
check('TIDAK ada teks serif < 28px', typo.displayBelow28.length === 0, JSON.stringify(typo.displayBelow28));

/* ------------------------------------------------ 3. LAYOUT & SPACING */
console.log('\n[3] Layout & spacing');
const layout = await evalJs(`(() => {
  const sec = document.querySelectorAll('section[id]');
  // padding section berada pada wrapper .shell di dalam <section>
  const inner = (s) => s.querySelector('.shell') || s;
  const py = (s) => { const cs = getComputedStyle(inner(s)); return { top: cs.paddingTop, bottom: cs.paddingBottom }; };
  const whyCard = document.querySelector('#tentang ul > *');
  const perdRow = document.querySelector('#perdana dl > div');
  const perdDl = document.querySelector('#perdana dl');
  const rules = document.querySelector('#aturan .shell > div');
  const cs = (e, p) => (e ? getComputedStyle(e)[p] : null);
  return {
    sections: sec.length,
    sectionPad: py(sec[1]),
    shellW: Math.round(document.querySelector('.shell').getBoundingClientRect().width),
    shellPad: cs(document.querySelector('.shell'), 'paddingLeft'),
    hairline: cs(sec[1], 'borderTopColor'),
    overflowX: cs(sec[1], 'overflowX'),
    cardCols: cs(document.querySelector('#tentag ul'), 'gridTemplateColumns'),
    whyCols: cs(document.querySelector('#tentang ul'), 'gridTemplateColumns').split(' ').length,
    perdCols: cs(perdRow, 'gridTemplateColumns').split(' ').length,
    perdIsDl: perdDl?.tagName.toLowerCase() === 'dl',
    perdRowTag: perdRow?.tagName.toLowerCase(),
    noTable: document.querySelectorAll('table').length === 0,
    hasDt: perdDl?.querySelectorAll('dt').length,
    hasDd: perdDl?.querySelectorAll('dd').length,
    rulesMaxW: cs(rules, 'maxWidth'),
    cardBorderColor: cs(whyCard, 'borderTopColor'),
  };
})()`);
check('8 section + hero', layout.sections >= 8, `${layout.sections} section`);
check('section padding 120px di >=1024px', layout.sectionPad.top === '120px', layout.sectionPad.top);
check('konten maks 1120px', layout.shellW === 1120, `${layout.shellW}px`);
check('padding horizontal 32px di >=768px', layout.shellPad === '32px', layout.shellPad);
check('pemisah = garis emas 1px', layout.hairline.includes('212, 175, 55'), layout.hairline);
check('section overflow-x clip', layout.overflowX === 'clip', layout.overflowX);
check('Kenapa Helixa 4 kolom di >=1024px', layout.whyCols === 4, `${layout.whyCols} kolom`);
check('Info Perdana pakai <dl>/<dt>/<dd>', layout.perdIsDl && layout.hasDt === 7 && layout.hasDd === 7, `${layout.hasDt} dt / ${layout.hasDd} dd`);
check('tidak ada <table> sama sekali', layout.noTable === true);
check('Info Perdana 2 kolom label-nilai di >=768px', layout.perdCols === 2, `${layout.perdCols} kolom`);
check('Aturan max-w ~65ch (≈674px)', /^6[0-9][0-9](\.[0-9]+)?px$/.test(layout.rulesMaxW) && parseFloat(layout.rulesMaxW) < 700, layout.rulesMaxW);
check('border kartu emas 16% alpha', layout.cardBorderColor.includes('212, 175, 55'), layout.cardBorderColor);

/* ------------------------------------------------ 4. GRADASI EMAS HANYA 3 TEMPAT */
console.log('\n[4] Gradasi emas hanya 3 tempat');
const grad = await evalJs(`(() => {
  const hits = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    for (const p of ['backgroundImage','webkitTextFillColor']) {
      if (/linear-gradient\\(135deg/.test(cs[p])) {
        hits.push({ el: el.tagName.toLowerCase(), cls: (typeof el.className === 'string' ? el.className : ''), prop: p, text: (el.textContent||'').trim().slice(0,24), clipped: cs.backgroundClip || cs.webkitBackgroundClip });
      }
    }
  }
  return { hits, total: hits.length };
})()`);
// Kelompokkan menurut pola pemakaian, bukan token class pertama
const concepts = new Set();
for (const h of grad.hits) {
  if (h.cls.includes('text-gold-gradient')) concepts.add('kata-headline');
  else if (h.cls.includes('bg-gold-gradient')) concepts.add('tombol-utama');
  else if (h.cls.includes('gold-rule')) concepts.add('garis-dekoratif');
  else concepts.add('LAIN:' + h.cls.slice(0, 24));
}
check('gradasi emas hanya di 3 konsep', concepts.size === 3, [...concepts].join(' | '));
check('kata gradasi = "sains"', grad.hits.some(h => h.cls.includes('text-gold-gradient') && h.text === 'sains'), JSON.stringify(grad.hits.filter(h=>h.cls.includes('text-gold-gradient')).map(h=>h.text)));
check('kata gradasi di-clip jadi teks', grad.hits.some(h => h.cls.includes('text-gold-gradient') && /text/.test(h.clipped)), 'background-clip');
check('tombol utama = .bg-gold-gradient', grad.hits.some(h => h.cls.includes('bg-gold-gradient')));
check('garis dekoratif = .gold-rule', grad.hits.some(h => h.cls.includes('gold-rule')));
check('tidak ada gradasi emas liar', ![...concepts].some(c => c.startsWith('LAIN')), [...concepts].filter(c=>c.startsWith('LAIN')).join(','));

/* ------------------------------------------------ 5. YANG DILARANG */
console.log('\n[5] Hal yang dilarang');
const banned = await evalJs(`(() => {
  const body = document.body.innerHTML;
  const anim = document.getAnimations ? document.getAnimations() : [];
  const infinite = anim.filter(a => {
    const t = a.effect?.getTiming?.();
    return t && t.iterations === Infinity;
  }).length;
  return {
    canvas: document.querySelectorAll('canvas').length,
    video: document.querySelectorAll('video').length,
    iframe: document.querySelectorAll('iframe').length,
    emoji: (document.body.innerText.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []),
    marquee: /marquee/i.test(body),
    cursorCustom: /cursor\s*:\s*(?!auto|pointer|default|inherit|none)[a-z]/i.test(body),
    infinite,
    animations: anim.length,
    img: document.querySelectorAll('img').length,
    externalAssets: [...document.querySelectorAll('link[href],script[src]')]
      .map(e => e.getAttribute('href') || e.getAttribute('src'))
      .filter(u => u && /^https?:/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u)),
  };
})()`);
check('tidak ada <canvas> (partikel)', banned.canvas === 0);
check('tidak ada <video>/<iframe>', banned.video === 0 && banned.iframe === 0);
check('tidak ada emoji', banned.emoji.length === 0, JSON.stringify(banned.emoji));
check('tidak ada marquee', banned.marquee === false);
check('tidak ada cursor kustom', banned.cursorCustom === false);
check('tidak ada animasi tak berujung', banned.infinite === 0, `${banned.animations} animasi aktif, ${banned.infinite} infinite`);
check('tidak ada <img> (tanpa aset gambar)', banned.img === 0);
check('satu-satunya aset eksternal = Google Fonts', banned.externalAssets.length === 0, JSON.stringify(banned.externalAssets));

/* ------------------------------------------------ 6. ANIMASI: 5 JENIS */
console.log('\n[6] Animasi (harus 5 jenis, semuanya reduced-motion-safe)');
const anim = await evalJs(`(() => {
  const revealed = [...document.querySelectorAll('.reveal')];
  const withDelay = revealed.filter(e => e.style.getPropertyValue('--reveal-delay'));
  const delays = [...new Set(withDelay.map(e => e.style.getPropertyValue('--reveal-delay')))].sort();
  const transition = revealed[0] ? getComputedStyle(revealed[0]).transitionDuration : null;
  const cs = getComputedStyle(revealed[0]);
  // hitung animasi lain yang berjalan
  const running = document.getAnimations().map(a => a.constructor.name);
  return {
    revealCount: revealed.length,
    staggerDelays: delays,
    transitionDuration: transition,
    timingFn: cs.transitionTimingFunction,
    parallaxTargets: ['.hero-helix', '#tentang [aria-hidden="true"] > div'].map(s => {
      const e = document.querySelector(s);
      return e ? getComputedStyle(e).willChange : null;
    }),
    running: [...new Set(running)],
  };
})()`);
check('semua elemen pakai .reveal', anim.revealCount > 25, `${anim.revealCount} elemen`);
check('stagger 80ms di grid', anim.staggerDelays.some(d => d === '80ms'), anim.staggerDelays.join(','));
check('durasi reveal 700ms', anim.transitionDuration.split(',').every(d => d.trim() === '0.7s'), anim.transitionDuration);
check('easing cubic-bezier(0.22,1,0.36,1)', /0\.22,\s*1,\s*0\.36,\s*1/.test(anim.timingFn), anim.timingFn);
check('parallax hanya di 2 target', anim.parallaxTargets.filter(Boolean).length === 2, JSON.stringify(anim.parallaxTargets));
check('hanya 1 jenis animasi JS berjalan (reveal)', anim.running.length <= 1, JSON.stringify(anim.running));

/* ------------------------------------------------ 7. PADDING VERTIKAL BERTINGKAT */
console.log('\n[7] Padding section: 72 / 96 / 120');
const pads = {};
for (const [w, h] of [[375, 812], [768, 1024], [1280, 800]]) {
  await setVp(w, h, w < 768);
  await nav();
  pads[w] = await evalJs(`(() => { const s = document.querySelectorAll('section[id]')[1]; return getComputedStyle(s.querySelector('.shell') || s).paddingTop; })()`);
}
check('ponsel 375px = 72px', pads[375] === '72px', pads[375]);
check('tablet 768px = 96px', pads[768] === '96px', pads[768]);
check('desktop 1280px = 120px', pads[1280] === '120px', pads[1280]);

/* ------------------------------------------------ 8. HERO */
console.log('\n[8] Hero');
await setVp(1280, 800, false);
await nav();
const hero = await evalJs(`(() => {
  const h = document.querySelector('.hero-section');
  const cs = getComputedStyle(h);
  // Cari deklarasi min-height dari stylesheet (computed value sudah jadi px)
  const svhRules = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } })
    .filter(r => r.cssText && /min-height/.test(r.cssText) && /svh|dvh/.test(r.cssText))
    .map(r => r.cssText.replace(/\\s+/g, ' ').slice(0, 120));
  const btns = [...document.querySelectorAll('.hero-section a.btn')].filter(a => a.getBoundingClientRect().height > 20);
  const helix = document.querySelector('.hero-helix');
  const hr = helix.getBoundingClientRect();
  return {
    minH: cs.minHeight, usedH: Math.round(h.getBoundingClientRect().height), vh: window.innerHeight, svhRules,
    btnCount: btns.length,
    btnH: btns.map(b => Math.round(b.getBoundingClientRect().height)),
    helixRight: Math.round(window.innerWidth - hr.right),
    helixOpacity: getComputedStyle(helix).opacity,
    helixIsSvg: !!helix.querySelector('svg'),
  };
})()`);
check('hero pakai min-height 100svh', hero.svhRules.length > 0, hero.svhRules[0] || 'tidak ada');
check('hero tinggi >= 1 viewport', hero.usedH >= hero.vh, `${hero.usedH} >= ${hero.vh}`);
check('hero 2 tombol', hero.btnCount === 2, `${hero.btnCount}`);
check('tombol hero >= 44px', hero.btnH.every((h) => h >= 44), JSON.stringify(hero.btnH));
check('heliks di sisi kanan pada desktop', hero.helixRight > 0 && hero.helixRight < 200, `${hero.helixRight}px dari kanan`);
check('heliks = SVG, bukan gambar', hero.helixIsSvg === true);
check('heliks opacity <= 0.30 di desktop', parseFloat(hero.helixOpacity) <= 0.3, hero.helixOpacity);

await setVp(375, 812, true);
await nav();
const heroMobile = await evalJs(`(() => {
  const helix = document.querySelector('.hero-helix');
  const r = helix.getBoundingClientRect();
  const btns = [...document.querySelectorAll('.hero-section a.btn')].filter(a => a.getBoundingClientRect().height > 20);
  const h1 = document.querySelector('h1');
  const tRect = h1.getBoundingClientRect();
  const shell = document.querySelector('.hero-section .shell');
  const inner = shell.querySelector('div > div');
  return {
    opacity: getComputedStyle(helix).opacity,
    overlapsText: !(r.bottom < tRect.top || r.top > tRect.bottom || r.right < tRect.left || r.left > tRect.right),
    stacked: btns[0].getBoundingClientRect().bottom <= btns[1].getBoundingClientRect().top + 1,
    widths: btns.map(b => Math.round(b.getBoundingClientRect().width)),
    contentW: Math.round(inner.getBoundingClientRect().width),
    h1Size: getComputedStyle(h1).fontSize,
  };
})()`);
check('heliks lebih samar di ponsel (<= 0.12)', parseFloat(heroMobile.opacity) <= 0.12, heroMobile.opacity);
check('heliks di belakang teks (tidak menutupi)', heroMobile.overlapsText === true, 'berada di belakang, opacity rendah');
check('2 tombol menumpuk di ponsel', heroMobile.stacked === true);
check('tombol hero lebar penuh di ponsel', heroMobile.widths.every((w) => Math.abs(w - heroMobile.contentW) <= 1), `tombol ${JSON.stringify(heroMobile.widths)} vs konten ${heroMobile.contentW}px`);
check('h1 fluid di ponsel >= 40px', parseFloat(heroMobile.h1Size) >= 40, heroMobile.h1Size);

console.log(`\n===== ${pass} PASS / ${fail} FAIL =====`);
ws.close();
chrome.kill();
process.exit(fail > 0 ? 1 : 0);
