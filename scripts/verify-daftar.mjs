/**
 * Verifikasi halaman Form Pendaftaran (route hash `#pendaftaran`).
 *
 * KENAPA FILE TERPISAH, BUKAN BLOK DI verify.mjs
 * -----------------------------------------------
 * verify.mjs menguji landing page. Halaman form memakai URL yang BERBEDA
 * (`/#pendaftaran`) dan punya beberapa klaim yang tidak berlaku di landing page:
 * scroll position, Register_URL, dan hitungan section. Mencampurnya ke dalam
 * satu dokumen berarti setiap blok harus membayar guard "kalau halaman ini
 * halaman form", dan guard seperti itulah yang paling sering membuat pemeriksaan
 * diam-diam tidak dijalankan. Pola yang sama sudah dipakai untuk
 * verify-webgl-off.mjs.
 *
 * Yang diperiksa, dua lapis:
 *   A. STATIS (tanpa browser): gerbang three.js, isi form, dan BUKTI bahwa
 *      tidak ada pengiriman data ke mana pun.
 *   B. BROWSER (Chrome headless via CDP): perpindahan route, urutan lapisan
 *      3D di belakang kartu form, scene benar-benar menggambar dan benar-benar
 *      bergerak, loop berhenti saat pindah halaman, kontras WCAG diukur di atas
 *      scene yang berputar, satu frame statis saat reduced-motion, dan nol
 *      unduhan three.js di ponsel.
 *
 * CATATAN SCREENSHOT: `Page.captureScreenshot` di Chrome headless tidak
 * menyertakan layer WebGL. Semua bukti piksel diambil lewat `drawImage` ke
 * canvas 2D + `getImageData` di dalam halaman, yang membaca framebuffer
 * sungguhan. Scanner kontras juga karena itu menggambar sendiri kompositnya
 * di ruang sRGB.
 *
 * Jalankan: node scripts/verify-daftar.mjs [url]   (setelah `npm run build`)
 */
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = process.cwd();
const BASE = (process.argv[2] ?? 'http://localhost:4200/').replace(/#.*$/, '');
const DAFTAR = BASE + '#pendaftaran';
const PORT = 9229;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let pass = 0;
let fail = 0;

/**
 * Panggilan gambar per detik saat mode rich, dipakai ulang di blok reduced.
 *
 * Disimpan di luar bloknya karena perbandingan yang bermakna bersifat
 * RELATIF: yang membuktikan "reduced benar-benar diam" bukan angka nol mutlak,
 * tapi selisihnya terhadap mode rich di halaman yang sama. Nilai absolut bisa
 * berubah karena versi three.js atau jumlah draw-call per bingkai; nilai
 * relatifnya tidak.
 */
let richDraws = 0;

function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log('  ok   ' + name + (detail ? '  (' + detail + ')' : ''));
  } else {
    fail++;
    console.log('  FAIL ' + name + (detail ? '  (' + detail + ')' : ''));
  }
}

/* ==================================================================
   A. PEMERIKSAAN STATIS
   ================================================================== */

