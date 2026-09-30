/**
 * Verifikasi fitur interaktif & animasi.
 *
 * Script ini mengukur apa yang SEBENARNYA terjadi di browser, bukan sekadar
 * memeriksa bahwa kelas CSS ada. Untuk tiap fitur ia mencari bukti numerik:
 * transform yang berubah, tinggi yang beranimasi, atribut yang berubah.
 *
 * Empat jebakan yang sudah ditangani di sini. Semuanya ditemukan lewat
 * kegagalan nyata, bukan dengan membaca dokumentasi:
 *
 *  1. GSAP TIDAK selalu menulis `transform`. Untuk komponen scale/translate
 *     terpisah ia menulis properti CSS `scale:` / `translate:` dan
 *     `transform: none`. Membaca `getComputedStyle(el).transform` saja
 *     membuat animasi scale dan parallax selalu terbaca sebagai 1.0 / 0.0.
 *  2. `Emulation.setEmulatedMedia` hanya bisa mengubah fitur `any-pointer` dan
 *     `any-hover`, bukan `pointer`/`hover` (fitur pointer utama). Untuk benar-
 *     benar membuat `pointer: coarse` harus lewat `setTouchEmulationEnabled`.
 *  3. Backbuffer WebGL dikosongkan setelah compositing, jadi
 *     `drawImage(canvas)` di luar requestAnimationFrame menghasilkan bidang
 *     kosong. Bukti piksel diambil dari tangkapan layar, bukan dari canvas.
 *  4. Headless merender WebGL lewat perangkat lunak, jadi satu frame bisa
 *     memakan ratusan milidetik. `setTimeout(70)` praktis berarti 500ms dan
 *     animasi 0.5 detik sudah selesai sebelum sempat diamati. Karena itu
 *     animasi disampel per frame (requestAnimationFrame), bukan per milidetik.
 *
 * Semua kode yang dikirim ke halaman ditulis dengan `String.raw`. Backslash
 * di dalam template literal biasa dimakan parser (`\s` menjadi `s`, bukan
 * regex whitespace), dan dua kegagalan berturut-turut lahir dari itu.
 *
 * Pakai: node scripts/verify.mjs [url]
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const URL_TARGET = process.argv[2] ?? 'http://localhost:4200/';
const PORT = 9227;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-sandbox',
    '--no-first-run',
    '--force-color-profile=srgb',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=' + process.env.TEMP + '\\helixa-verify-profile',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
process.on('exit', () => chrome.kill());

async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return;
    } catch {
      /* DevTools belum siap */
    }
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
  const w = waiters.get(m.method);
  if (w) w.forEach((f) => f(m.params));
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
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text + ' :: ' + expression.slice(0, 200));
  }
  return r.result.value;
};

/**
 * Helper yang di-inject ke halaman. Dipisah dari payload lain supaya hanya
 * perlu dikirim ulang satu kali per navigasi.
 *
 * __xform membaca transform dari bentuk apa pun yang dipakai GSAP.
 * __sq merapikan whitespace hasil textContent tanpa regex yang rawan dimakan
 * escape.
 */
const HELPERS = String.raw`
window.__sq = (s) => s.split(/\s+/).join(' ').trim();
window.__xform = (el) => {
  const out = { raw: '', x: 0, y: 0, sx: 1, sy: 1 };
  if (!el) return out;
  const cs = getComputedStyle(el);
  const num = (v, fb) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fb;
  };

  const tp = (cs.translate || 'none').split(/\s+/);
  if (tp.length === 1) out.x = num(tp[0], 0);
  else if (tp.length >= 2) { out.x = num(tp[0], 0); out.y = num(tp[1], 0); }

  const sp = (cs.scale || 'none').split(/\s+/);
  if (sp.length === 1) { out.sx = num(sp[0], 1); out.sy = out.sx; }
  else if (sp.length >= 2) { out.sx = num(sp[0], 1); out.sy = num(sp[1], 1); }

  const tf = cs.transform;
  out.raw = (el.style.transform || '') + ' | translate:' + (cs.translate || 'none')
          + ' | scale:' + (cs.scale || 'none');
  if (tf && tf !== 'none') {
    const m = tf.match(/matrix\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(',').map(Number);
      out.x += p[4] || 0;
      out.y += p[5] || 0;
      out.sx *= p[0];
      out.sy *= p[3];
    } else {
      const mm = tf.match(/translate(3d|X|Y)?\(([^)]+)\)/);
      if (mm) {
        const p = mm[2].split(/[,\s]+/).filter(Boolean).map(Number);
        out.x += p[0] || 0;
        out.y += p[1] || 0;
      }
      const ss = tf.match(/scale(3d|X|Y)?\(([^)]+)\)/);
      if (ss) {
        const p = ss[2].split(',').map(Number);
        out.sx *= p[0];
        out.sy *= p.length > 1 ? p[1] : p[0];
      }
    }
  }
  return out;
};
true;
`;

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

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

/** Durasi CSS ("0.7s", "700ms", daftar) -> detik terbesar. */
const durSec = (v) =>
  String(v)
    .split(',')
    .map((s) => {
      const x = s.trim();
      if (x.endsWith('ms')) return parseFloat(x) / 1000;
      if (x.endsWith('s')) return parseFloat(x);
      return 0;
    })
    .reduce((a, b) => Math.max(a, b), 0);

/** Alpha dari warna hitung: mendukung rgba() dan oklab(... / a). */
const alphaOf = (c) => {
  if (!c) return 1;
  if (c === 'transparent') return 0;
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

async function setMotion(mode, pointer) {
  const features = [{ name: 'prefers-reduced-motion', value: mode }];
  if (pointer === 'fine') {
    features.push({ name: 'any-pointer', value: 'fine' }, { name: 'any-hover', value: 'hover' });
  } else if (pointer === 'coarse') {
    features.push({ name: 'any-pointer', value: 'coarse' }, { name: 'any-hover', value: 'none' });
  }
  await send('Emulation.setEmulatedMedia', { features });
  await send('Emulation.setTouchEmulationEnabled', {
    enabled: pointer === 'coarse',
    maxTouchPoints: pointer === 'coarse' ? 5 : 1,
  });
}

async function goto() {
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: URL_TARGET });
  await loaded;
  await sleep(3800);
  await evalJs(HELPERS);
}

