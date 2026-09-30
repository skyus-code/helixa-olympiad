/**
 * Verifikasi landing page Helixa Olympiad — sistem gerak baru.
 *
 * Stack resmi: paket `motion` + CSS native + IntersectionObserver. Tidak ada
 * GSAP, Lenis, ScrollTrigger, SplitText, atau three.js/WebGL.
 *
 * Dua lapis pemeriksaan:
 *  A. STATIS (tanpa browser): package.json, impor sumber, token CSS, font.
 *  B. BROWSER (Chrome headless via CDP): stacking antar-section, kinetic
 *     hero, reveal saat scroll, garis progres, parallax, FAQ, navbar, kursor
 *     kustom, magnet, spotlight, no-horizontal-scroll, dan reduced-motion.
 *
 * Fallback-proxy yang harus dipahami sebelum mengubah:
 *  - `Emulation.setEmulatedMedia` hanya bisa mengubah `prefers-reduced-motion`
 *    dan `any-pointer`/`any-hover`. Fitur `pointer`/`hover` utama ditentukan
 *    `Emulation.setTouchEmulationEnabled` (on -> coarse/none, off -> fine/hover).
 *  - Headless Chrome default-nya `prefers-reduced-motion: reduce`; verifikasi
 *    memaksa `no-preference` di bagian animasi aktif.
 *
 * Pakai: node scripts/verify.mjs [url]   (jalankan setelah `npm run build`)
 */
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = process.cwd();
const URL_TARGET = process.argv[2] ?? 'http://localhost:4200/';
const PORT = 9227;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

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
const alphaOf = (c) => {
  if (!c || c === 'transparent') return 0;
  if (c.includes('/')) {
    const m = c.split('/')[1].match(/([\d.]+)\s*\)/);
    return m ? Number(m[1]) : 1;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map((s) => s.trim());
    return p.length === 4 ? Number(p[3]) : 1;
  }
  return 1;
};

/* ==================================================================
   A. PEMERIKSAAN STATIS
   ================================================================== */

console.log('\n=== A1. DEPENDENSI & SUMBER BERSIH ===');
{
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const forbidden = ['gsap', '@gsap/react', 'lenis', 'three', '@types/three'];
  const found = Object.keys(all)
    .filter((k) => forbidden.includes(k) || forbidden.some((f) => k.startsWith(f + '/')))
    .map((k) => k + '@' + all[k]);
  check('gsap/lenis/three tidak ada di package.json', found.length === 0,
    found.length ? found.join(', ') : 'hanya react/react-dom/motion + tooling');
  check('Paket motion terpasang', !!all.motion, all.motion ? 'motion@' + all.motion : 'tidak ada');

  const src = join(ROOT, 'src');
  const srcFiles = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else srcFiles.push(p);
    }
  };
  walk(src);
  const bad = [];
  for (const f of srcFiles) {
    const raw = readFileSync(f, 'utf8');
    // Buang komentar dulu: penyebutan "ScrollTrigger" / "gsap" di komentar
    // penjelas bukanlah penggunaan nyata.
    const text = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    for (const pat of ["from 'gsap", 'from "gsap', 'ScrollTrigger', 'SplitText', 'lenis',
      'three', 'HeroCanvas', 'useSmoothScroll', 'useKineticText', 'useGsapMedia']) {
      if (text.includes(pat)) { bad.push(f.replace(ROOT, '') + ' -> ' + pat); }
    }
  }
  check('Tidak ada impor/kode library terlarang di src/', bad.length === 0,
    bad.length ? bad[0] : 'bersih');
  check('useSmoothScroll.tsx telah dihapus',
    !existsSync(join(src, 'hooks', 'useSmoothScroll.tsx')));
}

console.log('\n=== A2. TOKEN & CSS ===');
{
  const css = readFileSync(join(ROOT, 'src', 'index.css'), 'utf8');
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  check('--color-gold-bronze bernilai #a17c1b', css.includes('--color-gold-bronze: #a17c1b'));
  check('Tidak ada --font-mono / Space Mono', !css.includes('--font-mono') && !css.includes('font-mono'),
    css.includes('font-mono') ? 'font-mono masih dipakai' : '');
  check('index.html tidak memuat Space Mono', !html.includes('Space+Mono'));
  check('Tidak ada blok .lenis* di CSS', !css.includes('.lenis'));
  check('Tidak ada animasi infinite hero-ambient', !css.includes('infinite'));
  check('Stack mobile & reduced-motion override ada',
    css.includes('@media (max-width: 767px)') && css.includes('prefers-reduced-motion: reduce') &&
      css.includes('.stack-wrap {'));
}