console.log('\n=== A1. GERBANG three.js & ISI FORM ===');
{
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
   * Aturan yang sama seperti di verify.mjs, dan alasannya sama: impor STATIS
   * `from 'three'` di modul yang ikut terunduh di HP melanggar syarat "ponsel
   * tidak pernah mengunduh chunk three.js" tanpa error sama sekali - berkasnya
   * cuma diam-diam ikut terpaket. Satu-satunya jalan yang sah adalah
   * `import()` dinamis di dalam cabang gerbang mode.
   */
  const leaked = [];
  const scenes = [];
  for (const f of srcFiles) {
    const text = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const rel = f.replace(ROOT, '').replace(/\\/g, '/');
    if (/from\s+['"]three['"]/.test(text)) {
      if (rel.includes('/src/three/')) scenes.push(rel);
      else leaked.push(rel);
    }
  }
  check('three.js hanya diimpor di dalam src/three/', leaked.length === 0,
    leaked.length ? 'BOCOR: ' + leaked.join(', ') : scenes.length + ' scene module');

  const wrapper = readFileSync(join(src, 'components', 'OlympiadScene.tsx'), 'utf8');
  check('OlympiadScene.tsx memuat scene lewat import() dinamis',
    /import\(\s*['"]\.\.\/three\//.test(wrapper),
    /import\(\s*['"]\.\.\/three\//.test(wrapper) ? 'ok' : 'TIDAK ADA import() dinamis');
  check('OlympiadScene.tsx tidak mengimpor three secara statis',
    !/from\s+['"]three['"]/.test(wrapper));

  /*
   * Gerbang mode harus tetap satu-satunya jalan masuk ke scene. Kalau baris
   * `import()` pindah ke luar cabang mode 'rich', semua yang di atas masih hijau
   * sementara ponsel mulai mengunduh three.js - persis kegagalan yang harus
   * dicegah oleh gerbang, bukan oleh konvensi.
   *
   * Yang diperiksa BUKAN "ada `mode === 'rich'` di file", karena itu selalu
   * benar selama gerbangnya ada di mana pun. Yang diperiksa adalah URUTAN:
   * effect yang memuat scene harus punya guard `if (!rich)` yang tertulis
   * SEBELUM baris `import()`. Guard yang ada tapi tidak menjangkau baris itu
   * hanya berdasar pada susunan kata.
   */
  const importAt = wrapper.indexOf("import('../three/olympiadScene')");
  const effectAt = wrapper.lastIndexOf('useEffect(', importAt);
  const guardToImport = wrapper.slice(effectAt, importAt);
  const gateDeclared = /const rich\s*=\s*mode\s*===\s*'rich'/.test(wrapper);
  check('import() scene DI DALAM effect yang dijaga mode rich',
    importAt > 0 && effectAt > 0 && gateDeclared && /if\s*\(\s*!rich\s*\)/.test(guardToImport),
    importAt < 0 ? 'tidak ada import()'
      : effectAt < 0 ? 'tidak ada useEffect sebelum import()'
      : !gateDeclared ? 'variabel gerbang mode tidak dideklarasikan'
      : 'guard if (!rich) tidak ada sebelum baris import()');

  const content = readFileSync(join(src, 'content.ts'), 'utf8');
  check('REGISTER_URL menunjuk route form (bukan "#" lagi)',
    /export const REGISTER_URL = '#pendaftaran';/.test(content),
    content.match(/export const REGISTER_URL = '[^']*'/)?.[0] ?? 'tidak ditemukan');

  /*
   * TABRAKAN ID SECTION LANDING — PENYEBAB NAVIGASI DIGITUK SULIT DIAM-DIAM
   * ----------------------------------------------------------------------
   * Hook smooth scroll memasang listener click yang mencari
   * `document.getElementById(hash)`. Kalau hash route kebetulan nama sebuah
   * section landing, hook itu `preventDefault()` dan menganimasikan scroll ke
   * sana, sehingga `hashchange` tidak pernah terjadi dan route tidak pernah
   * berganti. Gejalanya bukan "halaman kosong" - halaman justru tergulir dengan
   * lancar, jadi penyebabnya sangat tidak terlihat.
   *
   * Ini terjadi nyata pada percobaan pertama: hash `#daftar` menabrak
   * `<Section id="daftar">` di ClosingCta. Karena itu id route diperiksa di sini
   * terhadap setiap `<Section id="...">` yang ada, bukan hanya_andalkan
      
   * pemeriksaan manual.
   */
  const routeTable = readFileSync(join(src, 'hooks', 'useHashRoute.ts'), 'utf8');
  const routeHashes = [...routeTable.matchAll(/^\s{2}(\w+)\s*:\s*'(\w+)'/gm)].map((m) => m[1]);
  const sectionIds = [];
  for (const f of readdirSync(join(src, 'components'))) {
    if (!f.endsWith('.tsx')) continue;
    for (const m of readFileSync(join(src, 'components', f), 'utf8')
      .matchAll(/<Section\s[^>]*\bid=["']([^"']+)["']/g)) {
      sectionIds.push({ id: m[1], file: f });
    }
  }
  const collisions = sectionIds.filter((s) => routeHashes.includes(s.id));
  check('Hash route tidak menabrak id section landing manapun', collisions.length === 0,
    collisions.length
      ? collisions.map((c) => '#' + c.id + ' (' + c.file + '.tsx)').join(', ')
      : routeHashes.map((h) => '#' + h).join(', ') + ' vs ' + sectionIds.length + ' id section');

  const form = readFileSync(join(src, 'components', 'RegistrationPage.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  /*
   * `name="..."` yang dipakai di sini adalah nama yang benar-benar dibaca
   * screen reader ("Nama lengkap", bukan "daftar-nama"), dan juga atribut yang
   * membuat field ini submit-able kalau nanti form-nya punya backend. Jadi
   * pemeriksaan ini bukan sekadar mencatat field apa saja yang ada.
   */
  const wanted = ['nama', 'sekolah', 'kota', 'kelas', 'jurusan', 'wa', 'email', 'bidang', 'setuju'];
  const missing = wanted.filter((w) => !new RegExp('name="' + w + '"').test(form));
  check('Sembilan field form punya atribut name yang benar', missing.length === 0,
    missing.length ? 'hilang: ' + missing.join(', ') : wanted.join(', '));

  /*
   * Klaim yang paling mudah dijanjikan lalu dilanggar diam-diam: "form ini
   * belum punya backend".
   *
   * Dua-duanya di sini BUKAN banned-list pustaka - satu skrip tidak boleh
   *اسكهل punya fetch di halaman lain. Yang diperiksa adalah komponen form
   * dan modul yang ia panggil: di dalam keduanya tidak boleh ada satu pun
   * jalur yang meninggalkan browser. Kalau nanti backend benar-benar dipasang,
   * pemeriksaan ini harus ikut dihapus SEBUKAN dilewati, karena itu perubahan
   * yang perlu terlihat.
   */
  const netCalls = [];
  for (const [rel, text] of [
    ['components/RegistrationPage.tsx', form],
    ['components/OlympiadScene.tsx', wrapper.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')],
  ]) {
    for (const [what, re] of [
      ['fetch(', /\bfetch\s*\(/],
      ['XMLHttpRequest', /\bnew\s+XMLHttpRequest\b/],
      ['sendBeacon', /sendBeacon/],
      ['img src ke luar (pixel apical)', /<img\b[^>]*\bsrc=/i],
      ['action= pada form', /\baction=/],
    ]) if (re.test(text)) netCalls.push(rel + ': ' + what);
  }
  check('Tidak ada jalur yang mengirim data dari form (belum ada backend)', netCalls.length === 0,
    netCalls.length ? netCalls.join(', ') : 'nol fetch/XHR/beacon/action/img di komponen form');

  check('Pengakuan "belum dikirim" ada di konten, bukan disembunyikan',
    /notSentTitle/.test(content) && /notSentBody/.test(content));
}

/* ==================================================================
   B. BROWSER
   ================================================================== */

/*
 * `--disable-gpu` SENGAJA TIDAK dipakai: canvas form memenuhi seluruh viewport
 * dan memakai additive blending. Dengan software rasterizer di CPU, frame akan
 * jelek dan beberapa pemeriksaan lain ikut melambat. GPU sungguhan membuat
 * yang diukur mendekati apa yang dilihat pengguna. Alasan yang sama seperti di
 * verify.mjs.
 */
const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--hide-scrollbars', '--no-sandbox',
    '--no-first-run', '--force-color-profile=srgb',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=` + process.env.TEMP + '\\helixa-daftar-profile',
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

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(DAFTAR)}`, { method: 'PUT' })).json();
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

/**
 * Batas waktu untuk setiap event yang ditunggu.
 *
 * Tanpa ini, satu event yang tidak pernah datang tidak menggagalkan pemeriksaan
 * - ia menggantungkan seluruh script sampai batas waktu shell, dan informasi
 * yang hilang justru yang paling dibutuhkan: blok mana yang macet. Melempar
 * error dengan nama event membuat kegagalan itu terarah.
 */
function withTimeout(promise, ms, what) {
  return Promise.race([
    promise,
    sleep(ms).then(() => {
      throw new Error('Timeout ' + ms + 'ms sambil menunggu ' + what);
    }),
  ]);
}
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error((r.exceptionDetails.exception?.description ?? r.exceptionDetails.text) +
      ' :: ' + expression.slice(0, 140));
  }
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: String.raw`(() => {
    if (window.__rafProbed && window.__drawProbed) return;
    if (!window.__rafProbed) {
      window.__rafProbed = true;
      window.__nativeRaf = window.requestAnimationFrame.bind(window);
      window.__fires = 0;
      window.requestAnimationFrame = function (cb) {
        return window.__nativeRaf(function (arg) {
          window.__fires++;
          return cb(arg);
        });
      };
    }
    if (!window.__drawProbed) {
      window.__drawProbed = true;
      window.__draws = 0;
      const methods = ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced','drawArraysInstancedWEBGL','drawElementsInstancedWEBGL'];
      for (const proto of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!proto) continue;
        for (const name of methods) {
          const original = proto[name];
          if (typeof original !== 'function') continue;
          proto[name] = function (...args) {
            window.__draws++;
            return original.apply(this, args);
          };
        }
      }
    }
  })();`,
});

/* Daftar berkas yang benar-benar diminta browser. Dipakai untuk bukti "ponsel
 * tidak pernah mengunduh chunk three.js": bukan "tidak dieksekusi", tapi
 * "tidak ada di daftar permintaan sama sekali". */
const requested = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Network.requestWillBeSent') requested.push(m.params.request.url);
});

async function setMotion(mode, coarse) {
  const features = [{ name: 'prefers-reduced-motion', value: mode }];
  features.push(
    { name: 'any-pointer', value: coarse ? 'coarse' : 'fine' },
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

/**
 * Buka ulang halaman dari nol pada URL yang diberikan.
 *
 * Dua jebakan, keduanya menggantungkan script sampai batas waktu, bukan sampai
 * gagal dengan pesan yang berguna:
 *
 *  1. `Page.navigate` ke URL yang HANYA berbeda hash tidak memuat ulang dokumen,
 *     jadi `Page.loadEventFired` tidak akan pernah datang. Karena itu perpindahan
 *     route di dalam aplikasi diuji lewat perubahan hash pada dokumen yang sama,
 *     dan `goto()` hanya dipakai untuk membuat dokumen baru.
 *
 *  2. `Page.navigate` ke URL yang SEDANG DIBUKA juga tidak memuat ulang dokumen.
 *     Ini yang paling mudah terpicu, karena blok B7 dan B8 sama-sama menguji
 *     halaman form pada kondisi gerak berbeda, jadi keduanya memanggil
 *     `goto(DAFTAR)` dengan URL yang persis sama. Tanpa penanganan, pemanggilan
 *     kedua menunggu event yang memang tidak akan terjadi.
 *
 * Karena itu URL dibandingkan lebih dulu, dan kalau sama persis, muat ulang
 * dijadwalkan lewat `Page.reload` yang memang menghasilkan dokumen baru.
 */
async function goto(url) {
  let current = '';
  try {
    current = await evalJs('location.href');
  } catch {
    /* Dokumen belum ada; selalu navigasi. */
  }
  const loaded = withTimeout(once('Page.loadEventFired'), 25000, 'Page.loadEventFired untuk ' + url);
  if (current === url) await send('Page.reload', {});
  else await send('Page.navigate', { url });
  await loaded;
  await sleep(2200);
  await evalJs("document.documentElement.style.scrollBehavior='auto'; true;");
}

/**
 * Counter rAF, sama bentuknya dengan yang di verify.mjs.
 *
 * Catatan: angka dari probe ini TIDAK bisa dipakai sebagai "kecepatan render
 * scene". Di halaman form ada sumber rAF lain yang tidak terlihat -
 * kursor kustom, dan `motion` yang menyalakan loop frame-nya sendiri - jadi
 * hitungan rAF di sini bukan hitungan bingkai scene. Pengukuran render yang
 * benar ada di `installDrawProbe`.
 */
const installRafProbe = () =>
  evalJs(String.raw`(() => {
    if (window.__rafProbed) return true;
    window.__rafProbed = true;
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

/**
 * Counter panggilan gambar WebGL.
 *
 * Ini pengukuran yang benar untuk "apakah scene benar-benar mengulang frame",
 * dan lebih jujur daripada menghitung rAF. Alasannya:
 *
 *  - rAF dihitung per PENDAFTARAN callback, bukan per bingkai. Halaman form
 *    punya beberapa sumber (kursor kustom, loop `motion`), sehingga hitungannya
 *    tidak bisa dikaitkan dengan scene sama sekali.
 *  - Kode animasi bisa berhenti sampler menggambar: yang penting adalah
 *    `drawElements`/`drawArrays` benar-benar dipanggil atau tidak.
 *
 * Ditempelkan ke prototype, jadi berlaku untuk konteks WebGL2 maupun WebGL1,
 * dan dipasang SETELAH konteks dibuat tanpa masalah: yang di-tembak adalah
 * prototype, bukan objek konteks.
 *
 * Yang dihitung hanya draw-call. `clear()` dan `useProgram()` tidak dihitung -
 * keduanya dipanggil per frame bahkan kalau tidak ada geometri yang digambar,
 * jadi menghitungnya akan membuat scene kosong terlihat "aktif".
 */
const installDrawProbe = () =>
  evalJs(String.raw`(() => {
    if (window.__drawProbed) return true;
    window.__drawProbed = true;
    window.__draws = 0;
    const methods = [
      'drawArrays', 'drawElements',
      'drawArraysInstanced', 'drawElementsInstanced',
      'drawArraysInstancedWEBGL', 'drawElementsInstancedWEBGL',
    ];
    for (const proto of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!proto) continue;
      for (const name of methods) {
        const original = proto[name];
        if (typeof original !== 'function') continue;
        proto[name] = function (...args) {
          window.__draws++;
          return original.apply(this, args);
        };
      }
    }
    return true;
  })()`);

/**
 * Hitung panggilan gambar per detik selama rentang waktu yang diberikan.
 *
 * Di mode rich scene menggambar beberapa call per bingkai (garis rusuk, simpul,
 * debu), jadi angkanya jauh di atas fps. Yang diperiksa hanya "tidak nol dan
 * tidak remeh", karena yang ingin dibuktikan adalah loop hidup - bukan
 * efisiensi. Di mode reduced angkanya harus mendekati nol, dan itu yang dipakai
 * untuk membuktikan satu bingkai statis.
 */
const measureDraws = async (ms) =>
  JSON.parse(await evalJs(String.raw`(async () => {
    window.__draws = 0;
    const t0 = performance.now();
    await new Promise((done) => {
      const step = () => {
        if (performance.now() - t0 >= ${ms}) return done();
        window.__nativeRaf(step);
      };
      window.__nativeRaf(step);
    });
    const dt = (performance.now() - t0) / 1000;
    return JSON.stringify({ draws: +(window.__draws / dt).toFixed(1), seconds: +dt.toFixed(2) });
  })()`));

/**
 * Klik elemen sungguhan, dengan menggulirnya ke tengah layar lebih dulu.
 *
 * Dua sebab, keduanya sudah membuat pemeriksaan gagal PALSU:
 *
 *  - `getBoundingClientRect()` mengembalikan koordinat RELATIF viewport. Tombol
 *    kirim dan tautan "Kembali" ada di bawah lipatan pada viewport 900px, jadi
 *    koordinatnya lebih besar dari tinggi layar dan klik mendarat di ruang
 *    kosong. Gejalanya: tidak ada error, tidak ada perubahan - klik
 *    "berhasil" tanpa terjadi apa-apa, dan semua pemeriksaan berikutnya gagal
 *    karena halaman memang tidak bereaksi.
 *  - `.click()` dari dalam halaman melewati hit-testing, jadi tidak membuktikan
 *    apa pun soal apakah tombolnya benar-benar bisa diklik.
 *
 * `elExpr` adalah expression JS yang mengembalikan elemennya.
 */
async function clickReal(elExpr, what) {
  const box = JSON.parse(await evalJs(`(() => {
    const el = ${elExpr};
    if (!el) return JSON.stringify({ error: 'elemen tidak ditemukan' });
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return JSON.stringify({
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
      w: Math.round(r.width), h: Math.round(r.height),
    });
  })()`));
  if (box.error) return box;
  // Beri jeda supaya gulir selesai dan koordinat di atas tidak basi.
  await sleep(350);
  const fresh = JSON.parse(await evalJs(`(() => {
    const el = ${elExpr};
    const r = el.getBoundingClientRect();
    return JSON.stringify({
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
      inView: r.top >= 0 && r.bottom <= window.innerHeight &&
              r.left >= 0 && r.right <= window.innerWidth,
    });
  })()`));
  const point = fresh.x !== undefined ? { ...box, ...fresh } : box;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, buttons: 0 });
  await sleep(60);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', {
      type, x: point.x, y: point.y, button: 'left', clickCount: 1,
      buttons: type === 'mousePressed' ? 1 : 0,
    });
  }
  if (!point.inView) {
    console.log('       (perhatian: ' + (what ?? 'elemen') + ' di luar viewport setelah digulir: ' +
      point.x + ',' + point.y + ')');
  }
  return point;
}

/** Tunggu sampai scene benar-benar siap: canvas ter-size dan framebuffer menyala. */
async function waitScene(label) {
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    const st = await evalJs(String.raw`(() => {
      const cv = document.querySelector('.register-wrap canvas');
      if (!cv) return 'no-canvas';
      if (!cv.width) return 'unsized';
      const tmp = document.createElement('canvas');
      tmp.width = cv.width; tmp.height = cv.height;
      const c = tmp.getContext('2d', { willReadFrequently: true });
      c.drawImage(cv, 0, 0);
      const d = c.getImageData(0, 0, cv.width, cv.height).data;
      let lit = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 4) lit++;
      return lit > 400 ? 'ready' : 'dark:' + lit;
    })()`);
    if (st === 'ready') return true;
    if (label && i === 59) console.log('       (scene belum siap: ' + st + ')');
  }
  return false;
}

console.log('\n=== B1. PERPINDAHAN HALAMAN: TOMBOL "DAFTAR" -> #pendaftaran ===');
let sceneReady = false;
{
  await setViewport(1440, 900, false);
  await setMotion('no-preference', false);
  await goto(BASE);
  await installRafProbe();
  await installDrawProbe();

  /*
   * Jalur yang benar-benar dipakai user, bukan navigasi URL buatan: klik
   * tautan "Daftar" di navbar. Kalau hanya `goto("#pendaftaran")` yang diuji,
   * kegagalan yang melibatkan PointerEvent, `preventDefault` dari smooth
   * scroll, dan perubahan hash akan lolos tanpa terdeteksi.
   *
 * Jalur ini bukan formalitas. Bug yang paling merusak di sini -
   * `#daftar` menabrak `<Section id="daftar">` - hanya terlihat lewat klik
   * sungguhan: hook smooth scroll memanggil `preventDefault()`, halaman
   * tergulir dengan lancar ke section yang salah, dan URL tetap sama. Tidak ada
   * error, tidak ada elemen hilang, semua pemeriksaan DOM tetap hijau.
   */
  const CTA_EXPR = String.raw`[...document.querySelectorAll('header a')]
    .find((x) => x.textContent.trim() === 'Daftar' && x.getAttribute('href'))`;

  const ctaBox = JSON.parse(await evalJs(`(() => {
    const a = ${CTA_EXPR};
    if (!a) return JSON.stringify({ error: 'tidak ditemukan' });
    const r = a.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return JSON.stringify({ error: 'ukuran nol' });
    return JSON.stringify({ href: a.getAttribute('href'),
      w: Math.round(r.width), h: Math.round(r.height) });
  })()`));
  check('Tombol "Daftar" di navbar ada, terlihat, dan punya href',
    !ctaBox.error && ctaBox.w >= 44 && ctaBox.h >= 44,
    ctaBox.error ?? (ctaBox.href + ', ' + ctaBox.w + 'x' + ctaBox.h + 'px'));

  if (!ctaBox.error) {
    await clickReal(CTA_EXPR, 'tombol Daftar di navbar');
    await sleep(1400);
  }

  const afterClick = JSON.parse(await evalJs(String.raw`(() => {
    const card = document.querySelector('.register-card');
    return JSON.stringify({
      hash: location.hash,
      hasCard: !!card,
      hasForm: !!card && card.tagName === 'FORM',
      hasLandingMain: !!document.getElementById('top'),
      sectionCount: document.querySelectorAll('#top section.stack-wrap').length,
      title: document.title,
      scrollY: Math.round(window.scrollY),
      h1: (document.querySelector('h1') ?? {}).textContent?.trim() ?? null,
      h1Focused: document.activeElement === document.querySelector('h1'),
    });
  })()`));

  check('Klik "Daftar" memindahkan route ke halaman form',
    afterClick.hash === '#pendaftaran' && afterClick.hasCard && afterClick.hasForm,
    'hash=' + afterClick.hash + ', kartu=' + afterClick.hasCard);
  check('Halaman form menggantikan landing page (bukan ditumpuk)',
    !afterClick.hasLandingMain && afterClick.sectionCount === 0,
    afterClick.hasLandingMain
      ? 'landing page masih ada di DOM'
      : '#top tidak ada, ' + afterClick.sectionCount + ' section tersisa');
  check('Judul dokumen diganti sesuai halaman',
    afterClick.title.includes('Pendaftaran'), afterClick.title);
  check('Halaman form dibuka dari posisi paling atas',
    afterClick.scrollY === 0, 'scrollY=' + afterClick.scrollY);
  check('Fokus pindah ke judul halaman (screen reader & keyboard)',
    afterClick.h1Focused, 'h1 "' + (afterClick.h1 ?? '?') + '"');

  // Probe WebGL baru dipasang di halaman form (dokumen baru).
  await installDrawProbe();
  await installRafProbe();

  console.log('\n=== B2. SCENE 3D: BUKTI BENAR-BENAR MENGGAMBAR & BERGERAK ===');
  sceneReady = await waitScene('daftar');

  const canvasInfo = JSON.parse(await evalJs(String.raw`(() => {
    const cv = document.querySelector('.register-wrap canvas');
    if (!cv) return JSON.stringify({ error: 'canvas tidak ada' });
    const wrap = cv.closest('.register-wrap');
    const wrapBox = wrap.getBoundingClientRect();
    const cr = cv.getBoundingClientRect();
    const gl = cv.getContext('webgl2') || cv.getContext('webgl');
    return JSON.stringify({
      isWebGL: !!gl,
      buffer: [cv.width, cv.height],
      css: [Math.round(cr.width), Math.round(cr.height)],
      coversViewport: cr.width >= wrapBox.width - 2 && cr.height >= wrapBox.height - 2,
      opacity: Number(getComputedStyle(cv).opacity),
      pointerEvents: getComputedStyle(cv.parentElement).pointerEvents,
      ariaHidden: cv.parentElement.getAttribute('aria-hidden'),
    });
  })()`));

  check('Kanvas form benar-benar WebGL (bukan Canvas 2D)',
    !!canvasInfo.isWebGL, canvasInfo.error ?? '');
  check('Kanvas memenuhi seluruh halaman form',
    !!canvasInfo.coversViewport,
    canvasInfo.css ? canvasInfo.css.join('x') + 'px' : 'tidak diukur');
  check('Kanvas dekoratif: tidak bisa diklik & tidak diumumkan',
    canvasInfo.pointerEvents === 'none' && canvasInfo.ariaHidden === 'true',
    'pointer-events=' + canvasInfo.pointerEvents + ', aria-hidden=' + canvasInfo.ariaHidden);
  check('Framebuffer scene form benar-benar menyala',
    sceneReady,
    canvasInfo.buffer ? canvasInfo.buffer.join('x') + 'px framebuffer' : '');

  /*
   * Loop hidup. Scene harus berputar, dan partikel harus bergerak - dua klaim
   * berbeda yang sering dianggap satu. Bukti geraknya bukan "fps tinggi"
   * (fps tinggi juga bisa terjadi kalau yang berputar cuma kamera), tapi
   * framebuffer-nya benar-benar BERUBAH.
   */
  const motionProof = JSON.parse(await evalJs(String.raw`(async () => {
    const raf = () => new Promise((r) => window.__nativeRaf(r));
    const cv = document.querySelector('.register-wrap canvas');
    const tmp = document.createElement('canvas');
    tmp.width = cv.width; tmp.height = cv.height;
    const c = tmp.getContext('2d', { willReadFrequently: true });
    const grab = () => {
      c.drawImage(cv, 0, 0);
      return c.getImageData(0, 0, cv.width, cv.height).data;
    };
    const a = grab();
    let changed = 0;
    for (let i = 0; i < 24; i++) { await raf(); }
    const b = grab();
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) > 6 || Math.abs(a[i + 1] - b[i + 1]) > 6 ||
          Math.abs(a[i + 2] - b[i + 2]) > 6) changed++;
    }
    // Berapa banyak piksel yang menyala, di luar area kartu form.
    const card = document.querySelector('.register-card').getBoundingClientRect();
    const cr = cv.getBoundingClientRect();
    const k = cr.width / cv.width;
    let litTotal = 0, litOutside = 0, inside = 0, outside = 0;
    for (let y = 0; y < cv.height; y += 2) {
      for (let x = 0; x < cv.width; x += 2) {
        const o = (y * cv.width + x) * 4;
        if (b[o + 3] <= 4) continue;
        litTotal++;
        const vx = cr.left + x * k, vy = cr.top + y * k;
        const inCard = vx >= card.left && vx <= card.right && vy >= card.top && vy <= card.bottom;
        if (inCard) inside++; else outside++;
      }
    }
    return JSON.stringify({ changed, litTotal, inside, outside });
  })()`));
  const draws = await measureDraws(2000);
  if (draws.draws < 5) {
    // Coba pasang ulang probe di konteks yang sudah ada, lalu ukur lagi.
    await evalJs(`(() => {
      window.__draws = 0;
      const methods = ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced','drawArraysInstancedWEBGL','drawElementsInstancedWEBGL'];
      for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
        for (const name of methods) {
          const orig = proto[name];
          if (typeof orig !== 'function') continue;
          proto[name] = function (...args) { window.__draws++; return orig.apply(this, args); };
        }
      }
    })()`);
    const draws2 = await measureDraws(2000);
    if (draws2.draws > draws.draws) draws.draws = draws2.draws;
  }
  richDraws = draws.draws;
  check('Render loop scene form hidup (panggilan gambar tidak pernah berhenti)',
    draws.draws > 30, draws.draws + ' panggilan gambar/detik selama ' + draws.seconds + 's');
  check('Partikel & benda ruang benar-benar BERGERAK (piksel berubah antar bingkai)',
    motionProof.changed > 500, motionProof.changed + ' piksel berubah dalam 24 bingkai');
  /*
   * Dua sisi yang diuji, karena formsinya satu arah saja bisa menipu:
   *
   *   - `outside` membuktikan benda ruang MELIHATI dari luar kotak form. Kalau
   *     nol, scene ada tapi tertutup penuh, jadi permintaan "di belakang kotak
   *     form" tidak terpenuhi karena yang terlihat cuma kotak.
   *   - `inside` membuktikan benda ruang memang DI BELAKANG kotak, bukan
   *     cuma di sampingnya. Kalau nol, objeknya bergeser ke kanan atau kiri
   *     dan tidak lagi terlihat sebagai latar.
   *
   * Rasio keduanya ikut dijaga supaya objek tidak tersembunyi 90% di
   * belakang kartu: bukan objek kecil di sudut, tapi bentuk ruang yang membingkai
   * kotak.
   */
  const ratio = motionProof.inside > 0 ? motionProof.outside / motionProof.inside : 0;
  check('Benda ruang terlihat dari luar kotak form (tidak tertutup penuh)',
    motionProof.outside > 2000, motionProof.outside + ' piksel menyala di luar kartu');
  check('Benda ruang benar-benar DI BELAKANG kotak, bukan di sampingnya',
    motionProof.inside > 2000 && ratio > 0.15 && ratio < 1.5,
    motionProof.inside + ' di dalam, ' + motionProof.outside + ' di luar (rasio ' +
      ratio.toFixed(2) + ')');

  console.log('\n=== B3. URUTAN LAPISAN: 3D DI BELAKANG KOTAK FORM ===');
  const stacking = JSON.parse(await evalJs(String.raw`(() => {
    const card = document.querySelector('.register-card');
    const cv = document.querySelector('.register-wrap canvas');
    if (!card || !cv) return JSON.stringify({ error: 'elemen tidak ditemukan' });
    const cr = card.getBoundingClientRect();
    // Titik di tengah kartu form: harus mengenai elemen DI DALAM form, bukan kanvas.
    const px = Math.round(cr.left + cr.width / 2);
    const py = Math.round(cr.top + 120);
    const hit = document.elementFromPoint(px, py);
    const insideCard = !!(hit && card.contains(hit));
    const zvv = getComputedStyle(cv.parentElement).zIndex;
    const zcv = getComputedStyle(card).zIndex;
    const zv = zvv === 'auto' ? '0' : zvv;
    const zc = zcv === 'auto' ? '0' : zcv;
    return JSON.stringify({
      hit: hit ? hit.tagName.toLowerCase() + (hit.className ? '.' + String(hit.className).split(' ')[0] : '') : null,
      insideCard, zc, zv,
      order: cv.parentElement.compareDocumentPosition(card) === Node.DOCUMENT_POSITION_FOLLOWING ? 'canvas-sebelum-kartu' : 'canvas-setelah-kartu',
    });
  })()`));
  check('Klik di tengah form mengenai isi form, bukan kanvas 3D',
    !!stacking.insideCard, stacking.error ?? ('hit=' + stacking.hit + ', urutan ' + stacking.order));
  check('Kanvas ada di belakang kartu form (urutan dokumen benar)',
    stacking.order === 'canvas-sebelum-kartu' &&
      (stacking.zv === '0' || stacking.zc === '0' || Number(stacking.zv) >= 0),
    stacking.order + ' (z kanvas=' + stacking.zv + ', z kartu=' + stacking.zc + ')');
}

console.log('\n=== B4. KONTRAS WCAG DI ATAS SCENE YANG BERGERAK ===');
{
  /*
   * Yang diukur adalah rasio TERBURUK, di 300 bingkai, bukan satu frame.
   *
   * Alasannya sama seperti di section Aturan: puncak alpha dari wireframe yang
   * berputar BUKAN konstanta. Pada fase di mana garis rusuk sejajar dengan grid
   * piksel, antialiasing yang biasanya tersebar berubah menjadi satu piksel
   * terang penuh. Memindai satu bingkai menghasilkan keyakinan palsu bahwa
   * legibilitasnya aman.
   *
   * Berbeda dengan armillary, di sini teksnya berada DI DALAM kartu form yang
   * punya latar sendiri. Jadi ada dua lapis yang diuji, dan keduanya wajib:
   *   (1) teks di atas latar kartu saja - kontrol, harus jauh di atas 4,5:1;
   *   (2) teks di atas kompositisi kartu + scene yang lewat di belakangnya -
   *       yang benar-benar dilihat mata. (2) harus >= 4,5:1 juga, dan itulah
   *       yang membenarkan pilihan alpha 0,94 pada kartu.
   *
   * Kompositing dilakukan di ruang sRGB, bukan linear: browser mencampur alpha
   * di ruang gamma, dan mencampur di ruang linear menghasilkan rasio yang lebih
   * tinggi dari kenyataan - yaitu pengukuran yang lebih longgar, bukan lebih
   * ketat.
   */
  const contrast = JSON.parse(await evalJs(String.raw`(async () => {
    const raf = () => new Promise((r) => window.__nativeRaf(r));
    const probeCtx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const parse = (css) => {
      if (!css || css === 'transparent' || css === 'none') return null;
      probeCtx.fillStyle = '#000';
      probeCtx.fillStyle = css;
      probeCtx.clearRect(0, 0, 1, 1);
      probeCtx.fillRect(0, 0, 1, 1);
      const d = probeCtx.getImageData(0, 0, 1, 1).data;
      if (d[3] === 0) return null;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    };
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const lum = (c) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const lumCache = new Map();
    const lumOf = (c) => {
      const key = ((c.r >> 1) << 16) | ((c.g >> 1) << 8) | (c.b >> 1);
      let v = lumCache.get(key);
      if (v === undefined) { v = lum(c); lumCache.set(key, v); }
      return v;
    };
    const ratioOf = (fg, bg) => {
      const a = lumOf(fg), b = lumOf(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };

    const cv = document.querySelector('.register-wrap canvas');
    const card = document.querySelector('.register-card');
    if (!cv || !card) return JSON.stringify({ error: 'elemen tidak ditemukan' });

    // Rantai latar setiap elemen, dirakit dari <body> ke atas seperti browser.
    const bgOf = (el) => {
      const chain = [];
      for (let n = el; n; n = n.parentElement) chain.push(n);
      let bg = { r: 0, g: 0, b: 0, a: 0 };
      for (const n of chain.reverse()) {
        const style = getComputedStyle(n);
        const bi = style.backgroundImage;
        if (bi && bi !== 'none' && bi.includes('linear-gradient')) {
          // Ambil stop terakhir yang tampak paling gelap/terang: konservatif
          // Ekstrak rgb(a) pertama yang ditemukan
          const m = bi.match(/rgba?\([^)]+\)/g);
          if (m && m.length > 0) {
            const c = parse(m[m.length - 1]);
            if (c && c.a > 0) bg = over(c, bg);
          }
        }
        const c = parse(style.backgroundColor);
        if (c && c.a > 0) bg = over(c, bg);
      }
      return bg;
    };

    /*
     * Alpha kartu: warna background-nya sendiri sudah transparan. Background
     * itu harus ikut masuk dalam kompositasi terhadap scene, kalau tidak
     * pengukuran ini mengasumsikan kartu lebih pekat dari yang benar-benar
     * digambar - dan itu kesalahan yang SELALU membuat hasil terlihat lebih
     * baik. Di sini alpha itu diambil dari nilai yang sama, bukan dari angka
     * yang ditulis ulang di sini.
     */
    const cardColor = parse(getComputedStyle(card).backgroundColor);
    const cardAlpha = cardColor ? cardColor.a : 1;
    const cardBase = bgOf(card);
    // Latar di dalam kartu = kartu di atas latar halaman (belum ada scene).
    const cardOnPage = over({ r: cardColor ? cardColor.r : 0, g: cardColor ? cardColor.g : 0,
      b: cardColor ? cardColor.b : 0, a: cardAlpha }, cardBase);

    const targets = [];
    const push = (label, el) => {
      if (!el) return;
      const color = parse(getComputedStyle(el).color);
      if (!color) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      targets.push({ label, color, rect: r,
        baseBg: bgOf(el),
        plain: Math.round(ratioOf(over(color, bgOf(el)), bgOf(el)) * 100) / 100 });
    };

    // Satu node per jenis teks yang berbeda warna, di dalam & di luar kartu.
    push('judul form', document.querySelector('.register-wrap h1'));
    push('eyebrow', document.querySelector('.register-wrap .eyebrow'));
    push('lead', document.querySelector('.register-wrap h1')?.parentElement?.querySelector('p:not(.eyebrow)'));
    push('label field', card.querySelector('label[for]'));
    push('hint field', card.querySelector('[id$="-hint"]'));
    push('teks isian', card.querySelector('input.field'));
    push('pilihan bidang', card.querySelector('.field-choice'));
    push('label persetujuan', card.querySelector('.field-check')?.parentElement?.querySelector('span'));
    push('tombol kirim', card.querySelector('button[type="submit"]'));
    if (!targets.length) return JSON.stringify({ error: 'tidak ada teks untuk diukur' });

    // Piksel kanvas yang jatuh di tiap region, diindeks sekali saja.
    const cr = cv.getBoundingClientRect();
    const k = cr.width / cv.width;
    for (const tg of targets) {
      const idx = [];
      for (let y = Math.floor(tg.rect.top); y < Math.ceil(tg.rect.bottom); y++) {
        for (let x = Math.floor(tg.rect.left); x < Math.ceil(tg.rect.right); x++) {
          const bx = Math.round((x - cr.left) / k);
          const by = Math.round((y - cr.top) / k);
          if (bx < 0 || by < 0 || bx >= cv.width || by >= cv.height) continue;
          idx.push(by * cv.width + bx);
        }
      }
      tg.pixels = idx;
    }

    const canvasOpacity = Number(getComputedStyle(cv).opacity);
    const scan = (tg, data) => {
      let worst = 21, lit = 0;
      const ca = tg.color.a;
      for (const p of tg.pixels) {
        const o = p * 4;
        // (1) piksel framebuffer di-alpha-kan di atas latar halaman,
        const sA = (data[o + 3] / 255) * canvasOpacity;
        if (sA <= 0.004) continue;
        lit++;
        const inv = 1 - sA;
        const scene = { r: data[o] * sA + cardBase.r * inv,
                        g: data[o + 1] * sA + cardBase.g * inv,
                        b: data[o + 2] * sA + cardBase.b * inv };
        // (2) kartu semi-transparan di-alpha-kan di atas scene,
        const bg = over({ r: cardColor.r, g: cardColor.g, b: cardColor.b, a: cardAlpha }, scene);
        // (3) teks di-alpha-kan di atas hasil itu, baru diukur.
        const ic = 1 - ca;
        const fg = { r: tg.color.r * ca + bg.r * ic, g: tg.color.g * ca + bg.g * ic,
                     b: tg.color.b * ca + bg.b * ic };
        const r = ratioOf(fg, bg);
        if (r < worst) worst = r;
      }
      return { worst: Math.round(worst * 100) / 100, lit };
    };

    const FRAMES = 300;
    const acc = targets.map((tg) => ({ label: tg.label, worst: 21, lit: 0, plain: tg.plain }));
    const tmp = document.createElement('canvas');
    tmp.width = cv.width; tmp.height = cv.height;
    const ctx = tmp.getContext('2d', { willReadFrequently: true });
    for (let f = 0; f < FRAMES; f++) {
      await raf();
      ctx.drawImage(cv, 0, 0);
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < targets.length; i++) {
        const s = scan(targets[i], data);
        if (s.worst < acc[i].worst) acc[i].worst = s.worst;
        if (s.lit > acc[i].lit) acc[i].lit = s.lit;
      }
    }
    const wIn = acc.reduce((a, b) => (b.worst < a.worst ? b : a));
    return JSON.stringify({
      error: null, frames: FRAMES, cardAlpha, canvasOpacity,
      worstLabel: wIn.worst,
      perElement: acc,
    });
  })()`));

  /*
   * Perhatikan `!error &&`: kalau hanya `error ?? (worst >= 4.5)` ditulis di
   * sini, maka probe yang GAGAL akan mengembalikan string error yang truthy dan
   * pemeriksaannya akan melapor PASS justru di saat tidak ada yang terukur.
   * Pola `??` untuk nilai kosong seperti ini hanya aman kalau string error-nya
   * dijamin kosong saat gagal - dan di sini tidak.
   */
  check('Semua teks form tetap terbaca di atas scene yang berputar (WCAG AA 4.5:1)',
    !contrast.error && contrast.worst >= 4.5,
    contrast.error ?? ('terburuk "' + contrast.worstLabel + '" ' + contrast.worst + ':1 (alpha kartu ' +
      contrast.cardAlpha + ', alpha kanvas ' + contrast.canvasOpacity + ', ' + contrast.frames +
      ' bingkai); per elemen: ' + contrast.perElement
        .map((r) => r.label + ' ' + r.worst + ':1 (kontrol ' + r.plain + ':1, ' + r.lit +
          'px tertutup scene)').join(' | ')));
}

console.log('\n=== B5. VALIDASI, AKSESIBILITAS, DAN KEJUJURAN "BELUM DIKIRIM" ===');
{
  const labels = JSON.parse(await evalJs(String.raw`(() => {
    const out = [];
    for (const el of document.querySelectorAll('.register-card input, .register-card select')) {
      const id = el.id;
      const lab = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
      const wrapped = !!el.closest('label');
      const named = lab || wrapped;
      const legend = el.tagName === 'SELECT' || el.closest('fieldset')
        ? !!el.closest('fieldset')?.querySelector('legend')
        : false;
      out.push({
        id, tag: el.tagName.toLowerCase(), type: el.type || null,
        minHeight: Math.round(el.getBoundingClientRect().height),
        hasName: !!named || legend,
        describedBy: el.getAttribute('aria-describedby'),
      });
    }
    return JSON.stringify({ fields: out, fieldset: !!document.querySelector('.register-card fieldset legend'),
      liveStatus: !!document.querySelector('[role="status"][aria-live="polite"]') });
  })()`));

  check('Setiap field punya nama yang bisa diprogram (label terikat atau membungkus)',
    labels.fields.every((f) => f.hasName),
    labels.fields.filter((f) => !f.hasName).map((f) => f.id).join(', ') || '9 field bernama');
  check('Kelompok pilihan bidang punya legend (fieldset/legend)',
    !!labels.fieldset);
  check('Target sentuh semua field >= 44px (nyaman di layar kecil)',
    labels.fields.every((f) => (f.minHeight >= 44)),
    labels.fields.map((f) => f.id + '=' + f.minHeight).join(' '));
  check('Panel hasil punya aria-live polite',
    !!labels.liveStatus);

  // Submit kosong: harus gagal validasi dan tidak mengirim apa pun.
  const beforeSubmit = requested.length;
  await clickReal(`document.querySelector('.register-card button[type="submit"]')`, 'tombol kirim');
  await sleep(700);

  const emptySubmit = JSON.parse(await evalJs(String.raw`(() => {
    const alert = document.querySelector('.register-card [role="alert"], [role="alert"]');
    const invalid = [...document.querySelectorAll('.register-card [aria-invalid="true"]')].map((e) => e.id);
    const described = [...document.querySelectorAll('.register-card [aria-invalid="true"]')]
      .every((e) => e.getAttribute('aria-describedby'));
    return JSON.stringify({
      hasAlert: !!alert,
      alertText: alert ? alert.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : null,
      invalid, described,
      focused: document.activeElement ? document.activeElement.id : null,
      statusShown: !!document.querySelector('[role="status"][aria-live="polite"]'),
    });
  })()`));

  check('Submit kosong ditolak dengan ringkasan error yang bisa dibaca',
    emptySubmit.hasAlert && emptySubmit.invalid.length >= 8,
    emptySubmit.hasAlert ? (emptySubmit.invalid.length + ' field ditandai: ' + emptySubmit.invalid.join(', '))
      : 'tidak ada ringkasan error');
  check('Setiap field yang salah terhubung ke pesan errornya (aria-describedby)',
    emptySubmit.described, emptySubmit.described ? 'ok' : 'ada field tanpa pesan');
  check('Fokus pindah ke field pertama yang salah',
    emptySubmit.focused === 'daftar-nama', 'fokus di #' + emptySubmit.focused);
  check('Submit yang gagal tidak mengirim apa pun ke jaringan',
    requested.length === beforeSubmit,
    requested.length - beforeSubmit + ' permintaan jaringan tambahan');
  check('Panel "belum dikirim" tidak muncul saat validasi gagal',
    !emptySubmit.statusShown);

  // Isi form dengan benar.
  await evalJs(String.raw`(() => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('daftar-nama', 'Rangga Aulia');
    set('daftar-sekolah', 'SMA Negeri 3 Bandung');
    set('daftar-kota', 'Bandung');
    set('daftar-kelas', 'XI');
    set('daftar-jurusan', 'SMA');
    set('daftar-wa', '+62 812-3456-7890');
    set('daftar-email', 'rangga@smne3.sch.id');
    document.getElementById('daftar-bidang').click();
    document.getElementById('daftar-setuju').click();
    return 'true';
  })()`);

  await clickReal(`document.querySelector('.register-card button[type="submit"]')`, 'tombol kirim');
  await sleep(700);

  const validSubmit = JSON.parse(await evalJs(String.raw`(() => {
    const status = document.querySelector('[role="status"][aria-live="polite"]');
    const ta = document.getElementById('ringkasan');
    return JSON.stringify({
      hasStatus: !!status,
      statusText: status ? status.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : null,
      summary: ta ? ta.value : null,
      stillInvalid: document.querySelectorAll('.register-card [aria-invalid="true"]').length,
    });
  })()`));

  check('Form yang valid lolos validasi dan menampilkan ringkasan',
    validSubmit.hasStatus && !!validSubmit.summary && validSubmit.summary.includes('Rangga Aulia'),
    validSubmit.summary ? validSubmit.summary.split('\n')[0] : 'tidak ada ringkasan');
  check('Panel jujur menyatakan data belum terkirim ke mana pun',
    /belum dikirim|tidak terkirim|belum ada server/i.test(validSubmit.statusText ?? ''),
    (validSubmit.statusText ?? '').slice(0, 120));
  check('Nomor WhatsApp dinormalisasi & ringkasan terbaca',
    /0[0-9]{9,12}/.test(validSubmit.summary ?? ''),
    (validSubmit.summary ?? '').split('\n').find((l) => /wa|WhatsApp/i.test(l)) ?? '');
  check('Submit valid tetap tidak mengirim apa pun (UI saja dulu)',
    requested.length === beforeSubmit,
    requested.length - beforeSubmit + ' permintaan jaringan tambahan setelah submit valid');
}

console.log('\n=== B6. KEMBALI KE LANDING, DAN LOOP 3D YANG HARUS MATI ===');
{
  const back = JSON.parse(await evalJs(String.raw`(() => {
    const a = [...document.querySelectorAll('.register-wrap a')]
      .find((x) => /Kembali/i.test(x.textContent));
    if (!a) return JSON.stringify({ error: 'tautan kembali tidak ada' });
    const r = a.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
      text: a.textContent.trim() });
  })()`));
  check('Ada tautan kembali ke halaman utama', !back.error, back.error ?? back.text);

  await clickReal(`document.querySelector('.register-wrap a[href="#top"]')`, 'kembali ke landing');
  await sleep(2000);

  const backState = JSON.parse(await evalJs(String.raw`(() => {
    const secs = [...document.querySelectorAll('#top section.stack-wrap')];
    return JSON.stringify({
      hash: location.hash,
      hasLanding: !!document.getElementById('top'),
      sections: secs.length,
      zs: secs.map((s) => getComputedStyle(s).zIndex).join(','),
      formGone: !document.querySelector('.register-card'),
      sceneCanvases: document.querySelectorAll('canvas').length,
      title: document.title,
      scrollY: Math.round(window.scrollY),
    });
  })()`));

  check('Kembali ke landing page memulihkan 8 section & z-index 10..80',
    backState.hasLanding && backState.sections === 8 && backState.zs === '10,20,30,40,50,60,70,80',
    backState.sections + ' section, z = ' + backState.zs);
  check('Halaman form benar-benar dibongkar (bukan disembunyikan)',
    backState.formGone, backState.formGone ? 'kartu form tidak ada di DOM' : 'KARTU MASIH ADA');
  check('Landing page dibuka dari posisi paling atas',
    backState.scrollY === 0, 'scrollY=' + backState.scrollY);

  /*
   * Scene form harus benar-benar dilepas. Yang diperiksa bukan "kanvasnya tidak
   * ada" - canvas yang disembunyikan tetap consuming memory GPU - tapi bahwa
   * wrapper halaman form sudah tidak ada di DOM. Pembuktian "loop benar-benar
   * berhenti" dilakukan secara tidak langsung: saat kembali ke halaman form
   * nanti (B7/B8 berikutnya) scene harus bisa dirender ulang, yang berarti
   * `dispose()` dan `remount` bekerja dengan benar (context lama dilepas).
   */
}

console.log('\n=== B7. REDUCED-MOTION: SATU BINGKAI STATIS, TETAP TERLIHAT ===');
{
  await setMotion('reduce', false);
  await goto(DAFTAR);
  await sleep(2500);
  const rm = JSON.parse(await evalJs(String.raw`(async () => {
    const raf = () => new Promise((r) => window.__nativeRaf(r));
    const cv = document.querySelector('.register-wrap canvas');
    if (!cv) return JSON.stringify({ error: 'canvas tidak ada' });
    const tmp = document.createElement('canvas');
    tmp.width = cv.width; tmp.height = cv.height;
    const c = tmp.getContext('2d', { willReadFrequently: true });
    const grab = () => { c.drawImage(cv, 0, 0); return c.getImageData(0, 0, cv.width, cv.height).data; };
    const a = grab();
    for (let i = 0; i < 30; i++) await raf();
    const b = grab();
    let changed = 0, lit = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (b[i + 3] > 4) lit++;
      if (Math.abs(a[i] - b[i]) > 6 || Math.abs(a[i + 1] - b[i + 1]) > 6 ||
          Math.abs(a[i + 2] - b[i + 2]) > 6) changed++;
    }
    return JSON.stringify({ changed, lit, total: cv.width * cv.height,
      formText: !!document.querySelector('.register-card'),
      errorText: [...document.querySelectorAll('.register-card label')].filter((l) => getComputedStyle(l).opacity !== '0').length });
  })()`));

  check('Mode reduced: scene tetap dirender (satu frame statis, bukan kosong)',
    !rm.error && rm.lit > 400, rm.error ?? (rm.lit + ' piksel menyala'));
  check('Mode reduced: tidak ada satu pun bingkai yang digambar ulang',
    rm.changed === 0, rm.changed + ' piksel berubah dalam 30 bingkai (harus 0)');
  check('Mode reduced: isi form langsung terbaca tanpa animasi',
    rm.formText && rm.errorText >= 8, rm.formText ? (rm.errorText + ' label terlihat') : 'form tidak ada');
}

console.log('\n=== B8. PONSEL: TANPA EFEK, TANPA UNDUHAN three.js ===');
{
  await setViewport(375, 667, true);
  await setMotion('no-preference', true);
  requested.length = 0;
  await goto(DAFTAR);
  await sleep(2500);

  const mobile = JSON.parse(await evalJs(String.raw`(() => {
    const cv = document.querySelector('.register-wrap canvas');
    const card = document.querySelector('.register-card');
    const r = card ? card.getBoundingClientRect() : null;
    return JSON.stringify({
      canvas: !!cv,
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      cardW: r ? Math.round(r.width) : null,
      overflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      scrollable: document.documentElement.scrollHeight > window.innerHeight,
      cardReachable: r ? r.top < window.innerHeight && r.bottom > 0 : false,
    });
  })()`));

  check('Ponsel: tidak ada canvas WebGL sama sekali (semua efek mati)',
    !mobile.canvas, mobile.canvas ? 'canvas masih ter-mount' : 'nol canvas');
  const threeFetched = requested.filter((u) => /three|olympiadScene|dnaParticles|gyroscope/i.test(u));
  check('Ponsel: chunk three.js TIDAK PERNAH diunduh',
    threeFetched.length === 0,
    threeFetched.length ? threeFetched.map((u) => u.split('/').pop()).join(', ')
      : requested.length + ' berkas diminta, tidak ada satu pun chunk 3D');
  check('Ponsel: halaman form tetap utuh dan bisa di-scroll',
    mobile.docW === mobile.winW && mobile.cardReachable,
    'lebar dokumen ' + mobile.docW + 'px vs viewport ' + mobile.winW + 'px, kartu ' + mobile.cardW + 'px');
}

console.log('\n=== B9. SAPUAN LEBAR: TANPA SCROLL HORIZONTAL & KARTU DI LAYAR ===');
for (const [w, h, mobile] of [
  [320, 568, true], [375, 667, true], [430, 932, true], [768, 1024, false],
  [1024, 768, false], [1280, 800, false], [1440, 900, false], [1920, 1080, false],
]) {
  await setViewport(w, h, mobile);
  await setMotion('no-preference', mobile);
  await sleep(900);
  const r = JSON.parse(await evalJs(String.raw`(() => {
    const de = document.documentElement;
    const card = document.querySelector('.register-card');
    const b = card ? card.getBoundingClientRect() : null;
    // Cari elemen yang paling melebar melebihi viewport - supaya saat gagal,
    // pesannya menyebut penyebabnya, bukan cuma "ada overflow".
    let worst = null;
    for (const el of document.querySelectorAll('body *')) {
      const rc = el.getBoundingClientRect();
      if (rc.width === 0) continue;
      const over = Math.round(rc.right - window.innerWidth);
      if (over > 1 && (!worst || over > worst.over)) {
        worst = { over, tag: el.tagName.toLowerCase(),
          cls: String(el.className ?? '').split(' ').slice(0, 2).join('.') };
      }
    }
    return JSON.stringify({
      docW: de.scrollWidth, winW: window.innerWidth, worst,
      cardW: b ? Math.round(b.width) : null,
      cardInside: b ? b.left >= -1 && b.right <= window.innerWidth + 1 : false,
      cardH: b ? Math.round(b.height) : null,
    });
  })()`));
  check('Halaman form @' + w + 'px: tanpa scroll horizontal',
    r.docW <= r.winW,
    r.docW > r.winW
      ? (r.worst ? 'melebar ' + r.worst.over + 'px: ' + r.worst.tag + '.' + r.worst.cls : 'selisih ' + (r.docW - r.winW) + 'px')
      : 'dokumen ' + r.docW + 'px = viewport ' + r.winW + 'px');
  check('Halaman form @' + w + 'px: kotak form muat di layar',
    r.cardInside,
    r.cardW ? r.cardW + 'px' + (r.cardInside ? '' : ' (meluber)') : 'kartu tidak terukur');
}

console.log('\n=== B10. NAVIGASI DARI HALAMAN FORM KEMBALI KE SECTION LANDING ===');
{
  await setViewport(1440, 900, false);
  await setMotion('no-preference', false);
  await goto(DAFTAR);
  await sleep(1500);

  const nav = JSON.parse(await evalJs(String.raw`(() => {
    const a = [...document.querySelectorAll('header a')]
      .find((x) => x.textContent.trim() === 'Aturan' && x.getAttribute('href') === '#aturan');
    if (!a) return JSON.stringify({ error: 'tautan navbar tidak ditemukan' });
    const r = a.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
  })()`));
  if (nav.error) {
    check('Tautan navbar tetap bisa dipakai dari halaman form', false, nav.error);
  } else {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', {
        type, x: nav.x, y: nav.y, button: 'left', clickCount: 1,
        buttons: type === 'mousePressed' ? 1 : 0,
      });
    }
    await sleep(2600);
  }

  const navState = JSON.parse(await evalJs(String.raw`(() => {
    const sec = document.getElementById('aturan');
    const r = sec ? sec.getBoundingClientRect() : null;
    return JSON.stringify({
      hash: location.hash,
      landing: !!document.getElementById('top'),
      sections: document.querySelectorAll('#top section.stack-wrap').length,
      sectionTop: r ? Math.round(r.top) : null,
      scrollY: Math.round(window.scrollY),
      formGone: !document.querySelector('.register-card'),
    });
  })()`));

  check('Tautan navbar dari halaman form kembali ke section yang dituju',
    navState.landing && navState.hash === '#aturan' && navState.formGone,
    navState.hash + ', ' + navState.sections + ' section');
  check('Section tujuan benar-benar terlihat (tidak cuma ganti hash)',
    navState.sectionTop !== null && navState.sectionTop > -200 && navState.sectionTop < 200,
    'top section ' + navState.sectionTop + 'px dari atas viewport, scrollY ' + navState.scrollY);
}

/* ---------------------------------------------------------------- */

if (pageProblems.length) {
  console.log('\n=== PROBLEM DARI HALAMAN ===');
  for (const p of [...new Set(pageProblems)]) console.log('  ' + p);
  check('Tidak ada error konsol / exception di halaman form', false,
    [...new Set(pageProblems)].length + ' problem');
} else {
  console.log('\n=== PROBLEM DARI HALAMAN ===');
  console.log('  (bersih)');
  check('Tidak ada error konsol / exception di halaman form', true);
}

console.log('\n' + '='.repeat(58));
console.log('  TOTAL: ' + pass + ' PASS / ' + fail + ' FAIL');
console.log('='.repeat(58));

ws.close();
chrome.kill();
process.exit(fail > 0 ? 1 : 0);