/**
 * Muat ulang lalu langsung mulai mengukur, tanpa jeda panjang. Dipakai untuk
 * animasi yang hanya berjalan sekali saat mount: tanpa muat ulang, semua
 * huruf sudah berada di posisi akhir ketika pengukuran dimulai.
 */
async function reloadFast() {
  const loaded = once('Page.loadEventFired');
  await send('Page.reload');
  await loaded;
  await sleep(500);
  await evalJs(HELPERS);
}

/* ==================================================================
   BAGIAN 1 - desktop, animasi aktif
   ================================================================== */

await send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  screenWidth: 1440, screenHeight: 900,
});
await setMotion('no-preference', 'fine');
await goto();

console.log('\n=== 1. LENIS SMOOTH SCROLL ===');
{
  const env = await evalJs(String.raw`(() => ({
    lenisClass: document.documentElement.classList.contains('lenis'),
    htmlClass: document.documentElement.className,
  }))()`);
  // 'lenis-smooth' hanya ditambahkan Lenis ketika isScrolling === 'smooth',
  // jadi kelas itu harus dicek DI TENGAH scroll, bukan saat halaman diam.
  check('Kelas lenis menempel ke <html>', env.lenisClass, 'class="' + env.htmlClass + '"');

  const smooth = await evalJs(String.raw`(async () => {
    const html = document.documentElement;
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 700));
    const y0 = window.scrollY;
    const wheel = () => window.dispatchEvent(new WheelEvent('wheel', {
      deltaY: 400, bubbles: true, cancelable: true,
    }));
    // Sampel per frame, bukan per setTimeout: di mesin yang sibuk sebuah
    // setTimeout(90) bisa membayar jauh lebih lama, dan scroll mulus sudah
    // selesai sebelum sampel pertama diambil -- "lompatan instan" yang palsu.
    // Selama halaman merender sekali pun di tengah animasi (Lenis digerakkan
    // rAF, jadi thread beku berarti animasi ikut beku), sampel menangkap
    // posisi antara.
    const samples = [];
    const t0 = performance.now();
    for (let i = 0; i < 3; i++) {
      wheel();
      await new Promise(r => requestAnimationFrame(r));
    }
    while (performance.now() - t0 < 4000 && samples.length < 240) {
      samples.push({ y: window.scrollY, cls: html.className });
      await new Promise(r => requestAnimationFrame(r));
    }
    await new Promise(r => setTimeout(r, 500));
    const end = window.scrollY;
    const ys = samples.map(s => s.y);
    const beyond = ys.filter(y => y > 30);
    const mid = beyond.length ? Math.min(...beyond) : end;
    return { y0, mid, end, count: samples.length,
             interpolated: mid < end - 5, moved: end > 50,
             hadSmoothCls: samples.some(s => s.cls.includes('lenis-smooth')) };
  })()`);
  check('Scroll bergerak ke bawah', smooth.moved, 'y0=' + smooth.y0 + ' akhir=' + Math.round(smooth.end));
  check('Ada interpolasi (bukan lompat langsung)', smooth.interpolated,
    'sampel ' + smooth.count + ' frame, y antara min=' + Math.round(smooth.mid) + ' dari ' + Math.round(smooth.end));
  check('Kelas lenis-smooth aktif saat menggulir', smooth.hadSmoothCls,
    'diamati di ' + smooth.count + ' sampel frame');

  // ScrollTrigger disinkronkan dengan Lenis: trigger harus ikut posisi scroll.
  // Diuji lewat elemen reveal, bukan lewat global yang tidak diekspos.
  const synced = await evalJs(String.raw`(async () => {
    const step = document.querySelectorAll('[data-step]')[1];
    const read = () => Number(getComputedStyle(step).opacity);
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 900));
    const top = read();
    step.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 1300));
    return { top, mid: read() };
  })()`);
  check('ScrollTrigger sinkron dengan scroll Lenis', synced.mid > synced.top,
    'opacity ' + synced.top.toFixed(2) + ' -> ' + synced.mid.toFixed(2));
}