/* ==================================================================
   B. BROWSER
   ================================================================== */

const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
    '--no-first-run', '--force-color-profile=srgb',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=' + process.env.TEMP + '\\helixa-verify-profile',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
process.on('exit', () => chrome.kill());

async function ready() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return; }
    catch { /* DevTools belum siap */ }
    await sleep(250);
  }
  throw new Error('DevTools tidak merespons');
}
await ready();

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL_TARGET)}`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pend = new Map();
const waiters = new Map();
const pageProblems = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) {
    const p = pend.get(m.id);
    pend.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    pageProblems.push('EXCEPTION: ' + (d.exception?.description ?? d.text));
  } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    pageProblems.push('console.error: ' + m.params.entry.text);
  }
  if (waiters.has(m.method)) waiters.get(m.method).forEach((f) => f(m.params));
};
const send = (method, params = {}) => {
  const n = ++id;
  return new Promise((resolve, reject) => {
    pend.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
};
const once = (m) => new Promise((res) => {
  const f = (p) => {
    waiters.set(m, (waiters.get(m) ?? []).filter((x) => x !== f));
    res(p);
  };
  waiters.set(m, [...(waiters.get(m) ?? []), f]);
});
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description ?? r.exceptionDetails.text) + ' :: ' + expression.slice(0, 120));
  return r.result.value;
};
const HELPERS = String.raw`
window.__sq = (s) => s.split(/\s+/).join(' ').trim();
window.__xform = (el) => {
  const out = { x: 0, y: 0, sx: 1, sy: 1 };
  if (!el) return out;
  const cs = getComputedStyle(el);
  const tf = cs.transform;
  if (tf && tf !== 'none') {
    const m = tf.match(/matrix\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(',').map(Number);
      out.x += p[4] || 0; out.y += p[5] || 0;
      out.sx *= p[0]; out.sy *= p[3];
    } else {
      const mm = tf.match(/translate(3d|X|Y)?\(([^)]+)\)/);
      if (mm) {
        const p = mm[2].split(/[,\s]+/).filter(Boolean).map(Number);
        out.x += p[0] || 0; out.y += p[1] || 0;
      }
      const ss = tf.match(/scale(3d|X|Y)?\(([^)]+)\)/);
      if (ss) {
        const p = ss[2].split(',').map(Number);
        out.sx *= p[0]; out.sy *= p.length > 1 ? p[1] : p[0];
      }
    }
  }
  const sp = (cs.scale || 'none').split(/\s+/);
  if (sp.length === 1) { const n = parseFloat(sp[0]); if (Number.isFinite(n)) { out.sx *= n; out.sy *= n; } }
  return out;
};
true;
`;
await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

async function setMotion(mode, coarse) {
  const features = [{ name: 'prefers-reduced-motion', value: mode }];
  features.push({ name: 'any-pointer', value: coarse ? 'coarse' : 'fine' },
    { name: 'any-hover', value: coarse ? 'none' : 'hover' });
  await send('Emulation.setEmulatedMedia', { features });
  await send('Emulation.setTouchEmulationEnabled',
    coarse ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
}
async function setViewport(w, h, mobile) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile,
    screenWidth: w, screenHeight: h,
  });
}
async function goto() {
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: URL_TARGET });
  await loaded;
  await sleep(2200); // entrance hero selesai (kinetik 1.0s + chrome hingga ~1.7s)
  await evalJs(HELPERS);
  // Site memakai `scroll-behavior: smooth` agar tautan anchor mulus. Untuk
  // pengukuran, scrollTo/scrollIntoView harus melompat seketika (inline style
  // menimpa CSS), kalau tidak tiap pembacaan posisi menangkap animasi berjalan.
  await evalJs("document.documentElement.style.scrollBehavior = 'auto'; true;");
  // Posisi dokumen tiap section dicatat SAAT MASIH DI ATAS. `offsetTop` tidak
  // bisa dipakai: untuk elemen `position: sticky` ia mengembalikan kotak yang
  // sedang dipin (yaitu scrollY saat itu), bukan posisi aslinya di dokumen.
  await evalJs(String.raw`(() => {
    window.__docTop = {};
    document.querySelectorAll('#top > section.stack-wrap').forEach((s) => {
      window.__docTop[s.id || 'hero'] = Math.round(s.getBoundingClientRect().top + window.scrollY);
    });
    return true;
  })()`);
}

/* ---------------------------------------------------------- DESKTOP */

console.log('\n=== B1. DESKTOP 1440x900: STACKING KARTU ===');
{
  await setViewport(1440, 900, false);
  await setMotion('no-preference', false);
  await goto();

  const stack = await evalJs(String.raw`(() => {
    const secs = [...document.querySelectorAll('#top > section.stack-wrap')];
    return secs.map((s) => {
      const cs = getComputedStyle(s);
      return {
        id: s.id || '(hero)',
        z: Number(cs.zIndex),
        pos: cs.position,
        top: cs.top,
        minH: cs.minHeight,
        radius: cs.borderTopLeftRadius,
        shadow: cs.boxShadow !== 'none',
        scrollMargin: cs.scrollMarginTop,
      };
    });
  })()`);
  const count = stack.length;
  check('Delapan section dalam <main>', count === 8, count + ' section');
  const zok = stack.map((s) => s.z).join(',') === '10,20,30,40,50,60,70,80';
  check('z-index naik 10..80 sesuai urutan', zok, stack.map((s) => s.z).join(','));
  const pinned = stack.every(
    (s) => s.pos === 'sticky' && s.top === '0px' && parseFloat(s.minH) >= 800,
  );
  check('Semua section sticky top:0 min-height:100svh (desktop)', pinned,
    stack.map((s) => s.pos + '/' + s.minH).join(' '));
  check('Hanya Hero tanpa kartu; sisanya radius+shadow',
    stack[0].radius === '0px' && !stack[0].shadow &&
      stack.slice(1).every((s) => s.radius === '28px' && s.shadow),
    'radius hero=' + stack[0].radius);
  check('scroll-margin-top 88px untuk target anchor', stack.every((s) => s.scrollMargin === '88px'),
    stack.map((s) => s.scrollMargin).join(','));

  const overflow = await evalJs(String.raw`(() => ({
    sw: document.documentElement.scrollWidth,
    vw: document.documentElement.clientWidth,
    sh: document.documentElement.scrollHeight,
  }))()`);
  check('Tidak ada scroll horizontal (1440px)', overflow.sw <= overflow.vw + 1,
    'scrollWidth=' + overflow.sw + ' clientWidth=' + overflow.vw);
}

console.log('\n=== B2. HERO: KINETIC TYPOGRAPHY + AMBIENT ===');
{
  const hero = await evalJs(String.raw`(() => {
    const h1 = document.querySelector('#top h1');
    const lines = [...h1.querySelectorAll('.kinetic-line')];
    const accent = lines.find((l) => l.className.includes('text-gold-gradient'));
    return {
      text: window.__sq(h1.textContent),
      lines: lines.length,
      lineY: lines.map((l) => window.__xform(l).y),
      accentGrad: accent ? getComputedStyle(accent).backgroundImage.includes('gradient') : false,
      ambient: !!document.querySelector('.hero-ambient'),
      ambientAnim: getComputedStyle(document.querySelector('.hero-ambient')).animationName,
      hint: !!document.querySelector('.hero-scroll-hint'),
    };
  })()`);
  check('Headline terpecah jadi baris (bukan huruf)', hero.lines >= 2, hero.lines + ' baris');
  check('Teks headline utuh', hero.text.includes('Asah nalar') && hero.text.includes('sains'),
    '"' + hero.text + '"');
  check('Baris headline berhenti di posisi akhir', hero.lineY.every((y) => Math.abs(y) < 0.5),
    'y=' + hero.lineY.map((v) => v.toFixed(1)).join(','));
  check('Kata "sains" bergradasi emas', hero.accentGrad);
  check('Ambient glow CSS ada & statis (tanpa animasi)',
    hero.ambient && (hero.ambientAnim === 'none' || hero.ambientAnim === ''),
    'animation=' + hero.ambientAnim);
  check('Scroll hint ada', hero.hint);
}

console.log('\n=== B3. REVEAL SAAT SCROLL (IntersectionObserver) ===');
{
  const reveal = await evalJs(String.raw`(async () => {
    const step = Math.round(window.innerHeight * 0.45);
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    for (let y = 0; y < maxY + step; y += step) {
      window.scrollTo(0, Math.min(y, maxY));
      await new Promise(r => setTimeout(r, 100));
    }
    window.scrollTo(0, maxY);
    // Tunggu tunda stagger terakhir (8 anak = 560ms) + durasi transisi 700ms.
    await new Promise(r => setTimeout(r, 1700));
    const groups = [...document.querySelectorAll('.reveal-group')];
    const singles = [...document.querySelectorAll('.reveal, .reveal-x')];
    return {
      groups: groups.length,
      groupsPending: groups.filter((g) => !g.classList.contains('is-in-view')).length,
      singles: singles.length,
      singlesPending: singles.filter((e) => !e.classList.contains('is-in-view')).length,
      hiddenOverall: [...document.querySelectorAll('.reveal, .reveal-x, .reveal-group > *')]
        .filter((e) => Number(getComputedStyle(e).opacity) < 0.9).length,
    };
  })()`);
  check('Ada grup reveal', reveal.groups > 0, reveal.groups + ' grup');
  check('Semua grup ter-reveal setelah scroll penuh', reveal.groupsPending === 0,
    reveal.groupsPending + ' tertinggal');
  check('Semua reveal single terpicu', reveal.singlesPending === 0,
    reveal.singlesPending + '/' + reveal.singles);
  check('Tidak ada konten reveal tertinggal opacity 0', reveal.hiddenOverall === 0,
    reveal.hiddenOverall + ' elemen');
}

console.log('\n=== B4. GARIS PROGRES CARA IKUT ===');
{
  const prog = await evalJs(String.raw`(async () => {
    const sec = document.getElementById('cara-ikut');
    const line = sec.querySelector('.md\\:origin-left');
    if (!line) return { found: false };
    const top = window.__docTop['cara-ikut'];
    const read = () => window.__xform(line).sx;
    window.scrollTo(0, Math.max(0, top - window.innerHeight * 0.6));
    await new Promise(r => setTimeout(r, 500));
    const a = read();
    window.scrollTo(0, top + window.innerHeight * 0.6);
    await new Promise(r => setTimeout(r, 600));
    const b = read();
    return { found: true, a, b, grew: b > a + 0.08 };
  })()`);
  check('Garis progres ditemukan', prog.found);
  check('Garis tumbuh mengikuti scroll', !!prog.grew,
    'scaleX ' + (prog.a ?? 0).toFixed(2) + ' -> ' + (prog.b ?? 0).toFixed(2));
}

console.log('\n=== B5. PARALLAX DNA (KENAPA HELIXA, >=1024px) ===');
{
  const par = await evalJs(String.raw`(async () => {
    const el = document.querySelector('#tentang [data-parallax]');
    if (!el) return { found: false };
    const read = () => window.__xform(el).y;
    const top = window.__docTop['tentang'];
    window.scrollTo(0, Math.max(0, top - window.innerHeight));
    await new Promise(r => setTimeout(r, 500));
    const a = read();
    window.scrollTo(0, top + window.innerHeight);
    await new Promise(r => setTimeout(r, 600));
    const b = read();
    return { found: true, a, b, moved: Math.abs(b - a) > 5 };
  })()`);
  check('Ornamen DNA ditemukan', par.found);
  check('Parallax menggeser DNA saat scroll', !!par.moved,
    'y ' + (par.a ?? 0).toFixed(1) + ' -> ' + (par.b ?? 0).toFixed(1));
}

console.log('\n=== B6. FAQ AKORDEON (CSS grid-rows) ===');
{
  const faq = await evalJs(String.raw`(async () => {
    const sec = document.getElementById('faq');
    // Gulir sampai section benar-benar ter-pin (top:0), lalu biarkan transisi
    // reveal selesai — di sinilah klik harus tetap mendarat pada tombolnya.
    window.scrollTo(0, window.__docTop['faq'] + 200);
    await new Promise(r => setTimeout(r, 1200));
    const pinnedTop = Math.round(sec.getBoundingClientRect().top);
    const items = [...sec.querySelectorAll('.faq-item')];
    const btn = (i) => items[i].querySelector('button');
    const panel = (i) => items[i].querySelector('.faq-panel');
    const h = (i) => Math.round(panel(i).getBoundingClientRect().height);

    const int0 = { open: h(0), inert1: panel(1).hasAttribute('inert'), items: items.length };
    btn(1).click();
    await new Promise(r => setTimeout(r, 800));
    const afterOpen = {
      openIdx: items.findIndex((it) => it.classList.contains('is-open')),
      h1: h(1), h0: h(0),
      inert0: panel(0).hasAttribute('inert'),
      exp: btn(1).getAttribute('aria-expanded'),
    };
    btn(1).click();
    await new Promise(r => setTimeout(r, 800));
    const closed = {
      openIdx: items.findIndex((it) => it.classList.contains('is-open')),
      h1: h(1), inert1: panel(1).hasAttribute('inert'),
    };
    const clickable = (() => {
      const b = btn(0).getBoundingClientRect();
      const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return !!(at && (at === btn(0) || btn(0).contains(at)));
    })();
    return { pinnedTop, int0, afterOpen, closed, clickable };
  })()`);
  check('Item FAQ muncul', faq.int0.items >= 5, faq.int0.items + ' item');
  check('Section FAQ benar-benar ter-pin saat diuji', faq.pinnedTop === 0,
    'top=' + faq.pinnedTop + 'px');
  check('Panel pertama terbuka awal', faq.int0.open > 15, 'h=' + faq.int0.open);
  check('Panel tertutup punya inert', faq.int0.inert1 === true);
  check('Klik membuka item kedua & menutup item pertama', faq.afterOpen.openIdx === 1,
    'h1=' + faq.afterOpen.h1);
  check('aria-expanded benar', faq.afterOpen.exp === 'true');
  check('Panel pertama ikut inert saat tertutup', faq.afterOpen.inert0 === true);
  check('Klik kedua menutup kembali', faq.closed.openIdx === -1 && faq.closed.h1 < 5,
    'h1=' + faq.closed.h1);
  check('Tombol FAQ bisa diklik saat section sticky', faq.clickable);
}

console.log('\n=== B7. NAVBAR: TRANSPARAN -> SOLID+BLUR ===');
{
  const nb = await evalJs(String.raw`(async () => {
    // B7 memakai halaman yang sama dengan bagian sebelumnya; kembalikan ke
    // posisi atas dulu supaya state navbar terukur dari kondisi segar. Tunggu
    // transisi background navbar (0.5s) benar-benar selesai.
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 1100));
    const h = document.querySelector('header');
    const top = {
      y: window.scrollY,
      bg: getComputedStyle(h).backgroundColor,
      blur: getComputedStyle(h).backdropFilter,
    };
    window.scrollTo(0, 600);
    await new Promise(r => setTimeout(r, 700));
    const gone = {
      y: window.scrollY,
      bg: getComputedStyle(h).backgroundColor,
      blur: getComputedStyle(h).backdropFilter,
      border: getComputedStyle(h).borderBottomColor,
    };
    return { top, gone };
  })()`);
  check('Halaman segar di posisi atas', nb.top.y < 5);
  check('Navbar transparan di atas', alphaOf(nb.top.bg) < 0.05, nb.top.bg);
  check('Scroll berjalan', nb.gone.y > 300, 'scrollY=' + nb.gone.y);
  check('Navbar blur setelah scroll', nb.gone.blur.includes('blur'), nb.gone.blur);
  check('Navbar solid setelah scroll', alphaOf(nb.gone.bg) > 0.5, nb.gone.bg);
  check('Border emas setelah scroll', alphaOf(nb.gone.border) > 0.05, nb.gone.border);
}

console.log('\n=== B8. KURSOR KUSTOM (>=1024px + pointer fine) ===');
{
  const on = await evalJs(String.raw`(() => ({
    attr: document.documentElement.getAttribute('data-custom-cursor'),
    bodyCursor: getComputedStyle(document.body).cursor,
  }))()`);
  check('Atribut kursor aktif', on.attr === 'on', 'data-custom-cursor=' + on.attr);
  check('cursor:none diterapkan', on.bodyCursor === 'none', on.bodyCursor);

  const move = await evalJs(String.raw`(async () => {
    const ring = [...document.querySelectorAll('.cursor-ring')].find(Boolean);
    const dot = [...document.querySelectorAll('.cursor-dot')].find(Boolean);
    const fire = (x, y) => window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: x, clientY: y, bubbles: true, pointerType: 'mouse' }));
    fire(700, 400);
    await new Promise(r => setTimeout(r, 800));
    const a = window.__xform(ring);
    fire(300, 250);
    await new Promise(r => setTimeout(r, 900));
    const b = window.__xform(ring);
    const d = window.__xform(dot);
    const r = ring.getBoundingClientRect();
    const centered = Math.abs((r.left + r.width / 2) - b.x) < 2 && Math.abs((r.top + r.height / 2) - b.y) < 2;
    return { ring: { a, b }, dot: d, moved: Math.abs(a.x - b.x) > 80 && Math.abs(a.y - b.y) > 80,
      dotAt: Math.abs(d.x - 300) < 0.5 && Math.abs(d.y - 250) < 0.5, centered };
  })()`);
  check('Cincin mengikuti pointer', !!move.moved,
    '(' + move.ring.a.x.toFixed(0) + ',' + move.ring.a.y.toFixed(0) + ') -> ('
      + move.ring.b.x.toFixed(0) + ',' + move.ring.b.y.toFixed(0) + ')');
  check('Titik menempel tepat di pointer', !!move.dotAt,
    'dot=(' + move.dot.x.toFixed(0) + ',' + move.dot.y.toFixed(0) + ')');
  check('Cincin berpusat di pointer', !!move.centered);
}

console.log('\n=== B9. MAGNET & SPOTLIGHT (hanya hover:fine) ===');
{
  const mag = await evalJs(String.raw`(async () => {
    const el = document.querySelector('.magnetic');
    if (!el) return { found: false };
    el.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 800));
    const r = el.getBoundingClientRect();
    const fire = (x, y) => window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: x, clientY: y, bubbles: true, pointerType: 'mouse' }));
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // Jauh ~6px dari pusat host: masih dalam-radius magnet (radius = setengah
    // ukuran + 30px), sehingga tarikan benar-benar terjadi.
    fire(cx + 6, cy);
    await new Promise(r2 => setTimeout(r2, 500));
    const near = window.__xform(el);
    fire(cx - 300, cy - 300);
    await new Promise(r2 => setTimeout(r2, 500));
    const away = window.__xform(el);
    return { found: true, near, away,
      moved: Math.abs(near.x) + Math.abs(near.y) > 0.5,
      reset: Math.abs(away.x) < 1 && Math.abs(away.y) < 1 };
  })()`);
  check('Host magnet ditemukan', mag.found);
  check('Tombol tertarik saat pointer dekat', !!mag.moved, '(' + (mag.near?.x ?? 0).toFixed(1) + ',' + (mag.near?.y ?? 0).toFixed(1) + ')');
  check('Kembali diam saat pointer menjauh', !!mag.reset);

  const sp = await evalJs(String.raw`(async () => {
    const card = document.querySelector('[data-spotlight-card]');
    if (!card) return { found: false };
    card.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 700));
    const before = card.style.getPropertyValue('--mx');
    const r = card.getBoundingClientRect();
    card.dispatchEvent(new PointerEvent('pointermove', {
      clientX: r.left + r.width * 0.8, clientY: r.top + 30,
      bubbles: true, pointerType: 'mouse' }));
    await new Promise(r2 => setTimeout(r2, 250));
    const after = card.style.getPropertyValue('--mx');
    const glow = getComputedStyle(card, '::before').backgroundImage;
    return { found: true, before, after, changed: after !== before && after.endsWith('px'),
      glowOk: glow.includes('radial') };
  })()`);
  check('Kartu spotlight ditemukan', sp.found);
  check('--mx diperbarui mengikuti pointer', !!sp.changed, '"' + sp.before + '" -> "' + sp.after + '"');
  check('Gradient spotlight terpasang', !!sp.glowOk);
}

console.log('\n=== B10. MENU & HALAMAN: TIDAK ADA SCROLL HORIZONTAL ===');
{
  const o = await evalJs(String.raw`(() => ({
    sw: document.documentElement.scrollWidth,
    vw: document.documentElement.clientWidth,
    hamburger: (() => {
      const b = document.querySelector('button[aria-controls="menu-mobile"]');
      return b ? getComputedStyle(b).display : 'none';
    })(),
  }))()`);
  check('Tidak ada scroll horizontal (1440px)', o.sw <= o.vw + 1, o.sw + ' <= ' + o.vw);
  check('Hamburger tersembunyi di desktop', o.hamburger === 'none', 'display=' + o.hamburger);
}

/* ---------------------------------------------------------- MOBILE */

console.log('\n=== B11. MOBILE 390x844: PIN DILEPAS, KURSOR/MAGNET MATI ===');
{
  await setViewport(390, 844, true);
  await setMotion('no-preference', true);
  await goto();

  const env = await evalJs(String.raw`(() => {
    const secs = [...document.querySelectorAll('#top > section.stack-wrap')];
    return {
      fine: matchMedia('(pointer: fine)').matches,
      coarse: matchMedia('(pointer: coarse)').matches,
      pos: secs.map((s) => getComputedStyle(s).position),
      mt: secs.map((s) => getComputedStyle(s).marginTop),
      zs: secs.map((s) => getComputedStyle(s).zIndex),
    };
  })()`);
  check('Emulasi pointer sentuh aktif', env.coarse && !env.fine,
    'coarse=' + env.coarse + ' fine=' + env.fine);
  check('Section tidak lagi position:sticky (flow normal)', env.pos.every((p) => p === 'relative'),
    env.pos.join(','));
  check('Overlap ringan -28px antar kartu', env.mt.slice(1).every((m) => m === '-28px'),
    env.mt.join(','));
  check('z-index bertingkat tetap dipertahankan', env.zs.join(',') === '10,20,30,40,50,60,70,80',
    env.zs.join(','));

  const mob = await evalJs(String.raw`(() => {
    const m = document.querySelector('.magnetic');
    const t = m ? window.__xform(m) : { x: 1, y: 1 };
    return {
      cursorAttr: document.documentElement.getAttribute('data-custom-cursor'),
      bodyCursor: getComputedStyle(document.body).cursor,
      magnetMoved: t.x * t.x + t.y * t.y > 0.01,
    };
  })()`);
  check('Kursor kustom NONAKTIF', mob.cursorAttr === null);
  check('Pointer asli dipertahankan', mob.bodyCursor !== 'none', mob.bodyCursor);
  check('Magnet tidak bergerak di layar sentuh', !mob.magnetMoved);

  const menu = await evalJs(String.raw`(async () => {
    const btn = document.querySelector('button[aria-controls="menu-mobile"]');
    if (!btn) return { found: false };
    const br = btn.getBoundingClientRect();
    btn.click();
    await new Promise(r => setTimeout(r, 500));
    const panel = document.querySelector('#menu-mobile');
    const link = panel && panel.querySelector('ul a');
    const lr = link && link.getBoundingClientRect();
    const st = { found: true, expanded: btn.getAttribute('aria-expanded'),
      panelOpen: !!panel, role: panel && panel.getAttribute('role'),
      modal: panel && panel.getAttribute('aria-modal'),
      tapW: Math.round(br.width), tapH: Math.round(br.height),
      linkH: lr ? Math.round(lr.height) : 0,
      bodyOverflow: document.body.style.overflow };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r2 => setTimeout(r2, 500));
    return { ...st, closed: !document.querySelector('#menu-mobile'),
      overflowAfter: document.body.style.overflow };
  })()`);
  check('Tombol hamburger ada & >=44px', menu.found && menu.tapW >= 44 && menu.tapH >= 44,
    (menu.tapW ?? 0) + 'x' + (menu.tapH ?? 0));
  check('Panel terbuka sebagai dialog modal', menu.panelOpen && menu.role === 'dialog' && menu.modal === 'true');
  check('aria-expanded=true', menu.expanded === 'true');
  check('Link menu >= 44px', menu.linkH >= 44, (menu.linkH ?? 0) + 'px');
  check('Body overflow terkunci saat menu terbuka', menu.bodyOverflow === 'hidden',
    menu.bodyOverflow);
  check('Esc menutup menu & membuka body', menu.closed === true && menu.overflowAfter !== 'hidden',
    'overflow=' + menu.overflowAfter);

  const o = await evalJs(String.raw`(() => ({
    sw: document.documentElement.scrollWidth,
    vw: document.documentElement.clientWidth,
  }))()`);
  check('Tidak ada scroll horizontal (390px)', o.sw <= o.vw + 1, o.sw + ' <= ' + o.vw);
}

/* -------------------------------------------------- REDUCED MOTION */

console.log('\n=== B12. REDUCED MOTION: SEMUA MATI TOTAL ===');
{
  await setViewport(1440, 900, false);
  await setMotion('reduce', false);
  await goto();

  const rm = await evalJs(String.raw`(() => {
    const secs = [...document.querySelectorAll('#top > section.stack-wrap')];
    const h1 = document.querySelector('#top h1');
    const grad = document.querySelector('.text-gold-gradient');
    const parallaxEls = [...document.querySelectorAll('[data-parallax]')];
    return {
      pos: secs.map((s) => getComputedStyle(s).position),
      radius: secs.map((s) => getComputedStyle(s).borderTopLeftRadius),
      shadow: secs.map((s) => getComputedStyle(s).boxShadow !== 'none'),
      mt: secs.map((s) => getComputedStyle(s).marginTop),
      h1Opacity: Number(getComputedStyle(h1).opacity),
      h1Text: window.__sq(h1.textContent),
      gradDur: grad ? getComputedStyle(grad).transitionDuration : '',
      cursorAttr: document.documentElement.getAttribute('data-custom-cursor'),
      parallaxTransforms: parallaxEls.map((el) => getComputedStyle(el).transform),
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      scrollable: document.body.scrollHeight > window.innerHeight,
    };
  })()`);
  check('Semua section relative (pin dilepas)', rm.pos.every((p) => p === 'relative'), rm.pos.join(','));
  check('Kartu tanpa radius & bayangan', rm.radius.every((r) => r === '0px') && rm.shadow.every((s) => !s));
  check('Overlap dinolkan', rm.mt.every((m) => m === '0px'), rm.mt.join(','));
  check('Headline langsung terbaca', rm.h1Opacity > 0.9, 'opacity=' + rm.h1Opacity);
  check('Teks headline utuh', rm.h1Text.includes('Asah nalar') && rm.h1Text.includes('sains'),
    '"' + rm.h1Text + '"');
  check('Scroll native (bukan smooth)', rm.scrollBehavior === 'auto', rm.scrollBehavior);
  check('Halaman tetap bisa di-scroll', rm.scrollable);
  check('Kursor kustom NONAKTIF', rm.cursorAttr === null);
  check('Parallax ditangguhkan', rm.parallaxTransforms.every((x) => x === 'none' || x === ''),
    rm.parallaxTransforms.join('; '));
  const maxDur = rm.gradDur.split(',').map((s) => parseFloat(s)).reduce((a, b) => Math.max(a, b), 0);
  check('Gradasi emas tanpa transisi', isNaN(maxDur) || maxDur <= 0.05, rm.gradDur);

  const o = await evalJs(String.raw`(() => ({
    sw: document.documentElement.scrollWidth,
    vw: document.documentElement.clientWidth,
  }))()`);
  check('Tidak ada scroll horizontal (reduced)', o.sw <= o.vw + 1, o.sw + ' <= ' + o.vw);
}

/* ------------------------------------------------- LEBAR 320..1440 */

console.log('\n=== B13. SWEEP LEBAR: 320/375/768/1024/1440 ===');
{
  const widths = [
    { w: 320, h: 720, mobile: true },
    { w: 375, h: 812, mobile: true },
    { w: 768, h: 1024, mobile: false },
    { w: 1024, h: 768, mobile: false },
    { w: 1440, h: 900, mobile: false },
  ];
  for (const vp of widths) {
    await setViewport(vp.w, vp.h, vp.mobile);
    await setMotion('no-preference', vp.mobile);
    await goto();
    const r = await evalJs(String.raw`(async () => {
      const sw = document.documentElement.scrollWidth;
      const vw = document.documentElement.clientWidth;
      // FAQ tetap interaktif: buka-tutup tombol pertama di tiap lebar.
      const sec = document.getElementById('faq');
      sec.scrollIntoView({ block: 'start' });
      await new Promise(x => setTimeout(x, 400));
      const btn = sec.querySelector('.faq-item button');
      const before = btn.getAttribute('aria-expanded');
      btn.click();
      await new Promise(x => setTimeout(x, 300));
      const after = btn.getAttribute('aria-expanded');
      return { sw, vw, faqToggled: before !== after };
    })()`);
    check('no-h-scroll @' + vp.w + 'px', r.sw <= r.vw + 1, r.sw + ' <= ' + r.vw);
    check('FAQ bisa diklik @' + vp.w + 'px', !!r.faqToggled, 'aria-expanded berpindah');
  }
}

console.log('\n=== B14. KONSOL BERSIH ===');
{
  check('Tidak ada exception / console.error', pageProblems.length === 0, pageProblems.length + ' masalah');
  if (pageProblems.length) pageProblems.slice(0, 5).forEach((p) => console.log('       ' + p));
}

console.log('\n' + '='.repeat(58));
console.log('  TOTAL: ' + pass + ' PASS / ' + fail + ' FAIL');
console.log('='.repeat(58));

ws.close();
chrome.kill();
process.exit(fail > 0 ? 1 : 0);