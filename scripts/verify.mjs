/**
 * Verifikasi landing page Helixa Olympiad — sistem gerak + WebGL.
 *
 * Stack resmi: paket `motion` + CSS native + IntersectionObserver, ditambah
 * three.js (dua canvas: partikel hero & giroskop Aturan) dan GSAP (ticker
 * smooth scroll). Keduanya HANYA lewat dynamic import di dalam cabang gerbang
 * mode 'rich', jadi tidak pernah terunduh di HP.
 *
 * Dua lapis pemeriksaan:
 *  A. STATIS (tanpa browser): package.json, impor sumber, token CSS, font.
 *  B. BROWSER (Chrome headless via CDP): stacking antar-section, kinetic hero,
 *     bukti partikel lewat pembacaan framebuffer, reveal saat scroll, garis
 *     progres, parallax, FAQ, navbar, kursor kustom, magnet, spotlight,
 *     no-horizontal-scroll, reduced-motion, FPS, dan loop yang benar berhenti.
 *
 * CATATAN TENTANG SCREENSHOT: `Page.captureScreenshot` di Chrome headless TIDAK
 * menyertakan layer WebGL, jadi tidak bisa dipakai untuk membuktikan scene
 * three.js benar-benar menggambar. Percobaan dengan menyembunyikan canvas lewat
 * CSS mengubah nol piksel meskipun framebuffer-nya jelas berisi partikel.
 * Partikel karena itu dibaca lewat drawImage ke canvas 2D + getImageData di
 * dalam halaman, yang membaca framebuffer sungguhan.
 *
 * Fallback-proxy yang harus dipahami sebelum mengubah:
 *  - `Emulation.setEmulatedMedia` hanya bisa mengubah `prefers-reduced-motion`
 *    dan `any-pointer`/`any-hover`. Fitur `pointer`/`hover` utama ditentukan
 *    `Emulation.setTouchEmulationEnabled` (on -> coarse/none, off -> fine/hover).
 *  - Headless Chrome default-nya `prefers-reduced-motion: reduce`; verifikasi
 *    memaksa `no-preference` di bagian animasi aktif.
 *
 * PENTING soal mode: gerbang `useMotionMode` memeriksa PERANGKAT dulu, baru
 * preferensi gerak. Jadi untuk menguji mode 'rich' harus memenuhi pointer fine DAN
 * lebar >= 1024px. Menguji di viewport sempit dengan pointer fine akan mendapat
 * mode 'simple', bukan 'rich' - dan pemeriksaan WebGL akan gagal bukan karena
 * kodenya salah, tapi karena gerbangnya memang bekerja.
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

console.log('\n=== A1. DEPENDENSI & GATE GERBANG ===');
{
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  check('Paket motion terpasang', !!all.motion, all.motion ? 'motion@' + all.motion : 'tidak ada');
  check('three.js terpasang (pengecualian resmi)', !!all.three,
    all.three ? 'three@' + all.three : 'tidak ada');
  check('GSAP terpasang (smooth scroll)', !!all.gsap,
    all.gsap ? 'gsap@' + all.gsap : 'tidak ada');
  // Lenis tetap dilarang: smooth scroll di sini dibangun di atas ticker GSAP,
  // menambah Lenis berarti dua mesin lerp scroll yang saling melawan.
  check('Lenis tetap tidak terpasang', !all.lenis, all.lenis ? 'LENIS ADA' : 'tidak ada');

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

  /*
   * Tiga.js HANYA boleh diimpor dari dalam dua modul scene
   * (src/three/dnaParticles.ts dan src/three/gyroscope.ts). Di file lain,
   * satu-satunya jalan yang sah adalah `import()` DINAMIS di dalam cabang
   * gerbang mode - kalau `three` bocor ke modul yang ikut terunduh di HP, syarat
   * "mobile tidak boleh mengunduh three.js" langsung gagal tanpa error.
   */
  const threeStaticImports = [];
  const threeDynImports = [];
  for (const f of srcFiles) {
    const text = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const rel = f.replace(ROOT, '').replace(/\\/g, '/');
    // Impor statis: `import ... from 'three'`. Hanya boleh di dalam src/three/.
    if (/from\s+['"]three['"]/.test(text) && !rel.includes('/src/three/')) {
      threeStaticImports.push(rel);
    }
    if (/from\s+['"]three['"]/.test(text)) threeDynImports.push(rel);
  }
  check('three.js hanya diimpor di dalam src/three/ (scene modules)',
    threeStaticImports.length === 0,
    threeStaticImports.length ? threeStaticImports.join(', ') : threeDynImports.length + ' scene module');

  // Dua-duanya harus lewat import() dinamis supaya tidak masuk bundel utama.
  for (const wrapper of ['components/HeroParticles.tsx', 'components/GyroCanvas.tsx']) {
    const f = join(src, wrapper);
    const text = existsSync(f) ? readFileSync(f, 'utf8') : '';
    check(`${wrapper} memuat scene lewat import() dinamis`,
      /import\(\s*['"]\.\.\/three\//.test(text),
      existsSync(f) ? (/\(/.test(text) ? 'ok' : 'TIDAK ADA import() dinamis') : 'file tidak ada');
  }

  // GSAP juga harus dinamis: smooth scroll hanya aktif di mode 'rich'.
  const smooth = readFileSync(join(src, 'hooks', 'useSmoothScroll.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  check('GSAP hanya lewat import() dinamis (tidak di bundel utama)',
    /import\(\s*['"]gsap['"]\s*\)/.test(smooth) && !/from\s+['"]gsap['"]/.test(smooth),
    /import\(\s*['"]gsap['"]\s*\)/.test(smooth) ? 'dinamis' : 'impor statis - BOLEH BOCOR KE HP');
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
  /*
   * Dulu dicek pakai `@media (max-width: 767px)`. Sekarang blok itu hilang
   * dengan sengaja: pin tidak lagi dibalik oleh lebar, tapi oleh satu syarat
   * gabung (lebar DAN tinggi). Yang dijaga di sini adalah akibatnya, yaitu
   * ada kondisi yang mematikan `--stack`, dan itu harus ada baik di
   * reduced-motion maupun di luar layar yang cukup besar.
   */
  check('Stack punya kondisi mati di luar layar cukup besar',
    /@media \(min-width: 1024px\) and \(min-height: 720px\)[\s\S]*?\.stack-wrap--stack \{\s*position: sticky/.test(css),
    'syarat pin tidak ditemukan');
  check('Stack dimatikan total di prefers-reduced-motion',
    css.includes('prefers-reduced-motion: reduce') &&
      /prefers-reduced-motion: reduce[\s\S]*?\.stack-wrap--stack \{[\s\S]*?position: relative !important/.test(css),
    'override reduced-motion untuk --stack tidak ditemukan');
}

/* ==================================================================
   B. BROWSER
   ================================================================== */

/*
 * `--disable-gpu` SENGAJA TIDAK dipakai.
 *
 * Site ini punya dua canvas WebGL yang menggambar tiap frame (partikel hero dan
 * giroskop Aturan). Dengan `--disable-gpu`, Chrome memaksa WebGL ke software
 * rasterizer (SwiftShader) di CPU. Menggambar 1440x900 dengan additive blending
 * di software cukup lambat sampai requestAnimationFrame milik komponen lain ikut
 * kelaparan - navbar tidak pernah sempat menyelesaikan transisinya, dan screenshot
 * yang diambil menangkap frame basi.
 *
 * Gejalanya sangat menyesatkan: kegagalan itu muncul sebagai bug navbar dan bug
 * partikel, padahal penyebabnya konfigurasi harness. Dengan GPU sungguhan
 * (ANGLE/D3D11 di Windows) waktu frame jadi realistis, dan yang diukur di sini
 * mendekati apa yang dilihat pengguna.
 */
const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--hide-scrollbars', '--no-sandbox',
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
    document.querySelectorAll('#top section.stack-wrap').forEach((s) => {
      window.__docTop[s.id || 'hero'] = Math.round(s.getBoundingClientRect().top + window.scrollY);
    });
    return true;
  })()`);
}

/* ---------------------------------------------------------- DESKTOP */

console.log('\n=== B1. DESKTOP 1440x900: SEKAHITAN KARTU BERCARD, SISANYA GARIS RAMBUT ===');
{
  await setViewport(1440, 900, false);
  await setMotion('no-preference', false);
  await goto();

  /*
   * Selector section memakai descendant, bukan child langsung, dan itu bukan
   * sekadar gaya penulisan.
   *
   * Scroll lock "Cara Ikut" memakai `pin: true`, dan ScrollTrigger tidak
   * mem-pin elemennya di tempat: ia membungkusnya dengan `<div class="pin-spacer">`
   * yang tingginya sama dengan runway scroll. Akibatnya section itu turun satu
   * tingkat, jadi `#top > section` tidak lagi melihatnya - seolah-olah section
   * yang hilang, padahal isinya utuh.
   *
   * Blok penghitungan `__docTop` di `goto()` memakai selector yang sama supaya
   * hitungan section dan posisinya tetap konsisten: 8 section, z-index 10..80.
   */
  const stack = await evalJs(String.raw`(() => {
    const secs = [...document.querySelectorAll('#top section.stack-wrap')];
    return secs.map((s) => {
      const cs = getComputedStyle(s);
      const shell = s.querySelector('.shell');
      const scs = shell ? getComputedStyle(shell) : null;
      return {
        id: s.id || '(hero)',
        z: Number(cs.zIndex),
        pos: cs.position,
        top: cs.top,
        minH: cs.minHeight,
        radius: cs.borderTopLeftRadius,
        shadow: cs.boxShadow !== 'none',
        borderTop: cs.borderTopWidth,
        rule: s.classList.contains('stack-wrap--rule'),
        card: s.classList.contains('stack-wrap--card'),
        scrollMargin: cs.scrollMarginTop,
        h: Math.round(s.getBoundingClientRect().height),
        contentH: shell
          ? Math.round(
              shell.getBoundingClientRect().height -
                (parseFloat(scs.paddingTop) || 0) -
                (parseFloat(scs.paddingBottom) || 0),
            )
          : 0,
        padT: scs ? Math.round(parseFloat(scs.paddingTop) || 0) : 0,
      };
    });
  })()`);
  const count = stack.length;
  check('Delapan section dalam <main>', count === 8, count + ' section');
  const zok = stack.map((s) => s.z).join(',') === '10,20,30,40,50,60,70,80';
  check('z-index naik 10..80 sesuai urutan', zok, stack.map((s) => s.z).join(','));

  /*
   * Persyaratannya berubah: efek menumpuk maksimal DUA section, bukan semua.
   * Section yang dipilih adalah `tentang` dan `perdana` — keduanya langsung
   * setelah hero, jadi efeknya kebaca di awal scroll.
   */
  const pinnedIds = stack.filter((s) => s.pos === 'sticky').map((s) => s.id);
  check('Maksimal 2 section yang di-pin', pinnedIds.length === 2, pinnedIds.join('+') || 'tidak ada');
  check('Dua section itu: tentang + Perdana',
    pinnedIds.join(',') === 'tentang,perdana', pinnedIds.join(','));
  check('Section di-pin: top:0 + min-height 100svh',
    pinnedIds.length === 2 && stack.filter((s) => s.pos === 'sticky')
      .every((s) => s.top === '0px' && parseFloat(s.minH) >= 800),
    stack.filter((s) => s.pos === 'sticky').map((s) => s.pos + '/' + s.minH).join(' '));

  const pinnedAll = stack.filter((s) => s.pos === 'sticky');
  check('Isi section di-pin muat di viewport (tidak ada ekor tak terjangkau)',
    pinnedAll.every((s) => s.padT + s.contentH <= 900),
    pinnedAll.map((s) => s.id + ' ' + (s.padT + s.contentH) + 'px').join(' '));

  const cards = stack.filter((s) => s.card);
  check('Tepat 2 section memakai kartu (radius 28px + shadow)',
    cards.length === 2 && cards.every((s) => s.radius === '28px' && s.shadow),
    cards.map((s) => s.id + ' r=' + s.radius).join(' '));
  check('Hero tanpa radius/bayangan, section lain tanpa kartu',
    stack[0].radius === '0px' && !stack[0].shadow && !stack[0].card &&
      stack.slice(1).filter((s) => !s.card).every((s) => s.radius === '0px' && !s.shadow),
    'hero=' + stack[0].radius + '/' + stack[0].shadow);
  check('Lima section biasa memakai garis rambut, bukan kartu',
    stack.filter((s) => s.rule).length === 5 &&
      stack.filter((s) => s.rule).every((s) => parseFloat(s.borderTop) === 1 && !s.card),
    stack.filter((s) => s.rule).map((s) => s.id).join(','));

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

console.log('\n=== B2. HERO: KINETIC TYPOGRAPHY + AMBIENT + OBJEK 3D ===');
{
  const hero = await evalJs(String.raw`(async () => {
    const h1 = document.querySelector('#top h1');
    const lines = [...h1.querySelectorAll('.kinetic-line')];
    const accent = lines.find((l) => l.className.includes('text-gold-gradient'));
    // Tunggu scene benar-benar siap: canvas muncul DAN fade-in-nya selesai.
    //
    // Timeout tetap dulu (2500ms) tidak bisa dipakai di sini. Scene dimuat lewat
    // dynamic import lalu fade-in 1 detik, jadi waktu GPU yang berbeda saja
    // sudah cukup membuat sampling jatuh di tengah transisi - canvas terukur di
    // opacity ~1%. Dengan opacity segitu partikel hampir tidak berkontribusi
    // apa pun, sehingga A/B di bawah otomatis melaporkan selisih nol dan
    // menyimpulkan "canvas kosong" padahal isinya ada.
    //
    // Jadi kondisinya dipolling, bukan waktunya ditebak: sama seperti navbar,
    // ini tidak bisa lulus kalau transisinya benar-benar tidak pernah tuntas.
    const cvReady = document.querySelector('.hero-section canvas');
    const opacityDone = await (async () => {
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 150));
        if (cvReady && Number(getComputedStyle(cvReady).opacity) > 0.95) return true;
      }
      return false;
    })();
    const cv = cvReady;
    return {
      opacityDone,
      text: window.__sq(h1.textContent),
      lines: lines.length,
      lineY: lines.map((l) => window.__xform(l).y),
      accentGrad: accent ? getComputedStyle(accent).backgroundImage.includes('gradient') : false,
      ambient: !!document.querySelector('.hero-ambient'),
      ambientAnim: getComputedStyle(document.querySelector('.hero-ambient')).animationName,
      scrim: !!document.querySelector('.hero-scrim'),
      hint: !!document.querySelector('.hero-scroll-hint'),
      canvas: !!cv,
      canvasOpacity: cv ? Number(getComputedStyle(cv).opacity) : 0,
      canvasSize: cv ? { w: cv.width, h: cv.height } : null,
      // Konfirmasi nyata bahwa ini canvas WebGL, bukan Canvas 2D.
      isWebGL: cv ? !!(cv.getContext('webgl2') || cv.getContext('webgl')) : false,
      svgHelix: !!document.querySelector('.hero-dna-helix'),
      // Kotak headline dipakai untuk pertanyaan "apakah motif menindih teks",
      // yang lebih jujur dijawab secara geometri daripada lewat centroid piksel.
      h1Box: (() => {
        const b = h1.getBoundingClientRect();
        return { left: Math.round(b.left), right: Math.round(b.right) };
      })(),
      vw: window.innerWidth,
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
  check('Scrim hero ada (melindungi teks dari objek 3D)', hero.scrim);
  check('Scroll hint ada', hero.hint);
  check('Kanvas partikel dibuat di mode rich', hero.canvas,
    hero.canvas ? hero.canvasSize.w + 'x' + hero.canvasSize.h : 'tidak ada');
  check('Kanvas partikel benar-benar WebGL (bukan Canvas 2D)', hero.isWebGL);
  check('Fallback SVG helix TIDAK ikut tampil di mode rich', !hero.svgHelix,
    hero.svgHelix ? 'kedua motif tampil bersamaan' : 'hanya partikel');
  check('Kanvas partikel fade-in selesai', hero.opacityDone,
    'opacity=' + hero.canvasOpacity);

  /*
   * Bukti bahwa partikel benar-benar menggambar: baca framebuffer-nya langsung.
   *
   * Screenshot CDP dipakai pertama kali untuk ini, dan hasilnya menyesatkan -
   * menyembunyikan canvas lewat CSS tidak mengubah satu piksel pun. Penyebabnya
   * layer WebGL tidak ikut ter-capture di Chrome headless, jadi A/B berbasis
   * screenshot hanya bisa menghasilkan dua jawaban yang salah: "kosong" untuk
   * scene yang berjalan, atau "ada isi" untuk scene yang mati.
   *
   * drawImage ke canvas 2D + getImageData membaca framebuffer sungguhan, di
   * dalam halaman, tanpa perantara compositor. Kalau scene tidak menggambar
   * apa pun, angka ini benar-benar nol.
   */
  const fb = await evalJs(String.raw`(() => {
    const cv = document.querySelector('.hero-section canvas');
    if (!cv) return JSON.stringify({ error: 'tidak ada canvas' });
    const scratch = document.createElement('canvas');
    scratch.width = cv.width;
    scratch.height = cv.height;
    const ctx = scratch.getContext('2d');
    ctx.drawImage(cv, 0, 0);
    const d = ctx.getImageData(0, 0, scratch.width, scratch.height).data;
    let lit = 0, maxLuma = 0, sumX = 0, sumW = 0;
    for (let y = 0; y < scratch.height; y += 2) {
      for (let x = 0; x < scratch.width; x += 2) {
        const i = (y * scratch.width + x) * 4;
        if (d[i + 3] < 8) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (luma < 20) continue;
        if (r - b < 18) continue; // harus keemasan, bukan putih/abu
        lit++;
        if (luma > maxLuma) maxLuma = luma;
        sumX += x * luma;
        sumW += luma;
      }
    }
    return JSON.stringify({
      lit,
      maxLuma: Math.round(maxLuma),
      // Posisi motif di layar, sebagai fraksi lebar canvas.
      centerFrac: sumW ? +(sumX / sumW / scratch.width).toFixed(3) : 0,
    });
  })()`);
  const fbData = JSON.parse(fb);
  check('Partikel benar-benar menggambar emas di framebuffer (bukan bidang kosong)',
    fbData.lit > 2000 && fbData.maxLuma > 100,
    'lit=' + fbData.lit + ' maxLuma=' + fbData.maxLuma);
  /*
   * Motif partikel DIPUSATKAN di layar (MOTIF_CENTER_X = 0.5 di
   * three/dnaParticles.ts), jadi yang diuji di sini adalah "tepat di tengah",
   * bukan "cukup di kanan".
   *
   * Arah tanda offset kamera juga terkunci di sini. Offsetnya dihitung dari
   * geometri kamera, dan menggeser kamera ke x positif membuat motif muncul di
   * KIRI - persis kebalikan dari maksudnya. Dulu tanda itu terbalik, motif
   * terdorong ke kiri masuk ke bagian hero-scrim yang paling pekat, dan praktis
   * tidak terlihat meski scene-nya berjalan. Menggeser MOTIF_CENTER_X sedikit
   * saja sudah cukup untuk membuat cek ini gagal lagi.
   */
  check('Motif partikel terpusat di layar',
    Math.abs(fbData.centerFrac - 0.5) < 0.08,
    'pusat motif di ' + (fbData.centerFrac * 100).toFixed(1) + '% lebar layar');
  /*
   * Headline tetap terbaca setelah motif dipusatkan. Objek 3D sekarang berada
   * DI DEPAN headline secara geometri, jadi yang melindunginya bukan "tidak
   * overlapped", tapi urutan gambar: canvas -> scrim -> konten.
   *
   * Dua syarat yang diuji, keduanya struktural (bukan perkiraan visual):
   *   1. `.hero-scrim` benar-benar ditulis SETELAH canvas (bukan sebelum),
   *      dan teks berada di dalam shell yang juga setelah scrim. Kalau urutan
   *      ini berubah, partikel akan tergambar di atas headline.
   *   2. Stop paling kiri scrim benar-benar pekat. Scrim satu-satunya lapisan
   *      yang meredupkan partikel di belakang headline, jadi kalau alphanya
   *      diturunkan, headline tergambar di atas partikel.
   */
  const paint = JSON.parse(await evalJs(String.raw`(() => {
    const hero = document.querySelector('.hero-section');
    const canvas = hero.querySelector('canvas');
    const scrim = hero.querySelector('.hero-scrim');
    const shell = hero.querySelector('.shell');
    const AFTER = Node.DOCUMENT_POSITION_FOLLOWING;
    const bg = getComputedStyle(scrim).backgroundImage;
    const stop = bg.match(/linear-gradient\([^,]+,\s*rgba\([^)]*?,\s*([\d.]+)\)/);
    return JSON.stringify({
      scrimAfterCanvas: !!(canvas.compareDocumentPosition(scrim) & AFTER),
      textAfterScrim: !!(scrim.compareDocumentPosition(shell) & AFTER),
      leftStopAlpha: stop ? +stop[1] : null,
      layers: (bg.match(/gradient\(/g) || []).length,
    });
  })()`));
  check('Urutan gambar hero benar: canvas -> scrim -> teks',
    paint.scrimAfterCanvas && paint.textAfterScrim,
    'scrim setelah canvas=' + paint.scrimAfterCanvas + ', teks setelah scrim=' + paint.textAfterScrim);
  check('Scrim hero benar-benar meredupkan partikel di belakang headline',
    paint.leftStopAlpha !== null && paint.leftStopAlpha >= 0.8 && paint.layers >= 3,
    'alpha stop kiri=' + paint.leftStopAlpha + ', jumlah lapisan=' + paint.layers);
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
  /*
   * Ada DUA implementasi garis, dipilih mode gerak, dan keduanya harus tumbuh
   * mengikuti scroll:
   *
   *  - mode 'rich': `.timeline-progress-fill`, scaleX ditulis ScrollTrigger
   *    (dan section-nya ter-pin). Diperiksa jauh lebih ketat di blok scroll
   *    lock: bukan cuma "tumbuh", tapi persis penuh saat pin dilepas.
   *  - mode lain: `motion.div` dengan `origin-top md:origin-left` plus scaleX
   *    dan scaleY dari `useScrollProgress`, jalur lama yang tidak pernah berubah.
   *
   * Selector di sini sengaja memuat keduanya, dan yang diukur hanya "naik atau
   * tidak", supaya blok ini tetap berlaku di mode mana pun.
   */
  const prog = await evalJs(String.raw`(async () => {
    const sec = document.getElementById('cara-ikut');
    const line = sec.querySelector('.timeline-progress-fill, .md\\:origin-left');
    if (!line) return { found: false };
    const gsapDriven = line.classList.contains('timeline-progress-fill');
    const top = window.__docTop['cara-ikut'];
    const read = () => window.__xform(line).sx;
    window.scrollTo(0, Math.max(0, top - window.innerHeight * 0.6));
    await new Promise(r => setTimeout(r, 500));
    const a = read();
    window.scrollTo(0, top + window.innerHeight * 0.6);
    await new Promise(r => setTimeout(r, 600));
    const b = read();
    return { found: true, gsapDriven, a, b, grew: b > a + 0.08 };
  })()`);
  check('Garis progres ditemukan', prog.found,
    prog.found ? (prog.gsapDriven ? 'ScrollTrigger (mode rich)' : 'useScrollProgress (mode simple)') : '');
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
    /*
     * FAQ sekarang section biasa (flow normal, bukan kartu yang di-pin), jadi
     * yang diuji bukan lagi "top = 0" — itumilik mechanism yang sudah tidak
     * dipakai di sini. Yang tetap penting dan justru lebih ketat sekarang:
     * section ini harus muncul utuh di layar, DAN tidak boleh ada section
     * ter-pin (tentang / Perdana) yang menutupi tombolnya. Dua-duanya dicek
     * lewat elementFromPoint di bawah.
     */
    sec.scrollIntoView({ block: 'start' });
    await new Promise(r => setTimeout(r, 1200));
    const sectionTop = Math.round(sec.getBoundingClientRect().top);
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
    return { sectionTop, int0, afterOpen, closed, clickable };
  })()`);
  check('Item FAQ muncul', faq.int0.items >= 5, faq.int0.items + ' item');
  check('Section FAQ masuk penuh ke layar', Math.abs(faq.sectionTop) < 120,
    'top=' + faq.sectionTop + 'px');
  check('Panel pertama terbuka awal', faq.int0.open > 15, 'h=' + faq.int0.open);
  check('Panel tertutup punya inert', faq.int0.inert1 === true);
  check('Klik membuka item kedua & menutup item pertama', faq.afterOpen.openIdx === 1,
    'h1=' + faq.afterOpen.h1);
  check('aria-expanded benar', faq.afterOpen.exp === 'true');
  check('Panel pertama ikut inert saat tertutup', faq.afterOpen.inert0 === true);
  check('Klik kedua menutup kembali', faq.closed.openIdx === -1 && faq.closed.h1 < 5,
    'h1=' + faq.closed.h1);
  check('Tombol FAQ diklik, tidak tertutup section ter-pin', faq.clickable);
}

console.log('\n=== B7. NAVBAR: TRANSPARAN -> SOLID+BLUR ===');
{
  const nb = await evalJs(String.raw`(async () => {
    // B7 memakai halaman yang sama dengan bagian sebelumnya; kembalikan ke
    // posisi atas dulu supaya state navbar terukur dari kondisi segar. Tunggu
    // transisi background navbar (0.5s) benar-benar selesai.
    window.scrollTo(0, 0);
    const h = document.querySelector('header');
    // Sama seperti di bawah: tunggu transisi mundur selesai. Bagian ini
    // dimulai dari posisi yang sudah digulir (bagian sebelumnya menguji FAQ),
    // jadi navbar sedang dalam keadaan solid dan harus kembali transparan.
    const settledTop = await (async () => {
      let prev = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 150));
        const now = getComputedStyle(h).backgroundColor;
        if (prev !== null && now === prev) return now;
        prev = now;
      }
      return getComputedStyle(h).backgroundColor;
    })();
    const top = {
      y: window.scrollY,
      bg: settledTop,
      blur: getComputedStyle(h).backdropFilter,
    };
    window.scrollTo(0, 600);
    /*
     * Tunggu transisi navbar benar-benar selesai, bukan menebak durasinya.
     * Timeout tetap sebelumnya (700ms) menghasilkan sampel 0,43–0,68 pada
     * lima percobaan berturut — nilai yang benar 0,72, tapi terjaring di tengah
     * jalan karena mesin sedang load. Polling sampai nilainya dua kali sama
     * itu mengukur keadaan sebenarnya, dan tidak bisa lulus kalau transisi
     * benar-benar tidak pernah tuntas.
     */
    const settled = await (async () => {
      let prev = null;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 150));
        const now = getComputedStyle(h).backgroundColor;
        if (prev !== null && now === prev) return now;
        prev = now;
      }
      return getComputedStyle(h).backgroundColor;
    })();
    const gone = {
      y: window.scrollY,
      bg: settled,
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

console.log('\n=== B8. KURSOR KUSTOM (pointer fine, tanpa batas lebar) ===');
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

  /*
   * Regresi yang pernah nyata terjadi: gerbang kursor sempat diketatkan jadi
   * `min-width: 1024px`, sehingga kursor hilang di jendela yang lebih sempit
   * padahal pointer-nya presisi. Kursor adalah penanda presisi, bukan fitur
   * luxury, jadi wajib harus hidup di lebar berapa pun selama pointer
   * presisi. Diuji di 900px — di bawah ambang parallax, tapi jauh di atas
   * lebar ponsel.
   */
  await setViewport(900, 800, false);
  await setMotion('no-preference', false);
  await goto();
  const narrow = await evalJs(String.raw`(() => ({
    attr: document.documentElement.getAttribute('data-custom-cursor'),
    ring: !!document.querySelector('.cursor-ring'),
    bodyCursor: getComputedStyle(document.body).cursor,
  }))()`);
  check('Kursor tetap hidup di 900px + pointer fine',
    narrow.attr === 'on' && narrow.ring && narrow.bodyCursor === 'none',
    'attr=' + narrow.attr + ' ring=' + narrow.ring + ' cursor=' + narrow.bodyCursor);
  check('Parallax tetap mati di 900px (batasnya 1024px)',
    await evalJs(String.raw`(() => {
      const el = document.querySelector('[data-parallax]');
      if (!el) return false;
      const t = getComputedStyle(el).transform;
      return t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';
    })()`), 'transform ambient di 900px');
  await setViewport(1440, 900, false);
  await setMotion('no-preference', false);
  await goto();
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
  /*
   * Rekam request JARINGAN sungguhan, lalu muat ulang halaman di viewport
   * ponsel.
   *
   * Syarat "HP tidak boleh mengunduh chunk three.js" harus diukur di tingkat
   * jaringan, bukan dari DOM. DOM hanya bisa membuktikan canvas tidak ada; itu
   * akan tetap benar/skena kalau three.js sudah terpaket di dalam bundle utama
   * dan terunduh besertanya - yang justru violate_FULL. Satu-satunya bukti
   * yang sah: daftar file .js yang benar-benar diminta browser.
   */
  const jsRequests = [];
  const onRequest = (p) => {
    const u = p.request?.url ?? '';
    if (/\.js(\?|$)/.test(u)) jsRequests.push(u.split('/').pop().split('?')[0]);
  };
  waiters.set('Network.requestWillBeSent', [...(waiters.get('Network.requestWillBeSent') ?? []), onRequest]);
  await send('Network.enable');

  await setViewport(390, 844, true);
  await setMotion('no-preference', true);
  await goto();

  const jsMobile = [...new Set(jsRequests)];
  const threeChunks = jsMobile.filter((f) => /three|dnaParticles|gyroscope/i.test(f));
  check('Mobile hanya mengunduh 1 file .js (bundle utama saja)', jsMobile.length === 1,
    jsMobile.join(', '));
  check('Chunk three.js TIDAK terunduh di mobile', threeChunks.length === 0,
    threeChunks.length ? threeChunks.join(', ') : 'nol');
  check('Chunk GSAP juga tidak terunduh di mobile (smooth scroll mati di mode simple)',
    jsMobile.length === 1, 'jumlah .js = ' + jsMobile.length);

  const env = await evalJs(String.raw`(() => {
    const secs = [...document.querySelectorAll('#top > section.stack-wrap')];
    return {
      fine: matchMedia('(pointer: fine)').matches,
      coarse: matchMedia('(pointer: coarse)').matches,
      pos: secs.map((s) => getComputedStyle(s).position),
      ids: secs.map((s) => s.id || '(hero)'),
      stacked: secs.map((s) => s.classList.contains('stack-wrap--stack')),
      mt: secs.map((s) => getComputedStyle(s).marginTop),
      zs: secs.map((s) => getComputedStyle(s).zIndex),
      canvas: !!document.querySelector('canvas'),
    };
  })()`);
  check('Emulasi pointer sentuh aktif', env.coarse && !env.fine,
    'coarse=' + env.coarse + ' fine=' + env.fine);
  check('Section tidak lagi position:sticky (flow normal)', env.pos.every((p) => p === 'relative'),
    env.pos.join(','));
  /*
   * Hanya dua section yang boleh overlap. Di mobile keduanya kehilangan pin,
   * jadi kesan bertumpuk datang lewat margin-top -28px — section biasa tetap
   * flow penuh tanpa overlap.
   */
  const stackedIdx = env.stacked.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  check('Tepat 2 section yang ditumpuk', stackedIdx.length === 2, stackedIdx.length + ' section');
  check('Hanya kartu menumpuk yang overlap -28px',
    stackedIdx.length === 2 &&
      stackedIdx.every((i) => env.mt[i] === '-28px') &&
      env.mt.filter((m, i) => !env.stacked[i] && m !== '0px').length === 0,
    env.ids.map((id, i) => id + '=' + env.mt[i]).join(' '));
  check('z-index bertingkat tetap dipertahankan', env.zs.join(',') === '10,20,30,40,50,60,70,80',
    env.zs.join(','));
  check('Objek 3D hero tidak dibuat di bawah 768px', env.canvas === false,
    env.canvas ? 'canvas ada' : 'canvas tidak ada');

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
      canvas: !!document.querySelector('canvas'),
      ambient: !!document.querySelector('.hero-ambient'),
    };
  })()`);
  check('Semua section relative (pin dilepas)', rm.pos.every((p) => p === 'relative'), rm.pos.join(','));
  check('Kartu tanpa radius & bayangan', rm.radius.every((r) => r === '0px') && rm.shadow.every((s) => !s));
  check('Overlap dinolkan', rm.mt.every((m) => m === '0px'), rm.mt.join(','));
  check('Objek 3D hero tidak dibuat sama sekali', rm.canvas === false,
    rm.canvas ? 'canvas ada' : 'canvas tidak ada');
  check('Ambient glow tetap ada (lapisan dasar hero)', rm.ambient);
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

  /*
   * Pernyataan paling kuat yang bisa dibuat soal reduced-motion: tidak ADA
   * animasi CSS yang sedang berjalan di seluruh halaman, bukan hanya "elemen
   * yang kami kenal".
   *
   * getAnimations() mengembalikan setiap animasi yang aktif, termasuk yang
   * berasal dari stylesheet pihak ketiga. Kalau daftar ini kosong, maka tidak
   * ada partikel yang berputar, tidak ada giroskop yang bergerak, tidak ada
   * parallax yang bergeser, dan tidak ada tombol yang berkedip - semuanya
   * mustahil diam kalau ada animasi yang hidup. Menghitung elemen satu per satu
   * hanya akan memeriksa apa yang sudah kita tahu, dan baru sadar ada yang
   * terlewat kalau daftar elemen yang diperiksa ikut berubah.
   */
  const anim = JSON.parse(
    await evalJs(String.raw`(() => JSON.stringify({
      running: document.getAnimations().filter((a) => a.playState === 'running').length,
      total: document.getAnimations().length,
    }))()`),
  );
  check('TIDAK ADA animasi CSS yang berjalan di seluruh halaman (reduced)',
    anim.running === 0, 'running=' + anim.running + ' dari total=' + anim.total);
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

console.log('\n=== B15. PERFORMA: FPS & RENDER LOOP BERHENTI ===');
{
  /*
   * Dua canvas WebGL ini adalah satu-satunya bagian situs yang tidak terukur
   * oleh pemeriksaan DOM. Kalau scene-nya diam, looping, atau boros, semua cek
   * lain tetap hijau: DOM-nya benar, yang salah adalah bagian internalnya.
   *
   * Cara menghitung rAF supaya tidak menipu diri sendiri:
   * window.requestAnimationFrame dibungkus, sehingga setiap callback yang
   * dijadwalkan HANYA oleh kode situs ikut terhitung. Loop pengukuran sendiri
   * memakai referensi rAF yang dibungkus lebih dulu, jadi tidak menghitung
   * dirinya. Tanpa pemisahan ini, "nol frame" akan selalu bisa dicapai oleh
   * alat pengukur, bukan oleh produk.
   */
  await setViewport(1440, 900, false);
  await setMotion('no-preference', false);
  await goto();

  /*
   * Dipisah jadi fungsi sendiri, bukan satu blok inline, karena ada blok lain
   * di bawah yang me-navigate ulang halaman (sweep lebar untuk kanvas gyro).
   * `goto()` membuat dokumen BARU, jadi wrapper rAF ikut hilang bersama
   * dokumen lama dan harus dipasang lagi di halaman baru - satu kali per
   * dokumen. Memasangnya dua kali pada dokumen yang sama akan rekursif: wrapper
   * yang lebih lama memanggil `window.__nativeRaf` secara dinamis, dan begitu
   * properti itu ditimpa wrapper yang lebih baru, wrapper lama memanggil dirinya
   * sendiri sampai stack overflow.
   */
  /*
   * Counter rAF yang memisahkan loop kita dari loop pihak ketiga.
   *
   * Kenapa perlu: ScrollTrigger - yang dipakai untuk scroll lock "Cara Ikut" -
   * menjalankan rAF sendiri secara permanen. Dua sumbernya, keduanya di dalam
   * chunk ScrollTrigger dan keduanya tanpa henti seumur halaman:
   *
   *   1. Ticker menganggur. `enable()` menyalakan
   *      `function o(){ return _r && requestAnimationFrame(o) }`, dan `disable()`
   *      tidak pernah menyentuh `_r` lagi.
   *   2. Penjaga scrollEnd. `Nn` terus menanyakan "sudah 34ms sejak scroll
   *      terakhir" lalu menjadwalkan `requestAnimationFrame(bt)`, dan `bt`
   *      mengembalikan `Dr = 0` supaya bisa dijadwalkan lagi. Efeknya sekitar 2
   *      callback per detik meski halaman diam total.
   *
   * Kalau keduanya ikut dihitung, ukuran ini justru berbalik arah: FPS jadi
   * dua kali lipat karena satu bingkai punya dua callback, dan cek "render loop
   * benar-benar berhenti" selalu gagal padahal tidak ada satu pun loop gambar
   * yang menyala.
   *
   * Cara memisahkannya bukan dengan menebak bentuk kodenya, tapi dengan membaca
   * chunk ScrollTrigger hasil build yang sama: setiap nama fungsi yang-situ
   * dimasukkan ke `requestAnimationFrame(...)` adalah milik ScrollTrigger.
   * Nama minified berubah tiap build, tapi set ini dibaca ulang tiap kali
   * verifikasi dijalankan, jadi tidak pernah basi. Kalau chunk-nya tidak ada,
   * verifikasi gagal keras - bukan diam-diamfell through.
   */
  const gsapRafNames = (() => {
    const dir = join(ROOT, 'dist', 'assets');
    const files = existsSync(dir)
      ? readdirSync(dir).filter((f) => /^ScrollTrigger-.*\.js$/.test(f))
      : [];
    if (!files.length) return null;
    const names = new Set();
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/requestAnimationFrame\(\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
        names.add(m[1]);
      }
    }
    return [...names];
  })();

  const installRafProbe = () =>
    evalJs(String.raw`(() => {
      if (window.__rafProbed) return true;
      window.__rafProbed = true;
      window.__nativeRaf = window.requestAnimationFrame.bind(window);
      window.__thirdParty = ${JSON.stringify(gsapRafNames)};
      window.__fires = 0;
      window.__thirdFires = 0;
      window.requestAnimationFrame = function (cb) {
        return window.__nativeRaf(function (arg) {
          const name = typeof cb === 'function' ? cb.name || '' : '';
          if (window.__thirdParty.indexOf(name) > -1) window.__thirdFires++;
          else window.__fires++;
          return cb(arg);
        });
      };
      return true;
    })()`);
  if (!gsapRafNames) {
    check('Chunk ScrollTrigger ada (dasar pemisahan loop pihak ketiga)', false,
      'tidak ada dist/assets/ScrollTrigger-*.js - jalankan build lebih dulu');
  }
  await installRafProbe();

  // Tunggu scene benar-benar siap: canvas di-setSize DAN fade-in selesai.
  let heroReady = false;
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    const st = await evalJs(String.raw`(() => {
      const cv = document.querySelector('.hero-section canvas');
      if (!cv) return 'no-canvas';
      if (cv.width < 1000) return 'unsized';
      if (Number(getComputedStyle(cv).opacity) < 0.95) return 'fading';
      return 'ready';
    })()`);
    if (st === 'ready') { heroReady = true; break; }
  }
  check('Scene partikel hero siap (canvas ter-size + fade-in selesai)', heroReady);

  const measure = async (ms) =>
    JSON.parse(
      await evalJs(String.raw`(async () => {
        window.__fires = 0;
        window.__thirdFires = 0;
        const t0 = performance.now();
        await new Promise((done) => {
          const step = () => {
            if (performance.now() - t0 >= ${ms}) return done();
            window.__nativeRaf(step);
          };
          window.__nativeRaf(step);
        });
        const dt = (performance.now() - t0) / 1000;
        return JSON.stringify({
          fps: +(window.__fires / dt).toFixed(1),
          third: +(window.__thirdFires / dt).toFixed(1),
          seconds: +(dt).toFixed(2),
        });
      })()`),
    );

  const heroFps = await measure(2000);
  check('FPS partikel hero ~60', heroFps.fps > 50 && heroFps.fps < 75,
    heroFps.fps + ' fps selama ' + heroFps.seconds + 's');

  /*
   * Dua canvas ini TIDAK PERNAH hidup bersamaan, dan itu disengaja.
   *
   * Aturan main: partikel hero berhenti saat hero keluar rootMargin -20%, dan
   * giroskop Aturan baru mount saat section-nya masuk 20% dari atas viewport.
   * Jarak antara keduanya di layout sekitar 3000px, jauh lebih besar dari
   * rentang tumpang-tindih itu - jadi tidak ada posisi scroll yang membuat
   * keduanya hidup bersamaan, dan tidak mungkin ada dua loop WebGL yang saling
   * berebut GPU.
   *
   * Ini diperiksa, bukan diasumsikan. Kalau suatu saat tata letaknya berubah
   * sehingga keduanya bisa hidup bersamaan, cek ini gagal, dan saat itu diketahui
   * bahwa ada biaya dua context WebGL yang harus diukur ulang.
   */
  const gap = JSON.parse(
    await evalJs(String.raw`(() => {
      const hero = document.querySelector('.hero-section');
      const gyro = document.querySelector('.rules-gyro');
      if (!hero || !gyro) return JSON.stringify({ error: 'elemen tidak ditemukan' });
      return JSON.stringify({
        heroBottom: Math.round(hero.getBoundingClientRect().bottom + window.scrollY),
        gyroTop: Math.round(gyro.getBoundingClientRect().top + window.scrollY),
        vh: window.innerHeight,
      });
    })()`),
  );
  const overlapWindow = gap.heroBottom + gap.vh * 0.2 - (gap.gyroTop - gap.vh * 0.2);
  check('Partikel hero dan giroskop Aturan tidak pernah hidup bersamaan',
    overlapWindow < 0,
    'jarak=' + (gap.gyroTop - gap.heroBottom) + 'px, rentang tumpang-tindih=' + Math.round(overlapWindow) + 'px');

  // Ukur FPS giroskop sendirian, di posisi section Aturan terlihat.
  await evalJs(`(() => {
    const g = document.querySelector('.rules-gyro');
    if (g) window.scrollTo(0, g.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.4);
    return true;
  })()`);
  await sleep(2500);
  const gyroMounted = await evalJs(
    "!!document.querySelector('.rules-gyro canvas') && document.querySelector('.rules-gyro canvas').width > 100",
  );
  check('Giroskop Aturan mount saat section mendekati viewport', gyroMounted);

  /*
   * Tepat satu kanvas per slot 3D.
   *
   * Guard ini ada karena kesalahan yang sangat mudah terjadi dan sama sekali
   * tak terlihat: satu `<GyroCanvas>` yang terduplikasi di JSX akan menggambar
   * dua cincin di tempat yang sama (identik secara visual), menjalankan dua
   * loop rAF, dan mengikat dua context WebGL untuk satu dekorasi. Semua cek
   * geometri tetap hijau karena yang diukur cuma posisi, dan FPS naik 2x - yang
   * terlihat sebagai "loop-nya lebih lancar", bukan sebagai bug.
   */
  const canvasCount = JSON.parse(await evalJs(String.raw`(() => {
    return JSON.stringify({
      gyroWrappers: document.querySelectorAll('.rules-gyro').length,
      gyroCanvas: document.querySelectorAll('.rules-gyro canvas').length,
      heroCanvas: document.querySelectorAll('.hero-section canvas').length,
    });
  })()`));
  check('Tepat satu kanvas per slot 3D (tidak ada kanvas ganda)',
    canvasCount.gyroWrappers === 1 && canvasCount.gyroCanvas === 1 && canvasCount.heroCanvas === 1,
    'wrapper gyro=' + canvasCount.gyroWrappers + ', canvas gyro=' + canvasCount.gyroCanvas +
      ', canvas hero=' + canvasCount.heroCanvas);
  const gyroFps = await measure(2000);
  check('FPS giroskop Aturan ~60', gyroFps.fps > 50 && gyroFps.fps < 75,
    gyroFps.fps + ' fps selama ' + gyroFps.seconds + 's');

  /*
   * REGRESI: armillary yang hilang sendiri.
   *
   * `dispose()` di three/gyroscope.ts memanggil `renderer.forceContextLoss()`.
   * Itu MEMBUNUH context pada elemen canvas itu untuk selamanya - bukan
   * menandainya "bisa dipulihkan". Kalau scene dibangun ulang di canvas yang
   * sama, `canvas.getContext()` mengembalikan context yang sudah mati: scene
   * berjalan, tidak ada exception, tidak ada warning, tapi tidak satu piksel
   * pun tergambar karena tidak ada yang menerima perintah gambar.
   *
   * Urutan yang memunculkan gejala "kadang muncul, kadang hilang", terutama
   * setelah klik navbar Aturan:
   *   1. Buka di atas: section belum terlihat, belum ada scene.
   *   2. Klik navbar Aturan: scene dibuat, cincin terlihat.
   *   3. Scroll lewat ke bawah: context dibunuh.
   *   4. Klik navbar Aturan lagi: scene baru di canvas mati -> cincin hilang
   *      untuk selamanya sampai halaman dimuat ulang.
   *
   * Yang diuji di sini persis langkah 2 -> 3 -> 2. Framebuffer dibaca beneran
   * lewat drawImage + getImageData (screenshot headless tidak berisi layer
   * WebGL), dan identitas elemen canvas ikut diperiksa: canvas yang kembali
   * haruslah elemen BERBEDA, karena itu satu-satunya cara mendapat context
   * yang masih hidup.
   */
  const gyroReentry = JSON.parse(
    await evalJs(String.raw`(async () => {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));

      const sample = () => {
        const cv = document.querySelector('.rules-gyro canvas');
        if (!cv || !cv.width) return { lit: 0, ratio: 0, has: false, fresh: true };
        const s = document.createElement('canvas');
        s.width = cv.width;
        s.height = cv.height;
        const ctx = s.getContext('2d');
        ctx.drawImage(cv, 0, 0);
        const d = ctx.getImageData(0, 0, s.width, s.height).data;
        let lit = 0, total = 0;
        for (let y = 0; y < s.height; y += 2) {
          for (let x = 0; x < s.width; x += 2) {
            const i = (y * s.width + x) * 4;
            total++;
            if (d[i + 3] < 8) continue;
            const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            if (luma < 18) continue;
            if (d[i] - d[i + 2] < 18) continue; // harus keemasan, bukan putih/abu
            lit++;
          }
        }
        return {
          lit,
          ratio: +(lit / Math.max(1, total)).toFixed(4),
          has: true,
          // Canvas lama ditandai di langkah pertama; hasil kembali harus tanpa
          // tanda itu, artinya elemennya benar-benar baru.
          fresh: !cv.dataset.probe,
        };
      };

      const box = document.querySelector('.rules-gyro');
      if (!box) return JSON.stringify({ error: '.rules-gyro tidak ada' });
      const top = box.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35;

      // Langkah 2: masuk section, scene dibangun.
      window.scrollTo(0, top);
      await wait(2500);
      const first = sample();
      const firstCanvas = document.querySelector('.rules-gyro canvas');
      if (firstCanvas) firstCanvas.dataset.probe = '1';

      // Langkah 3: tinggalkan section jauh, sampai context benar-benar dilepas.
      window.scrollTo(0, top + window.innerHeight * 3);
      await wait(2000);
      const away = sample();

      // Langkah 2 lagi: masuk kembali ke section yang sama.
      window.scrollTo(0, top);
      await wait(2500);
      const second = sample();

      return JSON.stringify({
        first, away, second,
        sameElement: firstCanvas === document.querySelector('.rules-gyro canvas'),
      });
    })()`),
  );
  check('Giroskop Aturan menggambar emas saat section terlihat',
    gyroReentry.first?.has && gyroReentry.first.ratio > 0.01,
    'cakupan=' + (gyroReentry.first?.ratio ?? 0) + ' lit=' + (gyroReentry.first?.lit ?? 0));
  check('Giroskop Aturan dilepas saat section jauh dari viewport',
    gyroReentry.away?.has === false || gyroReentry.away.ratio === 0,
    'lit=' + (gyroReentry.away?.lit ?? 0));
  check('Giroskop Aturan MASIH muncul setelah keluar-masuk section (context di-roll ulang)',
    gyroReentry.second?.has && gyroReentry.second.ratio > 0.01,
    'cakupan=' + (gyroReentry.second?.ratio ?? 0) + ' lit=' + (gyroReentry.second?.lit ?? 0));
  check('Kanvas gyro diganti elemen baru saat context dilepas (bukan context mati yang dipakai lagi)',
    gyroReentry.sameElement === false,
    gyroReentry.sameElement ? 'MASIH ELEMEN YANG SAMA' : 'elemen baru');

  /*
   * REGRESI: "klik navbar Aturan, 3D objectnya malah hilang".
   *
   * Skenario di atas memakai `window.scrollTo` untuk membuka section. Yang
   * dikeluhkan user berbeda: klik LINK NAVBAR, yang memicu handler anchor
   * `useSmoothScroll` - posisinya diinterpolasi beribu-ribu milidetik, bukan
   * dilompat sekali. Di tengah interpolasi itu posisi scroll berubah tiap
   * bingkai, dan itu bisa membuat siklus hidup scene gyro terputus (mount
   * lalu langsung dilepas) tanpa pernah sampai ke kondisi "stabil".
   *
   * Karena itu di sini yang diklik adalah link aslinya, dan yang diperiksa
   * bukan scroll-nya melainkan framebuffer-nya: setelah animasi selesai, harus
   * ada emas tergambar. Dua putaran, karena putaran kedua adalah yang memakai
   * ulang path "context sudah pernah dibunuh".
   */
  const gyroNavClick = JSON.parse(
    await evalJs(String.raw`(async () => {
      const raf = () => new Promise(r => requestAnimationFrame(r));
      const wait = async (n) => { for (let i = 0; i < n; i++) await raf(); };

      const sample = () => {
        const cv = document.querySelector('.rules-gyro canvas');
        if (!cv || !cv.width) return { lit: 0, ratio: 0, has: false };
        const s = document.createElement('canvas');
        s.width = cv.width;
        s.height = cv.height;
        const ctx = s.getContext('2d');
        ctx.drawImage(cv, 0, 0);
        const d = ctx.getImageData(0, 0, s.width, s.height).data;
        let lit = 0, total = 0;
        for (let y = 0; y < s.height; y += 2) {
          for (let x = 0; x < s.width; x += 2) {
            const i = (y * s.width + x) * 4;
            total++;
            if (d[i + 3] < 8) continue;
            const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            if (luma < 18 || d[i] - d[i + 2] < 18) continue;
            lit++;
          }
        }
        return { lit, ratio: +(lit / Math.max(1, total)).toFixed(4), has: true };
      };

      const link = Array.from(document.querySelectorAll('a[href^="#"]'))
        .find((a) => a.getAttribute('href') === '#aturan');
      if (!link) return JSON.stringify({ error: 'link navbar #aturan tidak ada' });

      // Selalu mulai dari atas, supaya diaper diulang persis.
      window.scrollTo(0, 0);
      await wait(30);

      // Putaran 1: dari atas ke Aturan lewat navbar.
      link.click();
      await wait(150);
      const first = sample();
      // Putaran 2: turun jauh dulu (context dibunuh), lalu klik navbar lagi.
      window.scrollTo(0, document.documentElement.scrollHeight);
      await wait(60);
      const away = sample();
      window.scrollTo(0, 0);
      await wait(30);
      link.click();
      await wait(150);
      const second = sample();

      const rect = document.querySelector('#aturan').getBoundingClientRect();
      return JSON.stringify({
        first, away, second,
        sectionTopAfter: Math.round(rect.top),
        arrived: Math.abs(rect.top - 88) < 3,
      });
    })()`),
  );
  check('Klik navbar Aturan: section benar-benar sampai di posisi jeda',
    gyroNavClick.arrived === true,
    'top=' + gyroNavClick.sectionTopAfter + 'px (target 88px)');
  check('Klik navbar Aturan: armillary TETAP menggambar setelah lompat',
    gyroNavClick.first?.has && gyroNavClick.first.ratio > 0.01,
    'cakupan=' + (gyroNavClick.first?.ratio ?? 0) + ' lit=' + (gyroNavClick.first?.lit ?? 0));
  check('Klik navbar Aturan kedua: armillary masih menggambar (context di-roll ulang)',
    gyroNavClick.second?.has && gyroNavClick.second.ratio > 0.01,
    'cakupan=' + (gyroNavClick.second?.ratio ?? 0) + ' lit=' + (gyroNavClick.second?.lit ?? 0));

  /*
   * REGRESI: "halamannya bergetar ke atas bawah, kayak seret".
   *
   * Dua penyebab yang berbeda, dan keduanya harus hilang:
   *
   *  1. `onScroll` salah membaca echo dari tulisannya sendiri sebagai "scroll
   *     dari luar", sehingga loop dimatikan dan dinyalakan lagi. Gejalanya:
   *     bingkai diam, bingkai melompat, berulang.
   *  2. `deltaRatio` GSAP yang melonjak saat satu bingkai jatuh, diklem longgar
   *     (8). Satu bingkai bisa mengerjakan 57% dari sisa jarak, padahal
   *     bingkai-bingkai sebelumnya cuma handful piksel. Gejalanya: satu
   *     lompatan besar di tengah gerakan yang mestinya lancar.
   *
   * Yang diukur: jarak per bingkai selama input aktif saja, bukan sesudahnya.
   * Yang dicari bukan "halus" secara subjectif, tapi tiga angka keras: tidak boleh
   * ada bingkai yang bergerak MUNDUR saat user sedang menggulir ke bawah, tidak
   * boleh ada jeda beku panjang (loop yang mati-mati), dan selisih antar-bingkai
   * berturut-turut harus jauh lebih kecil daripada langkah terjauh. Kalau gerakan
   * mulus, perbandingan terakhir itu mendekati 1; kalau melompat-lompat,
   * selisihnya lebih besar daripada langkah terkecilnya sendiri.
   */
  const jitter = JSON.parse(
    await evalJs(String.raw`(async () => {
      const raf = () => new Promise(r => requestAnimationFrame(r));
      window.scrollTo(0, 0);
      for (let i = 0; i < 30; i++) await raf();

      const samples = [];
      let running = true;
      (async () => {
        let last = window.scrollY;
        while (running) {
          await raf();
          const y = window.scrollY;
          samples.push(y - last);
          last = y;
        }
      })();

      // 70 putaran wheel @120px, tapi DIBAHASI: berhenti begitu halaman sudah
      // lewat 55% panjang scroll-nya. Setelah sampai dasar dokumen tidak ada
      // lagi jarak tersisa, jadi halaman memang tidak bergerak - itu benar,
      // bukan getaran. Mengukur di sana akan melaporkan jeda beku 40+ bingkai
      // yang seluruhnya artefak pengukuran, bukan cacat smooth scroll.
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const stopAt = maxScroll * 0.55;
      for (let i = 0; i < 70; i++) {
        if (window.scrollY >= stopAt) break;
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
        await raf();
        await raf();
      }
      // Rekam langsung berhenti begitu input wheel berhenti. Bingkai setelah ini
      // halaman memang tidak lagi bergerak - smooth scroll sudah mengejar target
      // dan kekurangannya tinggal < 0.1px, jadi snapshot itu sudah tidak bergerak
      // dengan sendirinya. Kalau ikut direkam, jeda beku sepanjang fase settle
      // akan dilaporkan sebagai "loop mati-mati" padahal tidak ada apa-apa salah.
      running = false;
      await raf();

      const moves = samples.filter((d) => d !== 0).map(Math.abs);
      let maxJump = 0;
      for (let i = 1; i < moves.length; i++) maxJump = Math.max(maxJump, Math.abs(moves[i] - moves[i - 1]));
      let stall = 0, cur = 0;
      for (const d of samples) { if (d === 0) { cur++; stall = Math.max(stall, cur); } else cur = 0; }
      return JSON.stringify({
        backward: samples.filter((d) => d < 0).length,
        maxDelta: Math.round(Math.max(...moves)),
        maxJump: Math.round(maxJump),
        maxStall: stall,
        movedFrames: moves.length,
        totalFrames: samples.length,
      });
    })()`),
  );
  check('Tidak ada scroll yang bergerak MUNDUR saat digulir ke bawah (tanda bergantian)',
    jitter.backward === 0,
    jitter.backward + ' bingkai mundur');
  check('Tidak ada bingkai yang beku > 12 bingkai saat sedang digulir (tanda loop mati-mati)',
    jitter.maxStall <= 12,
    'jeda terpanjang ' + jitter.maxStall + ' bingkai');
  check('Selisih antar-bingkai << langkah terjauh (tanda gerakan mulus, bukan melompat)',
    jitter.maxJump <= jitter.maxDelta * 0.75,
    'lompatan antar-bingkai ' + jitter.maxJump + 'px vs langkah terjauh ' + jitter.maxDelta + 'px');
  // Batasnya dikunci ke tinggi viewport yang dipakai blok ini (1440x900),
  // sama seperti blok gyro di bawah. Hardcode disengaja: angka yang ikut
  // ikut berubah kalau viewport ikut berubah akan berhenti jadi penjaga.
  check('Langkah satu bingkai tidak melebihi 40% tinggi viewport (900px)',
    jitter.maxDelta <= 360,
    'terlompat ' + jitter.maxDelta + 'px per bingkai (batas 360px)');

  /*
   * SCROLL LOCK "CARA IKUT".
   *
   * Syarat yang diminta: begitu masuk section ini halaman tertahan di sini,
   * scroll terus sampai garisnya penuh ke kanan, dan BARU setelah itu scroll
   * ke bawah boleh lanjut.
   *
   * Diuji dengan kecepatan scroll yang realistis (satu putaran wheel per 6
   * bingkai), bukan robot yang menggebut - kecepatan robot melewati detail
   * yang tidak pernah dilihat user.
   *
   * Yang diperiksa, semuanya perilaku yang bisa gagal diam-diam:
   *   1. Section benar-benar `position: fixed` saat terkunci, dan `top: 0`.
   *   2. Runway scroll yang terpakai ≈ 2 tinggi viewport (dengan toleransi),
   *      bukan 0 (langsung lepas) dan bukan tak terbatas (tidak pernah lepas).
   *   3. Garis terisi penuh tepat saat pin dilepas - ini syarat intinya.
   *   4. Garis tidak pernah mundur, dan keempat node pernah menyala.
   *   5. Tidak ada bingkai beku saat terkunci: halaman harus tetap bergerak
   *      mengikuti wheel, kalau tidak terasa macet, bukan terkunci.
   */
  await evalJs(`(() => {
    const s = document.getElementById('cara-ikut');
    if (s) window.scrollTo(0, Math.max(0, s.getBoundingClientRect().top + window.scrollY - window.innerHeight * 1.5));
    return true;
  })()`);
  await sleep(1200);
  const lock = JSON.parse(
    await evalJs(String.raw`(async () => {
      const raf = () => new Promise(r => requestAnimationFrame(r));
      const sec = document.getElementById('cara-ikut');
      const fill = sec.querySelector('.timeline-progress-fill');
      if (!fill) return JSON.stringify({ error: '.timeline-progress-fill tidak ada' });
      const vh = window.innerHeight;

      const rows = [];
      for (let i = 0; i < 300; i++) {
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: 38, bubbles: true, cancelable: true }));
        await raf();
        const r = sec.getBoundingClientRect();
        const m = /scaleX\(([\d.]+)\)/.exec(fill.style.transform);
        rows.push({
          y: window.scrollY,
          top: r.top,
          pos: getComputedStyle(sec).position,
          fill: m ? Number(m[1]) : null,
          nodes: sec.querySelectorAll('.step-node.is-done').length,
        });
        for (let k = 0; k < 5; k++) await raf();
      }

      const pinned = rows.filter((r) => r.pos === 'fixed');
      let release = null, lastPinned = null;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i - 1].pos === 'fixed' && rows[i].pos !== 'fixed') { release = rows[i]; break; }
      }
      for (const r of rows) if (r.pos === 'fixed') lastPinned = r;

      let stall = 0, cur = 0;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].pos !== 'fixed') { cur = 0; continue; }
        if (rows[i].y === (rows[i - 1] || {}).y) cur++; else cur = 0;
        stall = Math.max(stall, cur);
      }

      let prev = -1, monotonic = true;
      for (const r of rows) {
        if (r.fill === null) continue;
        if (r.fill < prev - 0.001) monotonic = false;
        prev = r.fill;
      }

      return JSON.stringify({
        vh,
        pinnedFrames: pinned.length,
        anyFixedAtTop0: pinned.some((r) => Math.abs(r.top) < 2),
        runwayConfigured: vh * 2,
        runwayUsed: release && pinned[0] ? Math.round(release.y - pinned[0].y) : null,
        fillAtRelease: release?.fill ?? null,
        monotonic,
        maxNodes: Math.max(...rows.map((r) => r.nodes)),
        stallWhilePinned: stall,
        fillReachedFull: rows.some((r) => r.fill !== null && r.fill >= 0.999),
      });
    })()`),
  );
  check('Cara Ikut terkunci: section di-pin (position: fixed) tepat di top: 0',
    lock.error ?? (lock.anyFixedAtTop0 === true && lock.pinnedFrames > 5),
    lock.error ?? (lock.pinnedFrames + ' bingkai ter-pin'));
  check('Cara Ikut: run-way scroll ± 2 tinggi viewport (ada ruang untuk mengisi garis)',
    lock.error ?? (lock.runwayUsed !== null && Math.abs(lock.runwayUsed - lock.runwayConfigured) / lock.runwayConfigured < 0.25),
    lock.error ?? ('runway dipakai ' + lock.runwayUsed + 'px dari ' + lock.runwayConfigured + 'px'));
  check('Cara Ikut: garis TERISI PENUH tepat saat halaman dilepas',
    lock.error ?? (lock.fillAtRelease !== null && lock.fillAtRelease >= 0.999),
    lock.error ?? ('isi=' + lock.fillAtRelease + ' saat dilepas'));
  check('Cara Ikut: garis tidak pernah mundur saat mengisi',
    lock.error ?? lock.monotonic === true,
    lock.error ?? (lock.monotonic ? 'monotonik' : 'ADA MUNDUR'));
  check('Cara Ikut: keempat node langkah menyala saat garis penuh',
    lock.error ?? lock.maxNodes === 4,
    lock.error ?? ('node menyala maks ' + lock.maxNodes));
  check('Cara Ikut: halaman tetap bergerak saat terkunci (tidak beku)',
    lock.error ?? lock.stallWhilePinned <= 2,
    lock.error ?? ('bingkai beku ' + lock.stallWhilePinned + ' saat terkunci'));

  /*
   * Anchor yang MELOMPATI section ter-pin.
   *
   * `pin: true` menulis ulang geometri dokumen: section yang di-pin ditarik dari
   * flow dan tinggi aslinya pindah ke `pin-spacer`. Handler anchor di
   * `useSmoothScroll` menghitung target dari `rect.top` elemen tujuan, jadi kalau
   * geometri itu tidak terbaca dengan benar, lompatan anchor akan mendarat di
   * posisi yang salah - dan karena bug-nya diam, ia tidak melempar error apa pun.
   *
   * Yang diuji persis kasus nyata di navbar: "FAQ" ada SETELAH "Cara Ikut", jadi
   * lompatannya harus menembus runway sepanjang 2 tinggi viewport.
   */
  const jumpPastPin = JSON.parse(
    await evalJs(String.raw`(async () => {
      const raf = () => new Promise(r => requestAnimationFrame(r));
      const link = document.querySelector('a[href="#faq"]');
      if (!link) return JSON.stringify({ error: 'link navbar #faq tidak ada' });
      window.scrollTo(0, 0);
      for (let i = 0; i < 40; i++) await raf();
      link.click();
      // Tunggu sampai halaman benar-benar diam: handler anchor menulis target
      // sekali, lalu ticker GSAP mengejar sampai sisa < 0.1px dan berhenti.
      let stable = 0;
      let before = window.scrollY;
      for (let i = 0; i < 400 && stable < 25; i++) {
        await raf();
        stable = window.scrollY === before ? stable + 1 : 0;
        before = window.scrollY;
      }
      const r = document.getElementById('faq').getBoundingClientRect();
      return JSON.stringify({ top: Math.round(r.top), stable });
    })()`),
  );
  check('Anchor navbar yang melewati section terkunci tetap mendarat di posisinya',
    jumpPastPin.error ?? Math.abs(jumpPastPin.top - 88) <= 3,
    jumpPastPin.error ?? ('#faq top=' + jumpPastPin.top + 'px, target 88px'));

  /*
   * GEOMETRI KOTAK KANVAS, diukur dari framebuffer sungguhan.
   *
   * Dua aturan yang dipegang section ini, dan keduanya bisa dilanggar tanpa
   * error sama sekali - hanya tampilannya yang salah:
   *
   *  1. SELURUH armillary harus muat di dalam kotak kanvas, dengan ruang
   *     kosong di keempat sisi. Cincinnya bulat, sedangkan kamera perspektif
   *     memakai fov vertikal, jadi pada fov tetap dan kotak yang tidak persegi
   *     bagian atas/bawah cincin keluar dari kanvas - hanya dua busur tipis
   *     yang tersisa, yang sering disalahartikan sebagai "objeknya hilang".
   *
   *     Dulu syarat ini diperiksa lewat bentuk kotaknya (kotak wajib persegi).
   *     Sekarang bentuk kotak bukan lagi syaratnya: `three/gyroscope.ts`
   *     memilih JARAK KAMERA supaya armillary muat di kedua sumbu pada aspect
   *     berapa pun. Yang diukur di sini karena itu bukan bentuk kotak, tapi
   *     hasil akhirnya - kotak piksel emas yang benar-benar tergambar.
   *  2. Cincin tidak boleh menutupi daftar aturan. Yang diukur adalah posisi
   *     PIXEL EMAS yang benar-benar tergambar, bukan kotak canvas-nya: cincin
   *     tidak mengisi seluruh kotaknya, jadi boxes overlap yang wajar pun
   *     tidak apa-apa selama tidak ada satu pun pixel emas di area teks.
   *
   * Diuji di tiga lebar karena ruang kosong di kanan kolom konten menyempit
   * seiring layar mengecil, sementara daftar aturan (max 65ch) lebarnya tetap.
   */
  for (const w of [1440, 1280, 1024]) {
    await setViewport(w, 900, false);
    await goto();
    await sleep(3200);
    const geo = JSON.parse(
      await evalJs(String.raw`(async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const box = document.querySelector('.rules-gyro');
        if (!box) return JSON.stringify({ error: '.rules-gyro tidak ada' });
        window.scrollTo(0, box.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35);
        await wait(2600);

        const cv = document.querySelector('.rules-gyro canvas');
        if (!cv || !cv.width) return JSON.stringify({ error: 'canvas tidak ada' });
        const s = document.createElement('canvas');
        s.width = cv.width;
        s.height = cv.height;
        const ctx = s.getContext('2d');
        ctx.drawImage(cv, 0, 0);
        const d = ctx.getImageData(0, 0, s.width, s.height).data;

        let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
        for (let y = 0; y < s.height; y++) {
          for (let x = 0; x < s.width; x++) {
            const i = (y * s.width + x) * 4;
            if (d[i + 3] < 8) continue;
            const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            if (luma < 18 || d[i] - d[i + 2] < 18) continue;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        if (maxX < 0) return JSON.stringify({ error: 'tidak ada emas tergambar' });

        const r = cv.getBoundingClientRect();
        const k = r.width / s.width;
        const ol = document.querySelector('#aturan ol').getBoundingClientRect();
        const head = document.querySelector('#aturan .section-head').getBoundingClientRect();
        return JSON.stringify({
          box: [Math.round(r.width), Math.round(r.height)],
          ring: [
            Math.round(r.left + minX * k), Math.round(r.top + minY * k),
            Math.round(r.left + maxX * k), Math.round(r.top + maxY * k),
          ],
          canvas: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
          list: [Math.round(ol.left), Math.round(ol.top), Math.round(ol.right), Math.round(ol.bottom)],
          head: [Math.round(head.left), Math.round(head.top), Math.round(head.right), Math.round(head.bottom)],
          vw: window.innerWidth,
        });
      })()`),
    );
    // Jarak-terkecil dari kotak emas ke tepi kanvas. Kalau armillary terpotong,
    // sisi mana pun yang memotong akan bernilai 0 atau negatif.
    const fitMargin = geo.error
      ? -1
      : Math.min(
          geo.ring[0] - geo.canvas[0],
          geo.canvas[2] - geo.ring[2],
          geo.ring[1] - geo.canvas[1],
          geo.canvas[3] - geo.ring[3],
        );
    // Tabrakan tegak lurus, bukan sekadar "yang kiri lebih besar": cincin
    // berada di kanan DAN di bawah daftar, jadi satu perbandingan sumbu saja
    // bisa lolos padahal kedua kotaknya saling tumpang tindih.
    const overlapX = Math.min(geo.ring?.[2] ?? 0, geo.list?.[2] ?? 0) - Math.max(geo.ring?.[0] ?? 0, geo.list?.[0] ?? 0);
    const overlapY = Math.min(geo.ring?.[3] ?? 0, geo.list?.[3] ?? 0) - Math.max(geo.ring?.[1] ?? 0, geo.list?.[1] ?? 0);
    const headX = Math.min(geo.ring?.[2] ?? 0, geo.head?.[2] ?? 0) - Math.max(geo.ring?.[0] ?? 0, geo.head?.[0] ?? 0);
    const headY = Math.min(geo.ring?.[3] ?? 0, geo.head?.[3] ?? 0) - Math.max(geo.ring?.[1] ?? 0, geo.head?.[1] ?? 0);
    const overlapList = overlapX > 0 && overlapY > 0;
    const overlapHead = headX > 0 && headY > 0;
    check('Seluruh armillary muat di kanvas @' + w + 'px (tidak terpotong atas/bawah)',
      !geo.error && fitMargin >= 3,
      geo.error ?? ('ruang tepi ' + Math.round(fitMargin) + 'px pada kanvas ' + geo.box[0] + 'x' + geo.box[1]));
    check('Cincin gyro tidak menutupi daftar aturan @' + w + 'px',
      !geo.error && !overlapList,
      geo.error ?? ('cincin x=' + geo.ring[0] + '-' + geo.ring[2] + ', teks x=' + geo.list[0] + '-' + geo.list[2]));
    check('Cincin gyro tidak menutupi header section @' + w + 'px',
      !geo.error && !overlapHead,
      geo.error ?? ('cincin y=' + geo.ring[1] + '-' + geo.ring[3] + ', header y=' + geo.head[1] + '-' + geo.head[3]));
  }
  await setViewport(1440, 900, false);
  await goto();
  await sleep(2500);
  // Dokumen baru: probe rAF perlu dipasang ulang di sini, bukan di blok atas.
  await installRafProbe();

  /*
   * Syarat "render loop benar-benar berhenti". Diuji dengan MELIHAT APAKAH ADA,
   * bukan dengan menebak dari pixel: kalau tidak ada satu pun callback rAF
   * yang menyala selama 2 detik di posisi scroll jauh, tidak ada yang sedang
   * menggambar, menghitung, atau berinterpolasi.
   *
   * Penting: jeda dulu sebelum mengukur. Tepat setelah lompatan scroll masih
   * ada sisa-sisa pekerjaan (IntersectionObserver, transisi, sinkronisasi
   * smooth scroll) yang belum selesai, jadi jendela yang diukur terlalu awal
   * akan melaporkan loop yang "masih hidup" padahal itu sisa transien. Jeda
   * 4 detik membuat yang diukur adalah keadaan tunak, yaitu yang sebenarnya
   * ingin dibuktikan.
   */
  const maxY = await evalJs('document.documentElement.scrollHeight - window.innerHeight');
  await evalJs(`window.scrollTo(0, ${maxY}); true`);
  await sleep(4000);
  const far = await measure(2000);
  check('Render loop TOTAL berhenti saat semua section 3D jauh dari viewport',
    far.fps === 0, far.fps + ' callback rAF gambar dalam ' + far.seconds + 's (harus 0)');

  /*
   * Pagar untuk pemisahan loop pihak ketiga di `installRafProbe`.
   *
   * ScrollTrigger memang dibiarkan lewat, tapi itu harus terlihat dan
   * terukur, bukan jadi pintu selembut yang menutupi loop lain. Kalau rAF yang
   * tersisa ternyata bukan milik ScrollTrigger, atau kalau rATE-nya di luar
   * rentang yang masuk akal untuk ticker + penjaga scrollEnd, cek "0 fps" di
   * atas tidak bisa dipercaya - jadi pagar itu diuji sendiri.
   */
  check('rAF yang tersisa saat idle adalah milik ScrollTrigger (ticker + penjaga scrollEnd)',
    far.third >= 55 && far.third <= 70,
    far.third + ' callback ScrollTrigger/s (baseline: ticker ~60/s)');

  // Dan harus hidup lagi saat kembali ke atas: loop yang berhenti total tapi
  // tidak bisa dinyalakan ulang sama hal dengan loop yang mati.
  await evalJs('window.scrollTo(0, 0); true');
  await sleep(2500);
  const backTop = await measure(2000);
  check('Render loop hidup lagi setelah kembali ke atas',
    backTop.fps > 50, backTop.fps + ' fps');
}

console.log('\n=== B16. KURSOR: INTERPOLASI BERHENTI, BUKAN BERPUTAR TERUS ===');
{
  /*
   * Cincin kursor harus mengejar dot, lalu BERHENTI begitu menyatu.
   *
   * Cara mengukurnya di sini, bukan di atas: posisi scroll yang dipakai adalah
   * posisi dengan nol loop lain. Di atas, partikel hero berjalan 60 fps, jadi
   * hitungan rAF total selalu ~60 apa pun yang dilakukan kursor - dan cek seperti
   * itu tidak bisa membedakan "kursor ikut berhenti" dari "kursor jalan terus di
   * tengah 60 fps lain". Di posisi scroll jauh tidak ada loop lain, sehingga
   * satu-satunya rAF yang bisa muncul adalah milik kursor.
   *
   * Dua jendela berurutan diuji, karena itu satu-satunya cara membuktikan loop
   * itu benar-benar hidup lalu benar-benar berhenti: satu cek "diam" saja akan
   * lulus bahkan kalau cincinnya tidak pernah bergerak sama sekali.
   *
   * `count` di sini memakai hitungan yang sama dengan blok B15, jadi penjadwal
   * menganggur ScrollTrigger ikut dikecualikan. Kalau tidak dikecualikan, cek
   * ini tidak akan pernah bisa lulus - bukan karena kursorya berjalan terus,
   * tapi karena ScrollTrigger selalu punya rAF-nya sendiri.
   */
  const maxY = await evalJs('document.documentElement.scrollHeight - window.innerHeight');
  await evalJs(`window.scrollTo(0, ${maxY}); true`);
  await sleep(4000);

  /*
   * Probe rAF dipasang satu kali per dokumen (lihat `installRafProbe` di blok
   * B15), jadi blok ini cukup memakainya apa adanya dan tidak memasang ulang.
   * Memasangnya lagi di dokumen yang sama akan rekursif: wrapper yang lebih
   * lama memanggil `window.__nativeRaf` secara dinamis, jadi begitu properti
   * itu ditimpa wrapper yang lebih baru, wrapper lama memanggil dirinya sendiri.
   * Karena wrapper yang terpasang sudah menghitung ke `window.__fires`, blok ini
   * cukup memakainya apa adanya.
   */
  const count = async (ms) =>
    JSON.parse(
      await evalJs(String.raw`(async () => {
        window.__fires = 0;
        const t0 = performance.now();
        await new Promise((done) => {
          const step = () => {
            if (performance.now() - t0 >= ${ms}) return done();
            window.__nativeRaf(step);
          };
          window.__nativeRaf(step);
        });
        const dt = (performance.now() - t0) / 1000;
        return JSON.stringify({ fps: +(window.__fires / dt).toFixed(1), seconds: +dt.toFixed(2) });
      })()`),
    );

  await evalJs(String.raw`(() => {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 300, clientY: 200 }));
    return true;
  })()`);
  const moving = await count(400);
  check('Interpolasi cincin kursor AKTIF saat pointer bergerak',
    moving.fps > 20, moving.fps + ' fps');

  // Beri waktu cincin menyatu dengan dot (DUR.cursorTau ~0.4s, plus lerp).
  await sleep(2000);
  const settled = await count(1500);
  check('Interpolasi cincin kursor BERHENTI total setelah menyatu',
    settled.fps === 0,
    settled.fps + ' callback rAF dalam ' + settled.seconds + 's (harus 0)');
}

console.log('\n=== B17. SMOOTH SCROLL: HANYA ADA SATU PENULIS SCROLL ===');
{
  /*
   * Regresi: halaman "bergetar ke atas bawah" seperti seret.
   *
   * Penyebabnya bukan interpolasinya, tapi DUA pihak yang menulis posisi scroll
   * sekaligus:
   *
   *   1. Listener `wheel` dipasang PASSIVE, jadi browser tetap menjalankan
   *      scroll native-nya (lompat `deltaY` seketika) sementara ticker
   *      menarik dari posisi yang belum tersentuh. Scroll ke bawah disusul
   *      tarikan ke atas, berulang.
   *   2. `html { scroll-behavior: smooth }` tetap aktif, jadi setiap
   *      `window.scrollTo` per-frame menjadi animasi browser sendiri yang
   *      langsung dibatalkan frame berikutnya.
   *
   * Yang diuji:
   *   - hook RICH benar-benar memegang scroll (atribut di <html>);
   *   - `scroll-behavior` benar-benar `auto` selama hook hidup;
   *   - wheel SUNGUHAN (tepercaya, lewat CDP) dicerna oleh hook: posisinya
   *     naik BERTAHAP, bukan melompat sekali (lompat sekali = scroll native
   *     menang = `preventDefault` tidak bekerja);
   *   - setelah wheel berhenti, posisi MONOTONIK naik lalu diam. Gejala yang
   *     dilaporkan persis begini: naik-turun-naik-turun seperti seret.
   *     Getaran = arah yang berbalik.
   */
  await evalJs('window.scrollTo(0, 0); true');
  await sleep(700);

  const gate = JSON.parse(await evalJs(String.raw`(() => {
    return JSON.stringify({
      attr: document.documentElement.dataset.smoothScroll ?? '',
      behavior: getComputedStyle(document.documentElement).scrollBehavior,
    });
  })()`));
  check('Hook smooth scroll aktif di mode rich',
    gate.attr === 'on', 'data-smooth-scroll=' + (gate.attr || 'TIDAK ADA'));
  check('scroll-behavior CSS dimatikan selama hook aktif (satu penulis scroll)',
    gate.behavior === 'auto', 'scroll-behavior=' + gate.behavior);

  /*
   * Event wheel harus TEPERCAYA untuk bisa dibatalkan preventDefault - wheel
   * buatan `new WheelEvent()` tidak bisa, jadi CDP dipakai: itu satu-satunya
   * cara menguji jalur preventDefault sungguhan dari luar halaman.
   */
  const TICKS = 6;
  const PER_TICK = 200;
  const positions = [];
  for (let i = 0; i < TICKS; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: PER_TICK,
    });
    await sleep(50);
    positions.push(await evalJs('Math.round(window.scrollY)'));
  }
  const expected = TICKS * PER_TICK;

  check('Wheel dicerna smooth scroll (naik bertahap, bukan lompat native)',
    positions[0] > 0 && positions[0] < expected * 0.6 && new Set(positions).size >= 3,
    positions.join(' -> ') + ' (target ' + expected + 'px)');

  // Diamkan, lalu ambil sampel posisi yang rapat.
  const trace = [];
  for (let i = 0; i < 16; i++) {
    await sleep(70);
    trace.push(Math.round(await evalJs('window.scrollY')));
  }
  const goingDown = trace.filter((v, i) => i > 0 && v < trace[i - 1]);
  check('Tidak ada getaran: posisi scroll tidak pernah turun setelah wheel berhenti',
    goingDown.length === 0,
    goingDown.length + ' penurunan pada ' + JSON.stringify(trace));

  await sleep(900);
  const settledY = await evalJs('Math.round(window.scrollY)');
  check('Smooth scroll berhenti tepat di target (tidak ada energi residual)',
    Math.abs(settledY - expected) <= 2,
    settledY + 'px dari ' + expected + 'px');

  /*
   * Scrollbar dan keyboard harus tetap native. Kalau keduanya ikut dicerna,
   * keduanya akan saling melawan - persis kelas bug yang sedang diperbaiki.
   */
  await evalJs('window.scrollTo(0, 0); true');
  await sleep(600);
  const beforeKey = await evalJs('Math.round(window.scrollY)');
  for (let i = 0; i < 3; i++) {
    await send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown', windowsVirtualKeyCode: 35, code: 'End', key: 'End',
    });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 35, code: 'End', key: 'End' });
    await sleep(60);
  }
  await sleep(900);
  const afterKey = JSON.parse(await evalJs(String.raw`(() => {
    return JSON.stringify({
      y: Math.round(window.scrollY),
      max: Math.round(document.documentElement.scrollHeight - window.innerHeight),
    });
  })()`));
  check('Scroll keyboard tetap native (tidak melawan hook)',
    afterKey.y > beforeKey && Math.abs(afterKey.y - afterKey.max) <= 4,
    'End -> ' + afterKey.y + 'px dari ' + afterKey.max + 'px');
  await evalJs('window.scrollTo(0, 0); true');
  await sleep(400);
}

console.log('\n' + '='.repeat(58));
console.log('  TOTAL: ' + pass + ' PASS / ' + fail + ' FAIL');
console.log('='.repeat(58));

ws.close();
chrome.kill();
process.exit(fail > 0 ? 1 : 0);