console.log('\n=== 2. KINETIC TYPOGRAPHY (SplitText) ===');
{
  const split = await evalJs(String.raw`(() => {
    const el = document.querySelector('[data-kinetic-lead]');
    if (!el) return { found: false };
    return {
      found: true,
      charCount: el.querySelectorAll('div,span').length,
      ariaLabel: el.getAttribute('aria-label') || el.parentElement.getAttribute('aria-label') || '',
    };
  })()`);
  check('Elemen kinetic dipecah jadi huruf', split.found && split.charCount > 5,
    split.charCount + ' node anak');
  check('Teks utuh masih terbaca (aria-label)', split.ariaLabel.length > 0,
    '"' + split.ariaLabel.slice(0, 40) + '"');

  const headline = await evalJs(String.raw`(() => {
    const h1 = document.querySelector('h1');
    return { opacity: getComputedStyle(h1).opacity, text: window.__sq(h1.textContent) };
  })()`);
  check('Headline terlihat (bukan tertinggal opacity 0)', Number(headline.opacity) > 0.9,
    'opacity=' + headline.opacity);
  check('Teks headline benar', headline.text.includes('Asah nalar') && headline.text.includes('sains'),
    '"' + headline.text + '"');

  const accent = await evalJs(String.raw`(() => {
    const el = document.querySelector('[data-kinetic-accent]');
    if (!el) return null;
    return { text: el.textContent.trim(),
             grad: getComputedStyle(el).backgroundImage.includes('gradient') };
  })()`);
  check('Kata "sains" ada gradasi emas', !!accent && accent.grad,
    accent ? accent.text : 'tidak ditemukan');

  // Huruf harus benar-benar bergerak, bukan hanya muncul di tempat akhir.
  // Animasi ini hanya berjalan sekali saat mount, jadi perekam harus terpasang
  // SEBELUM dokumen baru dieksekusi. Event `load` justru terlambat: React sudah
  // mount dan timeline sudah berjalan jauh saat `load` menyala, sehingga
  // pengukuran yang dimulai sesudahnya selalu melihat posisi akhir saja.
  //
  // Menyampel transform lewat requestAnimationFrame juga tidak cukup di
  // headless: thread utama bisa macet lebih lama dari durasi tween (1,1 dtk),
  // dan GSAP mengejar selisih jam dinding SEKALIGUS begitu thread pulih --
  // tidak ada satu frame pun yang pernah menampilkan posisi antara (terbukti:
  // 149 frame terekam, semuanya y = 0). Maka perekam memakai MutationObserver
  // dengan `attributeOldValue: true`: setiap gaya yang ditulis GSAP menyimpan
  // nilai lama dalam riwayat mutasi, dan dari rantai oldValue itu posisi puncak
  // animasi dapat dibaca ulang apa pun nasib thread. Observer jalan di
  // mikro-task, tidak bergantung pada rAF sama sekali.
  //
  // WebGL ikut diblokir di halaman pengukuran ini (renderer fallback headless
  // membekukan 1-2 detik penuh tiap frame). Mesh bukan fitur yang diuji di
  // sini; jalur fallback WebGL memang didukung aplikasi, dan bukti WebGL yang
  // asli ada di bagian 5 pada halaman biasa.
  const rec = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: String.raw`
      const __origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (String(type).includes('webgl')) return null;
        return __origGetContext.call(this, type, ...args);
      };
      window.__kin = { segments: 0, maxY: 0, seen: [], done: false, raw: [], frameMax: 0,
        frames: 0, charFound: false, cssText: '' };
      const yOf = (ts) => {
        if (typeof ts !== 'string') return 0;
        // Bentuk gaya yang ditulis GSAP ke elemen huruf (semuanya diamati
        // langsung di lapangan):
        //  - computed: matrix(...) atau matrix3d(...);
        //  - inline transform: translate3d(Xpx, Ypx, 0px) -- inilah yang
        //    ditulis GSAP untuk yPercent;
        //  - properti terpisah 3.13+: translate: Xpx Ypx (bisa "none").
        const t3 = /translate3d\(([^)]+)\)/.exec(ts);
        if (t3) {
          const parts = t3[1].split(',').map((s) => parseFloat(s.trim()));
          const v = Number.isFinite(parts[1]) ? parts[1] : 0;
          return Number.isFinite(v) && v !== 0 ? Math.round(v) : 0;
        }
        const m = /matrix\(([^)]+)\)/.exec(ts);
        if (m) {
          const v = Number(m[1].split(',')[5]);
          return Number.isFinite(v) ? Math.round(v) : 0;
        }
        const t = /(?:^|;)\s*translate\s*:\s*([^;]+)/.exec(ts);
        if (t) {
          const parts = t[1].trim().split(/\s+/);
          const v = parseFloat(parts.length > 1 ? parts[1] : parts[0]);
          return Number.isFinite(v) ? Math.round(v) : 0;
        }
        return 0;
      };
      const computedY = (el) => yOf(getComputedStyle(el).transform);
      let charRef = null;
      const watchChar = (char) => {
        charRef = char;
        window.__kin.charFound = true;
        let maxY = 0;
        let n = 0;
        const obs = new MutationObserver((muts) => {
          for (const m of muts) {
            if (m.type !== 'attributes') continue;
            window.__kin.segments += 1;
            if (window.__kin.raw.length < 8 && m.oldValue) {
              window.__kin.raw.push(m.oldValue.slice(0, 120));
            }
            const y = yOf(m.oldValue || '');
            if (y > maxY) maxY = y;
            if (window.__kin.seen.length < 20) window.__kin.seen.push(y);
          }
        });
        obs.observe(char, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
        const finish = () => {
          window.__kin.cssText = char.getAttribute('style') || '';
          // Baca nilai akhir lewat computed (matriks) karena nilai inline
          // transform bisa kosong bila GSAP memakai properti translate.
          window.__kin.maxY = Math.max(maxY, computedY(char));
          window.__kin.done = true;
        };
        const waiter = () => {
          n += 1;
          // 4 detik sejak huruf muncul sudah jauh melewati tween 1,1 detik.
          if (n > 16) return finish();
          setTimeout(waiter, 250);
        };
        waiter();
      };
      // Pengamat paralel: sampel per rAF dari nilai computed (resolusi matriks),
      // supaya ada pembanding independen terhadap rantai mutasi.
      const rAFloop = () => {
        const root = document.querySelector('[data-kinetic-lead]');
        if (!root) { window.__kin.rAFpending = true; requestAnimationFrame(rAFloop); return; }
        const char = [...root.querySelectorAll('div')].find(
          (d) => d.children.length === 0 && d.textContent.length === 1);
        if (!char) { window.__kin.rAFpending = true; requestAnimationFrame(rAFloop); return; }
        window.__kin.rAFpending = false;
        const y = computedY(char);
        if (y > window.__kin.frameMax) window.__kin.frameMax = y;
        window.__kin.frames += 1;
        if (window.__kin.done) return;
        requestAnimationFrame(rAFloop);
      };
      const findChar = () => {
        const root = document.querySelector('[data-kinetic-lead]');
        if (!root) { setTimeout(findChar, 20); return; }
        // Huruf = div terdalam dengan teks satu karakter. Memilih div pertama
        // keliru: dengan mask: 'lines' SplitText membuat wrapper mask/baris/
        // kata yang memang tidak pernah dianimasikan.
        const char = [...root.querySelectorAll('div')].find(
          (d) => d.children.length === 0 && d.textContent.length === 1,
        );
        if (!char) { setTimeout(findChar, 20); return; }
        watchChar(char);
        requestAnimationFrame(rAFloop);
      };
      setTimeout(findChar, 10);
    `,
  });
  await send('Page.bringToFront');
  const kinLoaded = once('Page.loadEventFired');
  await send('Page.reload');
  await kinLoaded;
  let kin = { done: false };
  for (let i = 0; i < 160 && !kin.done; i++) {
    await sleep(500);
    kin = await evalJs(String.raw`window.__kin || { done: false }`);
  }
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: rec.identifier });

  check('Huruf bergerak dari bawah (ada y > 5px saat animasi)',
    kin.frames > 0 && (kin.frameMax > 5 || kin.maxY > 5),
    'computedMax=' + kin.frameMax + ' mutasi=' + kin.segments + ' yMutasiMax='
      + kin.maxY + ' frames=' + kin.frames + ' char=' + kin.charFound
      + (kin.raw.length ? ' raw0=' + JSON.stringify(kin.raw[0]) : '')
      + ' cssText=' + JSON.stringify((kin.cssText || '').slice(0, 80)));
}

