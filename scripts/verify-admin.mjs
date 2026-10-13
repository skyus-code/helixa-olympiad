/**
 * Verifikasi panel admin (route hash `#admin`).
 *
 * KENAPA UJI INI BUTUH API DAN DATABASE
 * -------------------------------------
 * Panel admin bukan halaman statis: seluruh gunanya adalah mengubah data, jadi
 * mengujinya tanpa server hanya akan membuktikan bahwa halaman login bisa
 * digambar. Karena itu uji ini menuntut `npm run api` (dan MySQL) hidup, lalu
 * MEMBUKTIKAN PERUBAHANNYA SAMPAI KE HALAMAN PUBLIK - bukan sekadar bahwa
 * tombol Simpan menjawab "Tersimpan":
 *
 *   1. tanggal "Pendaftaran" diganti, disimpan, lalu dibaca lagi dari section
 *      Perdana di halaman utama;
 *   2. seorang juri ditambahkan, muncul di section "Juri & Mitra", lalu dihapus;
 *   3. satu pendaftaran baru muncul di tab "Pendaftar".
 *
 * KENAPA SEMUA YANG DIUBAH DIKEMBALIKAN LEWAT API, BUKAN LEWAT HALAMAN
 * --------------------------------------------------------------------
 * Database ini milik orang, bukan milik uji. Kalau pemulihannya dilakukan
 * dengan mengklik panel lagi, satu kegagalan di tengah (Chrome mati, skrip
 * dihentikan) meninggalkan tanggal karangan yang tayang di halaman publik.
 * Pemulihan di sini dijalankan dari Node lewat API yang sama, setelah blok
 * browser selesai - jadi tidak bergantung pada halaman yang mungkin sudah
 * tidak bisa dipakai. Kalau prosesnya dihentikan paksa, baris uji masih bisa
 * dikenali dari penandanya: `UJI <stempel>` dan email `uji.admin.*`.
 *
 * Jalankan: node scripts/verify-admin.mjs [url]   (setelah `npm run build`
 *           dan `npm run api`)
 */
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = process.cwd();
const BASE = (process.argv[2] ?? 'http://localhost:4200/').replace(/#.*$/, '');
const ADMIN = BASE + '#admin';
const PORT = 9230;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const API = process.env.API_URL ?? 'http://localhost:4000';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'helixa2026';

/** Penanda yang gampang dikenali dan dibersihkan, dan tidak mungkin bentrok. */
const STAMP = String(Date.now()).slice(-6);
const DATE_SENTINEL = 'UJI ' + STAMP;
const PERSON_SENTINEL = 'Juri Uji ' + STAMP;
const REG_EMAIL = 'uji.admin.' + STAMP + '@example.com';

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

/* ==================================================================
   API (dipakai untuk memulihkan keadaan dan memeriksa dari sisi data)
   ================================================================== */

async function apiCall(path, init = {}) {
  const headers = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.token) headers.authorization = 'Bearer ' + init.token;
  try {
    const res = await fetch(API + path, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

const health = await apiCall('/api/health');
if (!health.ok || health.data?.ok !== true) {
  console.log('\nAPI/database tidak hidup (' + health.status + '). Panel admin tidak bisa diuji tanpa keduanya.');
  console.log('Jalankan `npm run api` lebih dulu, lalu ulangi. Tidak ada pemeriksaan yang dijalankan.');
  process.exit(1);
}

const login = await apiCall('/api/admin/login', { method: 'POST', body: { password: PASSWORD } });
const TOKEN = login.data?.token ?? '';
if (!TOKEN) {
  console.log('\nLogin API gagal. Periksa ADMIN_PASSWORD di .env (dipakai uji ini: ' + (PASSWORD === 'helixa2026' ? 'nilai bawaan' : 'nilai dari lingkungan') + ').');
  process.exit(1);
}

const contentBefore = await apiCall('/api/content');
const SETTINGS_BEFORE = contentBefore.data?.settings ?? {};

/**
 * Memulihkan keadaan awal. Dipanggil sekali di akhir, apa pun hasilnya.
 *
 * `PUT /api/admin/settings` hanya menerima kunci yang dikenal server, jadi
 * mengirim seluruh isi `settingsBefore` aman - kunci asing tidak akan masuk.
 */
async function restore() {
  const lines = [];
  if (Object.keys(SETTINGS_BEFORE).length > 0) {
    const put = await apiCall('/api/admin/settings', {
      method: 'PUT',
      token: TOKEN,
      body: { values: SETTINGS_BEFORE },
    });
    lines.push('tanggal/hadiah: ' + (put.ok ? 'dipulihkan (' + put.data?.updated + ' kunci)' : 'GAGAL (' + put.status + ')'));
  }

  const after = await apiCall('/api/content');
  for (const person of after.data?.people ?? []) {
    if (String(person.name).includes('Uji ' + STAMP)) {
      const del = await apiCall('/api/admin/people/' + person.id, { method: 'DELETE', token: TOKEN });
      lines.push('orang uji #' + person.id + ': ' + (del.ok ? 'dihapus' : 'GAGAL (' + del.status + ')'));
    }
  }

  try {
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'helixa_olympiad',
    });
    const [res] = await conn.execute('DELETE FROM `registrations` WHERE `email` = ?', [REG_EMAIL]);
    await conn.end();
    lines.push('pendaftar uji: ' + res.affectedRows + ' baris dihapus');
  } catch {
    lines.push('pendaftar uji: database tidak bisa dihubungi dari skrip ini, periksa manual ' + REG_EMAIL);
  }

  console.log('\n== PEMULIHAN ==');
  for (const l of lines) console.log('  ' + l);
}

/* ==================================================================
   A. STATIS
   ================================================================== */

console.log('\n=== A1. ROUTE & RAHASIA HALAMAN ===');
{
  const src = join(ROOT, 'src');
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(src);

  const routeFile = files.find((f) => f.endsWith('useHashRoute.ts'));
  const routeText = readFileSync(routeFile, 'utf8');
  check("Hash route 'admin' terdaftar", /admin:\s*'admin'/.test(routeText));

  /*
   * Tidak ada jalan menuju halaman ini dari halaman publik. Bukan karena
   * keamanan (token di server yang menjaga), tapi supaya pengunjung tidak
   * pernah mendarat di alat kerja pengurus.
   */
  const linked = files
    .map((f) => ({ rel: f.replace(ROOT, '').replace(/\\/g, '/'), text: readFileSync(f, 'utf8') }))
    .filter((f) => /href\s*=\s*["']#admin/.test(f.text))
    .map((f) => f.rel);
  const htmlLinked = /href\s*=\s*["']#admin/.test(readFileSync(join(ROOT, 'index.html'), 'utf8'));
  check('Tidak ada tautan ke #admin dari halaman publik',
    linked.length === 0 && !htmlLinked,
    linked.length ? 'DITEMUKAN di ' + linked.join(', ') : (htmlLinked ? 'index.html menautkannya' : 'nol tautan'));

  const panel = readFileSync(files.find((f) => f.endsWith('AdminPanel.tsx')), 'utf8');
  check('Panel memuat ulang konten situs setelah menyimpan', /reloadContent\(\)/.test(panel));

  /*
   * Urutannya yang diuji, bukan keberadaan pemanggilannya: kirim ke server,
   * periksa kegagalan, BARU tandai tersimpan. Kalau tandanya dipasang sebelum
   * jawaban server datang, panel akan bilang "Tersimpan" untuk perubahan yang
   * ditolak - dan itu justru kesalahan yang paling mahal di halaman ini.
   */
  const saveAt = panel.indexOf('await saveSettings(');
  const failAt = panel.indexOf('if (!reply.ok)');
  const okAt = panel.indexOf('setSaved(true)');
  check('Panel menunggu jawaban server dulu, baru menyatakan tersimpan',
    saveAt > 0 && failAt > saveAt && okAt > failAt,
    'kirim@' + saveAt + ' periksa@' + failAt + ' tersimpan@' + okAt);
}

/* ==================================================================
   B. BROWSER
   ================================================================== */

console.log('\n=== B. PANEL ADMIN DI BROWSER ===');

const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--hide-scrollbars', '--no-sandbox',
    '--no-first-run', '--force-color-profile=srgb',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=` + process.env.TEMP + '\\helixa-admin-profile',
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

try {
  const t = await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(ADMIN)}`, { method: 'PUT' })
  ).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pend = new Map();
  const waiters = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) {
      const { resolve, reject } = pend.get(m.id);
      pend.delete(m.id);
      if (m.error) reject(new Error(m.error.message));
      else resolve(m.result);
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
  const withTimeout = (promise, ms, what) =>
    Promise.race([
      promise,
      sleep(ms).then(() => {
        throw new Error('Timeout ' + ms + 'ms sambil menunggu ' + what);
      }),
    ]);

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error(
        (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text) + ' :: ' + expression.slice(0, 140),
      );
    }
    return r.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');

  /**
   * Navigasi yang SELALU menghasilkan dokumen baru.
   *
   * Sama alasannya dengan verify-daftar: `#top` -> `#admin` adalah perubahan
   * dalam dokumen yang sama bagi Chrome, jadi `Page.loadEventFired` tidak
   * pernah datang dan semua blok setelahnya tidak pernah dijalankan. Query
   * string dipakai sebagai pemaksa; hash tetap dibawa apa adanya.
   */
  async function goto(url) {
    let current = '';
    try {
      current = await evalJs('location.href');
    } catch {
      /* belum ada dokumen */
    }
    const loaded = withTimeout(once('Page.loadEventFired'), 25000, 'Page.loadEventFired untuk ' + url);
    const strip = (u) => u.replace(/#.*$/, '').replace(/[?&]nav=\d+/, '');
    let target = url;
    if (current !== '' && strip(current) === strip(url)) {
      const [pq, hash] = url.split('#');
      target = pq + (pq.includes('?') ? '&' : '?') + 'nav=' + Date.now() + (hash ? '#' + hash : '');
    }
    await send('Page.navigate', { url: target });
    await loaded;
    await sleep(1800);
    await evalJs("document.documentElement.style.scrollBehavior='auto'; true;");
  }

  /** Set nilai input/textarea lewat setter native supaya React melihatnya. */
  const setField = (selector, value) =>
    evalJs(
      "(() => { const el = document.querySelector(" + JSON.stringify(selector) + ');' +
      ' if (!el) return false;' +
      " const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;" +
      " Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, " + JSON.stringify(value) + ');' +
      " el.dispatchEvent(new Event('input', { bubbles: true }));" +
      " el.dispatchEvent(new Event('change', { bubbles: true }));" +
      ' return true; })()',
    );

  const click = (selector) =>
    evalJs(
      '(() => { const el = document.querySelector(' + JSON.stringify(selector) + ');' +
      ' if (!el) return false; el.click(); return true; })()',
    );

  /* ---- B1. landing masih punya navbar, admin tidak ---------------- */
  await goto(BASE + '#top');
  const landing = JSON.parse(await evalJs(String.raw`(() => {
    return JSON.stringify({
      navbar: !!document.querySelector('header nav[aria-label="Navigasi utama"]'),
      main: !!document.getElementById('top'),
      panel: !!document.getElementById('admin-panel'),
    });
  })()`));
  check('Landing page tetap memakai navbar', landing.navbar && landing.main,
    'navbar=' + landing.navbar + ' main=' + landing.main);
  check('Panel admin tidak ada di landing page', !landing.panel);

  await goto(ADMIN);
  const adminPage = JSON.parse(await evalJs(String.raw`(() => {
    const panel = document.getElementById('admin-panel');
    return JSON.stringify({
      panel: !!panel,
      navbar: !!document.querySelector('header nav[aria-label="Navigasi utama"]'),
      login: !!document.getElementById('admin-password'),
      title: document.title,
    });
  })()`));
  check('#admin membuka panel admin', adminPage.panel);
  check('Panel admin TIDAK memakai navbar landing', !adminPage.navbar);
  check('Belum masuk: yang tampil form password', adminPage.login);
  check('Judul tab mengikuti halaman', /Panel Admin/.test(adminPage.title), adminPage.title);

  /* ---- B2. password salah ditolak --------------------------------- */
  await setField('#admin-password', 'jelas-salah-' + STAMP);
  await click('form[class*="register-card"] button[type="submit"]');
  await sleep(900);
  const wrong = JSON.parse(await evalJs(String.raw`(() => {
    const err = document.querySelector('[role="alert"]');
    return JSON.stringify({
      alert: err ? err.textContent.replace(/\s+/g, ' ').trim() : null,
      tabs: document.querySelectorAll('[role="tab"]').length,
      stillLogin: !!document.getElementById('admin-password'),
    });
  })()`));
  check('Password salah: pesan galat, bukan masuk', !!wrong.alert && wrong.tabs === 0 && wrong.stillLogin,
    (wrong.alert ?? 'tidak ada pesan').slice(0, 90));

  /* ---- B3. password benar -> dasbor ------------------------------- */
  await setField('#admin-password', PASSWORD);
  await click('form[class*="register-card"] button[type="submit"]');
  await sleep(1200);
  const loggedIn = JSON.parse(await evalJs(String.raw`(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')].map((b) => b.textContent.trim());
    let token = null;
    try { token = window.localStorage.getItem('helixa.admin.token'); } catch { /* diblokir */ }
    return JSON.stringify({
      tabs,
      loginGone: !document.getElementById('admin-password'),
      hasToken: !!token && token.includes('.'),
    });
  })()`));
  check('Password benar: dasbor dengan 3 tab', loggedIn.tabs.length === 3 && loggedIn.loginGone,
    loggedIn.tabs.join(' | '));
  check('Token login disimpan di browser', loggedIn.hasToken);

  /* ---- B4. tanggal disimpan, terbaca di halaman publik ------------ */
  await setField('#setting-0', DATE_SENTINEL);
  await click('button[type="submit"]');
  await sleep(1300);
  const saved = JSON.parse(await evalJs(String.raw`(() => {
    const st = document.querySelector('[role="status"]');
    return JSON.stringify({ status: st ? st.textContent.replace(/\s+/g, ' ').trim() : null,
      justSaved: st ? st.getAttribute('role') : null });
  })()`));
  check('Panel melaporkan perubahan tersimpan', /tersimpan/i.test(saved.status ?? ''),
    (saved.status ?? 'tidak ada laporan').slice(0, 80));

  const inDb = (await apiCall('/api/content')).data?.settings?.['perdana.pendaftaran'];
  check('Nilai baru benar-benar ada di database', inDb === DATE_SENTINEL,
    'database: ' + JSON.stringify(inDb));

  await goto(BASE + '#top');
  const shownDate = await evalJs(String.raw`(() => {
    const dt = [...document.querySelectorAll('dt')].find((d) => d.textContent.trim() === 'Pendaftaran');
    if (!dt) return null;
    const dd = dt.parentElement.querySelector('dd');
    return dd ? dd.textContent.trim() : null;
  })()`);
  check('Tanggal yang diedit tampil di section Perdana halaman utama',
    shownDate === DATE_SENTINEL, 'terbaca: ' + JSON.stringify(shownDate));

  /* ---- B5. juri ditambah, tampil di publik, lalu dihapus ---------- */
  await goto(ADMIN);
  await click('[role="tab"]:nth-of-type(2)');
  await sleep(600);
  await setField('[aria-label="Nama"]', PERSON_SENTINEL);
  await setField('[aria-label="Keterangan"]', 'Ditambahkan oleh verify-admin');
  await click('form[class*="border-dashed"] button[type="submit"]');
  await sleep(1300);

  const afterAdd = JSON.parse(await evalJs(String.raw`(() => {
    /*
     * Nama juri ada di atribut value sebuah <input> (editor baris), jadi
     * textContent tidak akan pernah memuatnya - nilai input bukan teks dokumen.
     */
    const names = [...document.querySelectorAll('input[id^="person-"][id$="-name"]')]
      .map((el) => el.value);
    return JSON.stringify({
      inPanel: names.includes(${JSON.stringify(PERSON_SENTINEL)}),
      rows: names.length,
      names,
    });
  })()`));
  check('Juri baru muncul di daftar panel', afterAdd.inPanel && afterAdd.rows >= 1,
    afterAdd.rows + ' baris editor: ' + afterAdd.names.join(', '));

  const inDbPerson = ((await apiCall('/api/content')).data?.people ?? [])
    .find((p) => p.name === PERSON_SENTINEL);
  check('Juri baru benar-benar ada di database', !!inDbPerson,
    inDbPerson ? 'id=' + inDbPerson.id + ' monogram=' + inDbPerson.monogram : 'tidak ditemukan');

  await goto(BASE + '#top');
  const inPublic = JSON.parse(await evalJs(String.raw`(() => {
    const sec = document.getElementById('juri');
    return JSON.stringify({ text: sec ? sec.textContent.replace(/\s+/g, ' ') : '' });
  })()`));
  check('Juri baru tampil di section "Juri & Mitra" halaman utama',
    inPublic.text.includes(PERSON_SENTINEL),
    inPublic.text.includes(PERSON_SENTINEL) ? 'ditemukan di section #juri' : 'TIDAK ditemukan');

  /* ---- B6. pendaftar muncul di tab ketiga ------------------------- */
  const seeded = await apiCall('/api/register', {
    method: 'POST',
    body: {
      nama: 'Pendaftar Uji Admin',
      sekolah: 'SMA Uji',
      kota: 'Bandung',
      kelas: 'XI',
      jurusan: 'SMA',
      wa: '081200000000',
      email: REG_EMAIL,
      bidang: 'Biologi',
      setuju: true,
    },
  });
  check('Pendaftaran contoh tersimpan lewat API', seeded.ok, 'status=' + seeded.status);

  await goto(ADMIN);
  await click('[role="tab"]:nth-of-type(3)');
  await sleep(1500);
  const table = JSON.parse(await evalJs(String.raw`(() => {
    const rows = [...document.querySelectorAll('table tbody tr')];
    return JSON.stringify({
      rows: rows.length,
      text: document.body.textContent.replace(/\s+/g, ' '),
    });
  })()`));
  check('Tab "Pendaftar" memuat tabel pendaftar', table.rows >= 1, table.rows + ' baris');
  check('Email pendaftar uji tampil di tabel', table.text.includes(REG_EMAIL));

  /* ---- B7. keluar membersihkan token ----------------------------- */
  await evalJs(String.raw`(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.trim() === 'Keluar');
    if (!b) return false;
    b.click();
    return true;
  })()`);
  await sleep(700);
  const afterLogout = JSON.parse(await evalJs(String.raw`(() => {
    let token = 'x';
    try { token = window.localStorage.getItem('helixa.admin.token'); } catch { /* diblokir */ }
    return JSON.stringify({ login: !!document.getElementById('admin-password'), token });
  })()`));
  check('Keluar mengembalikan ke form password & menghapus token',
    afterLogout.login && !afterLogout.token, 'token=' + JSON.stringify(afterLogout.token));

  await send('Browser.close').catch(() => {});
} catch (err) {
  check('Blok browser selesai tanpa error', false, String(err && err.message ? err.message : err));
} finally {
  await restore();
  try {
    chrome.kill();
  } catch {
    /* sudah mati */
  }
}

console.log('\n  TOTAL: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail > 0 ? 1 : 0);
