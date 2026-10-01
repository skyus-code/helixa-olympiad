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
    document.querySelectorAll('#top > section.stack-wrap').forEach((s) => {
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

  const stack = await evalJs(String.raw`(() => {
    const secs = [...document.querySelectorAll('#top > section.stack-wrap')];
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
   * Posisi motif harus di kanan, di sisi yang tidak dipakai headline. Ini
   * sekaligus mengunci arah geser kamera: dulu tandanya terbalik sehingga motif
   * justru terdorong ke kiri, masuk ke bagian hero-scrim yang paling pekat, dan
   * praktis tidak terlihat meski scene-nya berjalan.
   */
  check('Motif partikel duduk di kolom kanan, jauh dari headline',
    fbData.centerFrac > 0.7,
    'pusat motif di ' + (fbData.centerFrac * 100).toFixed(1) + '% lebar layar');
  check('Motif partikel berada di kanan headline (tidak menindih teks)',
    hero.h1Box.right < 1440 * 0.62,
    'headline berakhir di ' + hero.h1Box.right + 'px dari 1440');
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

  await evalJs(String.raw`(() => {
    window.__nativeRaf = window.requestAnimationFrame.bind(window);
    window.__fires = 0;
    window.requestAnimationFrame = function (cb) {
      return window.__nativeRaf(function (arg) {
        window.__fires++;
        return cb(arg);
      });
    };
    return true;
  })()`);

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
  const gyroFps = await measure(2000);
  check('FPS giroskop Aturan ~60', gyroFps.fps > 50 && gyroFps.fps < 75,
    gyroFps.fps + ' fps selama ' + gyroFps.seconds + 's');

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
    far.fps === 0, far.fps + ' callback rAF dalam ' + far.seconds + 's (harus 0)');

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
   */
  const maxY = await evalJs('document.documentElement.scrollHeight - window.innerHeight');
  await evalJs(`window.scrollTo(0, ${maxY}); true`);
  await sleep(4000);

  /*
   * Wrapper rAF dari blok sebelumnya MASIH terpasang - tidak ada reload di antara
   * blok, jadi sengaja tidak dipasang ulang.
   *
   * Memasangnya dua kali itu rekursif dan langsung bikin stack overflow: wrapper
   * yang lebih lama memanggil `window.__nativeRaf` secara dinamis, jadi begitu
   * properti itu ditimpa dengan wrapper yang lebih baru, wrapper lama memanggil
   * dirinya sendiri. Karena wrapper yang terpasang sudah menghitung ke
   * `window.__fires`, blok ini cukup memakainya apa adanya.
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

console.log('\n' + '='.repeat(58));
console.log('  TOTAL: ' + pass + ' PASS / ' + fail + ' FAIL');
console.log('='.repeat(58));

ws.close();
chrome.kill();
process.exit(fail > 0 ? 1 : 0);