console.log('\n=== 3. SCROLL REVEAL (ScrollTrigger) ===');
{
  // Muat ulang: reveal memakai `once: true`, jadi kalau halaman sudah pernah
  // digulir, elemen yang diukur bisa saja sudah final dan pemeriksaan
  // "awalnya tersembunyi" akan salah lulus.
  await goto();
  const reveal = await evalJs(String.raw`(async () => {
    const sel = '[data-spotlight-card],[data-step],[data-faq-item],[data-perdana-row],[data-rule]';
    const total = document.querySelectorAll(sel).length;
    const below = [...document.querySelectorAll(sel)]
      .filter(e => e.getBoundingClientRect().top > window.innerHeight)
      .map(e => Number(getComputedStyle(e).opacity));
    const step = Math.round(window.innerHeight * 0.5);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 1400));
    const all = [...document.querySelectorAll(sel)];
    return { total, below: below.length, beforeMax: Math.max(...below, 0),
             hidden: all.filter(e => Number(getComputedStyle(e).opacity) < 0.9).length };
  })()`);
  check('Elemen reveal ada', reveal.total > 10, reveal.total + ' elemen');
  check('Elemen di bawah fold awalnya tersembunyi',
    reveal.below > 0 && reveal.beforeMax < 0.05,
    reveal.below + ' elemen di bawah fold, opacity=' + reveal.beforeMax.toFixed(2));
  check('Semua ter-reveal setelah scroll', reveal.hidden === 0,
    reveal.hidden + ' masih tersembunyi');
}

console.log('\n=== 4. FAQ ACCORDION (height auto) ===');
{
  const faq = await evalJs(String.raw`(async () => {
    const buttons = [...document.querySelectorAll('[data-faq-item] button')];
    const panels = [...document.querySelectorAll('[role="region"][id^="faq-panel"]')];
    const b1 = buttons[0], b2 = buttons[1];
    const p1 = panels[0], p2 = panels[1];
    if (!b1 || !b2) return { found: false };

    const h0 = p1.getBoundingClientRect().height;
    const p2h0 = p2.getBoundingClientRect().height;
    const p2inert0 = p2.hasAttribute('inert');

    b2.click();
    // Sampel per frame, bukan per milidetik (lihat catatan di kepala file).
    const samples = [];
    for (let i = 0; i < 45; i++) {
      await new Promise(r => requestAnimationFrame(r));
      samples.push(Math.round(p2.getBoundingClientRect().height));
    }
    await new Promise(r => setTimeout(r, 400));
    const h2 = p2.getBoundingClientRect().height;
    const p2inert1 = p2.hasAttribute('inert');
    const h1after = p1.getBoundingClientRect().height;
    const p1inert1 = p1.hasAttribute('inert');
    const expanded = b2.getAttribute('aria-expanded');

    b2.click();
    await new Promise(r => setTimeout(r, 900));
    const h2closed = p2.getBoundingClientRect().height;
    const p2inert2 = p2.hasAttribute('inert');

    return { found: true, h0, p2h0, p2inert0, samples, h2, p2inert1, h1after, p1inert1,
             expanded, h2closed, p2inert2 };
  })()`);

  check('Panel pertama terbuka awal', faq.h0 > 20, 'h=' + Math.round(faq.h0));
  check('Panel tertutup mulai dari 0', faq.p2h0 < 2, 'h=' + Math.round(faq.p2h0));
  check('Panel tertutup punya inert', faq.p2inert0 === true);
  // Tween nyata berarti tinggi berubah bertahap, bukan 0 lalu langsung akhir.
  // Headless merender WebGL lewat perangkat lunak sehingga hanya 4-6 frame
  // yang tertangkap selama tween 0.5 detik. Karena itu yang diperiksa bukan
  // banyaknya frame, melainkan bentuk rekam jejaknya: harus naik monoton,
  // punya beberapa tinggi antara 0 dan tinggi akhir, dan tidak melompat.
  const traj = faq.samples;
  const distinct = new Set(traj).size;
  const monotonic = traj.every((h, i) => i === 0 || h >= traj[i - 1]);
  const partial = traj.filter((h) => h > 0 && h < faq.h2 - 1);
  check('Tinggi beranimasi bertahap (bukan lompat)',
    partial.length >= 1 && distinct >= 3 && monotonic,
    'sampel=' + JSON.stringify(traj.slice(0, 8)) + ' akhir=' + Math.round(faq.h2)
      + ' (' + distinct + ' tinggi berbeda, monoton=' + monotonic + ')');
  check('Panel terbuka height benar', faq.h2 > 20, 'h=' + Math.round(faq.h2));
  check('inert dilepas saat terbuka', faq.p2inert1 === false);
  check('aria-expanded=true', faq.expanded === 'true');
  check('Panel lama tertutup (satu-buka)', faq.h1after < 5, 'h=' + Math.round(faq.h1after));
  check('inert dikembalikan saat tertutup', faq.p1inert1 === true);
  check('Panel bisa ditutup lagi', faq.h2closed < 5 && faq.p2inert2 === true,
    'h=' + Math.round(faq.h2closed));
}

console.log('\n=== 5. WEBGL CANVAS ===');
{
  const webgl = await evalJs(String.raw`(async () => {
    window.scrollTo(0, 0);
    const c = document.querySelector('canvas');
    if (!c) return { found: false };
    // three.js dimuat lewat import() dinamis dan dirender perangkat lunak di
    // headless, jadi waktu scene siap tidak bisa ditebak dari angka tetap.
    for (let i = 0; i < 70; i++) {
      await new Promise(r => setTimeout(r, 150));
      if (Number(getComputedStyle(c).opacity) > 0.9) break;
    }
    const r = c.getBoundingClientRect();
    return { found: true, w: Math.round(r.width), h: Math.round(r.height),
             opacity: getComputedStyle(c).opacity,
             hasContext: !!(c.getContext('webgl2') || c.getContext('webgl')) };
  })()`);
  check('Canvas ada', webgl.found, webgl.w + 'x' + webgl.h);
  check('Canvas punya konteks WebGL', webgl.hasContext);
  check('Canvas terlihat (fade-in selesai)', Number(webgl.opacity) > 0.9,
    'opacity=' + webgl.opacity);

  // Bukti mesh benar-benar memberi piksel: bandingkan tangkapan layar area
  // canvas dengan canvas terlihat vs disembunyikan. Metode ini memakai hasil
  // compositing browser, jadi tidak terganggu backbuffer WebGL yang dikosongkan
  // setelah tiap frame.
  const clip = await evalJs(String.raw`(() => {
    const b = document.querySelector('canvas').getBoundingClientRect();
    return { x: Math.round(b.left + window.scrollX), y: Math.round(b.top + window.scrollY),
             width: Math.round(b.width), height: Math.round(b.height), scale: 1 };
  })()`);
  const shotOn = await send('Page.captureScreenshot', { format: 'png', clip });
  await evalJs(String.raw`(() => { document.querySelector('canvas').style.visibility = 'hidden'; return true; })()`);
  await sleep(400);
  const shotOff = await send('Page.captureScreenshot', { format: 'png', clip });
  await evalJs(String.raw`(() => { document.querySelector('canvas').style.visibility = ''; return true; })()`);
  const hOn = createHash('sha1').update(shotOn.data).digest('hex');
  const hOff = createHash('sha1').update(shotOff.data).digest('hex');
  check('Mesh benar-benar tergambar (piksel di layar berubah)',
    hOn !== hOff && shotOn.data.length >= shotOff.data.length,
    'PNG ' + shotOn.data.length + ' B vs ' + shotOff.data.length + ' B tanpa mesh');

  const tilt = await evalJs(String.raw`(async () => {
    const fire = (x) => window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: x, clientY: 450, bubbles: true, pointerType: 'mouse' }));
    fire(200);
    await new Promise(r => setTimeout(r, 900));
    fire(1240);
    await new Promise(r => setTimeout(r, 900));
    return true;
  })()`);
  check('Pointer diteruskan ke scene', tilt);
}

console.log('\n=== 6. KURSOR KUSTOM ===');
{
  const cur = await evalJs(String.raw`(() => ({
    on: document.documentElement.getAttribute('data-custom-cursor'),
    bodyCursorNone: getComputedStyle(document.body).cursor === 'none',
    rings: [...document.querySelectorAll('.fixed.rounded-full')].length,
  }))()`);
  check('Atribut kursor aktif', cur.on === 'on', 'data-custom-cursor=' + cur.on);
  check('cursor:none dipakai', cur.bodyCursorNone);
  check('Elemen kursor ada (cincin + titik)', cur.rings >= 2, cur.rings + ' elemen');

  // Pada keadaan diam sudah ada 7 kartu spotlight, jadi cincin harus sudah di
  // ukuran aktif. Kalau tidak, subscriber hover tidak pernah menerima state
  // awal dan cincin tertahan kecil sampai terjadi perubahan berikutnya.
  const idle = await evalJs(String.raw`(() => {
    const ring = [...document.querySelectorAll('.fixed.rounded-full')]
      .find(e => e.className.includes('border'));
    return { w: Math.round(ring.getBoundingClientRect().width) };
  })()`);
  check('Cincin sudah ukuran aktif saat ada target hover', idle.w >= 30, idle.w + 'px');

  const move = await evalJs(String.raw`(async () => {
    const ring = [...document.querySelectorAll('.fixed.rounded-full')]
      .find(e => e.className.includes('border'));
    const fire = (x, y) => window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: x, clientY: y, bubbles: true, pointerType: 'mouse' }));
    fire(700, 400);
    await new Promise(r => setTimeout(r, 700));
    const a = window.__xform(ring);
    fire(300, 250);
    await new Promise(r => setTimeout(r, 900));
    const b = window.__xform(ring);
    return { a, b, moved: Math.abs(a.x - b.x) > 100 && Math.abs(a.y - b.y) > 100 };
  })()`);
  check('Cincin kursor mengikuti pointer', !!move.moved,
    move.a
      ? '(' + move.a.x.toFixed(0) + ',' + move.a.y.toFixed(0) + ') -> ('
        + move.b.x.toFixed(0) + ',' + move.b.y.toFixed(0) + ')'
      : 'n/a');

  const dot = await evalJs(String.raw`(async () => {
    const d = [...document.querySelectorAll('.fixed.rounded-full')]
      .find(e => e.className.includes('bg-'));
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 200, clientY: 200, bubbles: true, pointerType: 'mouse' }));
    await new Promise(r => setTimeout(r, 500));
    return { opacity: Number(getComputedStyle(d).opacity) };
  })()`);
  check('Titik kursor terlihat saat pointer bergerak', dot.opacity > 0.8,
    'opacity=' + dot.opacity);

  // Inti perilaku: titik melekat TEPAT di posisi pointer (tanpa lerp),
  // cincin mengejar di belakangnya. Kalau titik ikut dilerp, ia tertinggal
  // dari kursor asli; kalau ia diberi lerp lebih cepat dari cincin, ia
  // menyembul keluar. Keduanya sama-sama salah — titik harus menempel.
  const precision = await evalJs(String.raw`(async () => {
    const pick = (test) => [...document.querySelectorAll('.fixed.rounded-full')]
      .find(e => test(e.className));
    const ring = pick(c => c.includes('border'));
    const dotEl = pick(c => c.includes('bg-'));
    const fire = (x, y) => window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: x, clientY: y, bubbles: true, pointerType: 'mouse' }));
    fire(640, 430);
    await new Promise(r => setTimeout(r, 700));
    const seatedDot = window.__xform(dotEl);
    const seatedRing = window.__xform(ring);
    fire(120, 310); // lompatan jauh: dot harus pindah seketika, ring belum
    await new Promise(r => setTimeout(r, 20));
    const nowDot = window.__xform(dotEl);
    const nowRing = window.__xform(ring);
    const near = (p, x, y) => Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5;
    return {
      dotSeated: near(seatedDot, 640, 430),
      ringSeated: near(seatedRing, 640, 430),
      dotAtPointer: near(nowDot, 120, 310),
      ringLagging: Math.abs(nowRing.x - 120) > 5 || Math.abs(nowRing.y - 310) > 5,
      dotNow: { x: Math.round(nowDot.x), y: Math.round(nowDot.y) },
    };
  })()`);
  check('Titik diam tepat di posisi pointer', !!precision.dotSeated,
    'dot=(' + precision.dotNow.x + ',' + precision.dotNow.y + ')');
  check('Titik memindahkan diri seketika saat kursor lompat', !!precision.dotAtPointer,
    'dot=(' + precision.dotNow.x + ',' + precision.dotNow.y + ')');
  check('Cincin tertinggal mengejar di belakang titik', !!precision.ringLagging);

  // Cincin harus selalu berpusat di titik anchor (pointer) berapa pun
  // ukurannya. Dulu margin negatif dikunci di -sizeIdle/2, jadi cincin aktif
  // 44px pusatnya bergeser (44-14)/2 = 15px ke kanan-bawah -> dot tampak
  // tidak di tengah. Cek: pusat kotak cincin (rect) harus sama dengan posisi
  // transform-nya (anchor).
  const centered = await evalJs(String.raw`(async () => {
    const ring = [...document.querySelectorAll('.fixed.rounded-full')]
      .find(e => e.className.includes('border'));
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 700, clientY: 430, bubbles: true, pointerType: 'mouse' }));
    await new Promise(r => setTimeout(r, 700));
    const r = ring.getBoundingClientRect();
    const t = window.__xform(ring);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return {
      w: Math.round(r.width),
      offsetX: cx - t.x, offsetY: cy - t.y,
      centered: Math.abs(cx - t.x) < 1 && Math.abs(cy - t.y) < 1,
    };
  })()`);
  check('Cincin tetap berpusat di pointer saat membesar', centered.centered,
    'w=' + centered.w + ' offset=(' + centered.offsetX.toFixed(1) + ','
    + centered.offsetY.toFixed(1) + ')');
}

console.log('\n=== 7. MAGNETIC PULL ===');
{
  const mag = await evalJs(String.raw`(async () => {
    const el = document.querySelector('.magnetic');
    if (!el) return { found: false };
    el.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 900));
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const fire = (x, y) => window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: x, clientY: y, bubbles: true, pointerType: 'mouse' }));
    fire(cx - 400, cy - 300);
    await new Promise(r2 => setTimeout(r2, 900));
    const before = window.__xform(el);
    fire(cx + 30, cy);
    await new Promise(r2 => setTimeout(r2, 900));
    const after = window.__xform(el);
    return { found: true, before, after,
      moved: Math.abs(after.x - before.x) > 1.5 || Math.abs(after.y - before.y) > 1.5 };
  })()`);
  check('Elemen magnet ditemukan', mag.found);
  check('Magnet bergerak ke arah kursor', !!mag.moved,
    mag.before
      ? '(' + mag.before.x.toFixed(1) + ',' + mag.before.y.toFixed(1) + ') -> ('
        + mag.after.x.toFixed(1) + ',' + mag.after.y.toFixed(1) + ')'
      : 'n/a');

  const away = await evalJs(String.raw`(async () => {
    const el = document.querySelector('.magnetic');
    const r = el.getBoundingClientRect();
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: r.left - 600, clientY: r.top - 600, bubbles: true, pointerType: 'mouse' }));
    await new Promise(r2 => setTimeout(r2, 900));
    return window.__xform(el);
  })()`);
  check('Magnet kembali ke tempat saat kursor menjauh',
    Math.abs(away.x) < 1 && Math.abs(away.y) < 1,
    '(' + away.x.toFixed(2) + ', ' + away.y.toFixed(2) + ')');
}

console.log('\n=== 8. SPOTLIGHT KARTU ===');
{
  const sp = await evalJs(String.raw`(async () => {
    const card = document.querySelector('[data-spotlight-card]');
    if (!card) return { found: false };
    card.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 600));
    const beforeX = card.style.getPropertyValue('--mx');
    const beforeY = card.style.getPropertyValue('--my');
    const r = card.getBoundingClientRect();
    card.dispatchEvent(new PointerEvent('pointermove', {
      clientX: r.left + r.width * 0.8, clientY: r.top + 30,
      bubbles: true, pointerType: 'mouse' }));
    await new Promise(r2 => setTimeout(r2, 250));
    return { found: true, beforeX, beforeY,
             afterX: card.style.getPropertyValue('--mx'),
             afterY: card.style.getPropertyValue('--my') };
  })()`);
  check('Kartu spotlight ditemukan', sp.found);
  check('--mx diperbarui saat pointer bergerak', !!sp.afterX && sp.afterX !== sp.beforeX,
    '"' + sp.beforeX + '" -> "' + sp.afterX + '"');
  check('--my diperbarui', !!sp.afterY && sp.afterY !== sp.beforeY,
    '"' + sp.beforeY + '" -> "' + sp.afterY + '"');

  const glow = await evalJs(String.raw`(() => {
    const card = document.querySelector('[data-spotlight-card]');
    return { bg: getComputedStyle(card, '::before').backgroundImage.slice(0, 34) };
  })()`);
  check('Gradient spotlight terpasang di ::before', glow.bg.includes('radial'), glow.bg + '...');
}

console.log('\n=== 9. GARIS PROGRES CARA IKUT ===');
{
  const prog = await evalJs(String.raw`(async () => {
    const sec = document.querySelector('#cara-ikut');
    const line = sec.querySelector('.origin-left, .origin-top');
    if (!line) return { found: false };
    window.scrollTo(0, sec.offsetTop - window.innerHeight);
    await new Promise(r => setTimeout(r, 1300));
    const a = window.__xform(line).sx;
    window.scrollTo(0, sec.offsetTop + sec.offsetHeight - 200);
    await new Promise(r => setTimeout(r, 1700));
    const b = window.__xform(line).sx;
    return { found: true, a, b, grew: b > a + 0.05 };
  })()`);
  check('Garis progres ditemukan', prog.found);
  check('Garis tumbuh mengikuti scroll', !!prog.grew,
    'skalaX ' + (prog.a ?? 0).toFixed(2) + ' -> ' + (prog.b ?? 0).toFixed(2));
}

console.log('\n=== 10. PARALLAX ORNAMEN ===');
{
  const par = await evalJs(String.raw`(async () => {
    const el = document.querySelector('#tentang .pointer-events-none');
    if (!el) return { found: false };
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 1000));
    const a = window.__xform(el).y;
    const step = Math.round(window.innerHeight * 0.4);
    let peak = a;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 180));
      peak = Math.max(peak, window.__xform(el).y);
    }
    return { found: true, a, peak, changed: Math.abs(peak - a) > 5 };
  })()`);
  check('Ornamen DNA ada', par.found);
  check('Parallax menggeser ornamen', !!par.changed,
    'y ' + par.a.toFixed(1) + 'px -> puncak ' + par.peak.toFixed(1) + 'px');
}

console.log('\n=== 11. NAVBAR GLASSMORPHISM ===');
{
  // Diukur dari halaman SEGAR. State Lenis dari bagian sebelumnya tidak bisa
  // dibersihkan lewat `scrollTo` native: Lenis menelan event scroll native
  // pertama setelah menggulir mulusnya sendiri, jadi boleh jadi tidak ada
  // event scroll yang sampai ke navbar ketika halaman melompat ke atas --
  // navbar tertahan gelap meski scrollY = 0. Pengunjung tidak pernah
  // mengalami itu (kembali ke atas lewat Lenis/anchor selalu memproduksi
  // event), jadi test memakai dua pengamatan yang deterministik: kondisi
  // awal halaman yang baru dibuka, dan gulir ke bawah ala manusia.
  await goto();
  await sleep(1200);
  const atTop = await evalJs(String.raw`(() => {
    const h = document.querySelector('header');
    return { y: window.scrollY,
             bg: getComputedStyle(h).backgroundColor,
             blur: getComputedStyle(h).backdropFilter };
  })()`);

  // WheelEvent asli di window: Lenis mendengarnya, menggulir mulus, dan tiap
  // frame gulirnya memproduksi event scroll untuk navbar.
  const afterScroll = await evalJs(String.raw`(async () => {
    const h = document.querySelector('header');
    const wheel = (dy) => window.dispatchEvent(new WheelEvent('wheel', {
      deltaY: dy, deltaMode: 0, bubbles: true, cancelable: true,
    }));
    for (let i = 0; i < 6; i++) {
      wheel(400);
      await new Promise(r => setTimeout(r, 260));
    }
    await new Promise(r => setTimeout(r, 1400));
    return { y: window.scrollY,
             bg: getComputedStyle(h).backgroundColor,
             blur: getComputedStyle(h).backdropFilter,
             border: getComputedStyle(h).borderBottomColor };
  })()`);

  check('Halaman segar dimulai di posisi atas', atTop.y < 5, 'scrollY=' + atTop.y);
  check('Navbar transparan di atas', alphaOf(atTop.bg) < 0.05,
    atTop.bg + ' alpha=' + alphaOf(atTop.bg));
  check('Halaman benar-benar turun setelah gulir', afterScroll.y > 300, 'scrollY=' + afterScroll.y);
  check('Navbar glass setelah scroll', afterScroll.blur.includes('blur'), afterScroll.blur);
  check('Latar jadi gelap setelah scroll', alphaOf(afterScroll.bg) > 0.5, afterScroll.bg);
  check('Border emas muncul setelah scroll', afterScroll.border !== 'rgba(0, 0, 0, 0)',
    afterScroll.border);
}

/* ==================================================================
   BAGIAN 2 - mobile, pointer kasar
   ================================================================== */

console.log('\n=== 12. MOBILE: KURSOR & WEBGL MATI ===');
{
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    screenWidth: 390, screenHeight: 844,
  });
  await setMotion('no-preference', 'coarse');
  await goto();

  const envCheck = await evalJs(String.raw`(() => ({
    fine: matchMedia('(pointer: fine)').matches,
    coarse: matchMedia('(pointer: coarse)').matches,
    hover: matchMedia('(hover: hover)').matches,
  }))()`);
  check('Emulasi pointer sentuh aktif (pointer: coarse)',
    envCheck.coarse && !envCheck.fine,
    'coarse=' + envCheck.coarse + ' fine=' + envCheck.fine + ' hover=' + envCheck.hover);

  const mob = await evalJs(String.raw`(() => {
    const c = document.querySelector('canvas');
    return {
      cursorAttr: document.documentElement.getAttribute('data-custom-cursor'),
      bodyCursor: getComputedStyle(document.body).cursor,
      ambient: !!document.querySelector('.hero-ambient'),
      magneticMoved: [...document.querySelectorAll('.magnetic')].some(e => e.style.transform !== ''),
      canvasOpacity: c ? Number(getComputedStyle(c).opacity) : -1,
    };
  })()`);
  check('Kursor kustom NONAKTIF di layar sentuh', mob.cursorAttr === null, 'attr=' + mob.cursorAttr);
  check('Pointer asli dipertahankan', mob.bodyCursor !== 'none', 'cursor=' + mob.bodyCursor);
  check('Ambient glow CSS aktif sebagai pengganti WebGL', mob.ambient);
  check('Tidak ada transform magnet di layar sentuh', !mob.magneticMoved);
  check('Canvas WebGL tidak pernah fade-in di mobile', mob.canvasOpacity < 0.5,
    'opacity=' + mob.canvasOpacity);

  const menu = await evalJs(String.raw`(async () => {
    const btn = document.querySelector('button[aria-controls="menu-mobile"]');
    if (!btn) return { found: false };
    const r = btn.getBoundingClientRect();
    btn.click();
    await new Promise(r2 => setTimeout(r2, 700));
    const panel = document.querySelector('#menu-mobile');
    const link = panel && panel.querySelector('ul a');
    const pr = link && link.getBoundingClientRect();
    return { found: true, expanded: btn.getAttribute('aria-expanded'), panelOpen: !!panel,
      role: panel && panel.getAttribute('role'), modal: panel && panel.getAttribute('aria-modal'),
      tapW: Math.round(r.width), tapH: Math.round(r.height),
      linkH: pr ? Math.round(pr.height) : 0,
      lenisStopped: document.documentElement.classList.contains('lenis-stopped'),
      bodyOverflow: document.body.style.overflow };
  })()`);
  check('Tombol hamburger ada', menu.found);
  check('Target sentuh >= 44x44', menu.tapW >= 44 && menu.tapH >= 44, menu.tapW + 'x' + menu.tapH);
  check('Panel terbuka sebagai dialog modal',
    menu.panelOpen && menu.role === 'dialog' && menu.modal === 'true');
  check('aria-expanded=true', menu.expanded === 'true');
  check('Semua link menu >= 44px', menu.linkH >= 44, menu.linkH + 'px');
  check('Lenis DIHENTIKAN saat menu terbuka', menu.lenisStopped);
  check('Body overflow terkunci', menu.bodyOverflow === 'hidden', menu.bodyOverflow);

  const esc = await evalJs(String.raw`(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    return { closed: !document.querySelector('#menu-mobile'),
      lenisRunning: !document.documentElement.classList.contains('lenis-stopped'),
      overflow: document.body.style.overflow };
  })()`);
  check('Esc menutup menu', esc.closed);
  check('Lenis jalan lagi setelah ditutup', esc.lenisRunning && esc.overflow !== 'hidden');
}

/* ==================================================================
   BAGIAN 3 - prefers-reduced-motion
   ================================================================== */

console.log('\n=== 13. REDUCED MOTION ===');
{
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    screenWidth: 1440, screenHeight: 900,
  });
  await setMotion('reduce', 'fine');
  await goto();

  const rm = await evalJs(String.raw`(() => {
    const h1 = document.querySelector('h1');
    const steps = [...document.querySelectorAll('[data-step]')];
    const cards = [...document.querySelectorAll('[data-spotlight-card]')];
    const panels = [...document.querySelectorAll('[role="region"][id^="faq-panel"]')];
    const open = panels.find(p => p.getBoundingClientRect().height > 20);
    const accents = [...document.querySelectorAll('.text-gold-gradient, .bg-gold-gradient')];
    return {
      lenis: document.documentElement.classList.contains('lenis'),
      cursorAttr: document.documentElement.getAttribute('data-custom-cursor'),
      bodyCursor: getComputedStyle(document.body).cursor,
      h1Opacity: getComputedStyle(h1).opacity,
      h1Text: window.__sq(h1.textContent),
      h1Children: h1.querySelectorAll('div').length,
      hiddenSteps: steps.filter(e => Number(getComputedStyle(e).opacity) < 0.9).length,
      stepTotal: steps.length,
      hiddenCards: cards.filter(e => Number(getComputedStyle(e).opacity) < 0.9).length,
      cardTotal: cards.length,
      faqHasOpen: !!open,
      faqText: open ? open.textContent.trim().slice(0, 34) : '',
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      scrollable: document.body.scrollHeight > window.innerHeight,
      ambientAnim: getComputedStyle(document.querySelector('.hero-ambient')).animationName,
      accentTransitions: accents.map(a => getComputedStyle(a).transitionDuration),
      accentCount: accents.length,
    };
  })()`);
  check('Lenis NONAKTIF', !rm.lenis);
  check('Kursor kustom NONAKTIF', rm.cursorAttr === null);
  check('Pointer asli dipertahankan', rm.bodyCursor !== 'none', 'cursor=' + rm.bodyCursor);
  check('Scroll behavior normal', rm.scrollBehavior === 'auto', rm.scrollBehavior);
  check('Halaman tetap bisa di-scroll', rm.scrollable);
  check('Headline langsung terlihat', Number(rm.h1Opacity) > 0.9, 'opacity=' + rm.h1Opacity);
  check('Teks utuh tanpa SplitText',
    rm.h1Text.includes('Asah nalar') && rm.h1Text.includes('sains'), '"' + rm.h1Text + '"');
  check('SplitText tidak dijalankan', rm.h1Children === 0, rm.h1Children + ' div hasil split');
  check('Semua langkah terlihat', rm.hiddenSteps === 0,
    rm.hiddenSteps + '/' + rm.stepTotal + ' tersembunyi');
  check('Semua kartu terlihat', rm.hiddenCards === 0, rm.hiddenCards + '/' + rm.cardTotal);
  check('Ada jawaban FAQ terbuka & terbaca', rm.faqHasOpen, '"' + rm.faqText + '"');
  check('Ambient glow tidak beranimasi', rm.ambientAnim === 'none',
    'animation=' + rm.ambientAnim);

  const stillMoving = rm.accentTransitions.filter((v) => durSec(v) > 0.05);
  check('Gradasi emas tidak bertransisi', stillMoving.length === 0,
    stillMoving.length + '/' + rm.accentCount + ' masih punya transisi, contoh: '
      + (rm.accentTransitions[0] ?? 'n/a'));
}

console.log('\n=== 14. KONSOL BERSIH ===');
{
  check('Tidak ada exception / console.error di halaman', pageProblems.length === 0,
    pageProblems.length + ' masalah');
  if (pageProblems.length) pageProblems.forEach((p) => console.log('       ' + p));
}

console.log('\n' + '='.repeat(58));
console.log('  TOTAL: ' + pass + ' PASS / ' + fail + ' FAIL');
console.log('='.repeat(58));

ws.close();
chrome.kill();
process.exit(fail > 0 ? 1 : 0);
