/**
 * Verifikasi API dan database Helixa Olympiad.
 *
 * KENAPA ADA UJI TERPISAH UNTUK API
 * ---------------------------------
 * `verify-admin.mjs` menguji panel admin lewat browser, dan itu memang yang
 * dirasakan pengurus. Tapi panel itu bisa lolos semua pemeriksaannya sementara
 * lapisan di bawahnya tetap salah: nomor WhatsApp yang tidak dinormalisasi,
 * pendaftar ganda yang lolos, atau `settings` yang menerima kunci sembarang.
 * Semuanya tidak kelihatan dari layar - dan justru itu yang paling lama tidak
 * ketahuan, karena yang tampil tetap benar.
 *
 * Uji ini menembak API langsung (tanpa browser): alur publik, alur admin,
 * kasus gagal, dan bentuk data yang tersimpan. Termasuk yang sengaja tidak
 * diuji dari browser: token palsu, kunci `settings` yang tidak dikenal, dan
 * pendaftar ganda (email + bidang yang sama).
 *
 * PRASYARAT
 * ---------
 * MySQL hidup dan `npm run api` berjalan. Kalau tidak, skrip ini berhenti
 * dengan pesan yang jelas alih-alih melaporkan kegagalan yang menyesatkan.
 *
 * SISA DATA
 * ---------
 * Semua baris yang dibuat di sini memakai email uji berawalan `uji+` dan
 * dihapus di akhir. Nilai `settings` yang sempat diubah dikembalikan seperti
 * semula, termasuk kalau uji gagal di tengah.
 *
 * Jalankan: npm run check:api
 */
import { setTimeout as sleep } from 'node:timers/promises';

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'helixa2026';
const DB_NAME = process.env.DB_NAME ?? 'helixa_olympiad';

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

async function call(path, init = {}) {
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
    const raw = await res.text();
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
    }
    return { ok: res.ok, status: res.status, data, raw };
  } catch {
    return { ok: false, status: 0, data: null, raw: '' };
  }
}

/** Akses MySQL langsung, hanya untuk memeriksa/membersihkan data. */
async function withDb(fn) {
  const mysql = await import('mysql2/promise');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: DB_NAME,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

/* ================================================================== */

console.log('\n=== A. KESEHATAN & DATA PUBLIK ===');

const health = await call('/api/health');
if (!health.ok || health.data?.ok !== true) {
  console.log('\nAPI/database tidak hidup (status ' + health.status + '). Jalankan `npm run api` lebih dulu.');
  process.exit(1);
}
check('GET /api/health ok dan menyebut database', health.data?.database === DB_NAME, 'database=' + health.data?.database);

const content = await call('/api/content');
check('GET /api/content mengembalikan settings + people',
  content.ok && content.data?.settings && Array.isArray(content.data?.people),
  'status=' + content.status);
const SETTINGS_BEFORE = content.data?.settings ?? {};
check('settings awal memuat 4 kunci tanggal/hadiah',
  Object.keys(SETTINGS_BEFORE).length === 4, Object.keys(SETTINGS_BEFORE).sort().join(', '));

/*
 * Nomor WA dinormalisasi ke 62.... Yang menjamin ini BUKAN klien: formulir
 * mengirim apa yang diketik user. Jadi kalau server berhenti menormalkan,
 * yang rusak adalah semua data setelahnya, dan tidak ada satu pun pesan error
 * yang muncul. Karena itu diuji dari sini.
 */
const WA_INPUT = '+62 812-3456-7890';
const WA_EXPECTED = '6281234567890';

/* ================================================================== */

console.log('\n=== B. ADMIN: LOGIN & TOKEN ===');

const wrong = await call('/api/admin/login', { method: 'POST', body: { password: 'salah-' + Date.now() } });
check('Password salah ditolak (401)', wrong.status === 401, 'status=' + wrong.status);

const noToken = await call('/api/admin/registrations');
check('Endpoint admin menolak tanpa token (401)', noToken.status === 401, 'status=' + noToken.status);

const login = await call('/api/admin/login', { method: 'POST', body: { password: PASSWORD } });
const TOKEN = login.data?.token ?? '';
check('Password benar mengembalikan token bertanda tangan',
  login.ok && TOKEN.includes('.') && TOKEN.length > 40, 'panjang ' + TOKEN.length);

const forged = await call('/api/admin/session', { token: '9999999999999.abcdef' });
check('Token bikin-bikin ditolak (401)', forged.status === 401, 'status=' + forged.status);

const session = await call('/api/admin/session', { token: TOKEN });
check('Token asli diterima', session.ok, 'status=' + session.status);

/* ================================================================== */

console.log('\n=== C. ADMIN: SETTINGS ===');

const badKey = await call('/api/admin/settings', {
  method: 'PUT',
  token: TOKEN,
  body: { values: { 'perdana.pendaftaran': '1 - 20 November 2026', 'kunci.tidak.dikenal': 'abaikan' } },
});
check('Kunci asing diabaikan, bukan disimpan',
  badKey.ok && badKey.data?.updated === 1, 'updated=' + badKey.data?.updated);

const afterPut = await call('/api/content');
check('Nilai baru terbaca di API publik',
  afterPut.data?.settings?.['perdana.pendaftaran'] === '1 - 20 November 2026',
  afterPut.data?.settings?.['perdana.pendaftaran']);
check('Kunci asing tidak pernah muncul', afterPut.data?.settings?.['kunci.tidak.dikenal'] === undefined);
check('Kunci lain tidak ikut berubah',
  afterPut.data?.settings?.['perdana.pelaksanaan'] === SETTINGS_BEFORE['perdana.pelaksanaan']);

/* ================================================================== */

console.log('\n=== D. ADMIN: JURI & MITRA ===');

const created = await call('/api/admin/people', {
  method: 'POST',
  token: TOKEN,
  body: { kind: 'juri', name: 'Uji Coba API', role: 'Penguji', monogram: '' },
});
const PERSON_ID = created.data?.id;
check('Tambah orang berhasil (201)', created.status === 201 && PERSON_ID > 0, 'id=' + PERSON_ID);

const afterCreate = await call('/api/content');
const person = (afterCreate.data?.people ?? []).find((p) => p.id === PERSON_ID);
check('Inisial diisi otomatis dari nama kalau kosong', person?.monogram === 'U', 'monogram=' + JSON.stringify(person?.monogram));

const invalid = await call('/api/admin/people', {
  method: 'POST',
  token: TOKEN,
  body: { kind: 'ngawur', name: '' },
});
check('Jenis yang tidak dikenal ditolak (400)', invalid.status === 400, 'status=' + invalid.status);

const updated = await call('/api/admin/people/' + PERSON_ID, {
  method: 'PUT',
  token: TOKEN,
  body: { kind: 'mitra', name: 'Uji Coba API Dua', role: 'Mitra', monogram: 'Z' },
});
check('Ubah orang berhasil', updated.ok, 'status=' + updated.status);

const deleted = await call('/api/admin/people/' + PERSON_ID, { method: 'DELETE', token: TOKEN });
check('Hapus orang berhasil', deleted.ok && deleted.data?.deleted === 1, 'deleted=' + deleted.data?.deleted);

/* ================================================================== */

console.log('\n=== E. PENDAFTARAN: VALIDASI, SIMPAN, & GANDA ===');

const EMAIL = 'uji+' + Date.now() + '@example.com';

const badBody = await call('/api/register', {
  method: 'POST',
  body: { nama: '', sekolah: '', kota: '', kelas: 'XIII', jurusan: 'SMA', wa: '123', email: 'bukan-email', bidang: 'Fisika', setuju: false },
});
check('Kiriman tidak lengkap ditolak (400)', badBody.status === 400, 'status=' + badBody.status);
check('Kesalahan dilaporkan per-field',
  !!badBody.data?.fields?.email && !!badBody.data?.fields?.bidang && !!badBody.data?.fields?.wa,
  Object.keys(badBody.data?.fields ?? {}).join(', '));

/** Isi form yang sah. Dipakai berkali-kali, dengan bidang yang bisa diganti. */
const validBody = (bidang) => ({
  nama: 'Uji Coba API',
  sekolah: 'SMA Negeri 1 Uji',
  kota: 'Bandung',
  kelas: 'XI',
  jurusan: 'SMA',
  wa: WA_INPUT,
  email: EMAIL,
  bidang,
  setuju: true,
});

const saved = await call('/api/register', { method: 'POST', body: validBody('Matematika') });
check('Pendaftaran sah tersimpan (201) dan mengembalikan id', saved.status === 201 && saved.data?.id > 0, 'id=' + saved.data?.id);

const stored = await withDb((conn) =>
  conn.execute('SELECT `wa`, `bidang`, `setuju` FROM `registrations` WHERE `email` = ?', [EMAIL]),
).then(([rows]) => rows[0] ?? null);

check('Nomor WhatsApp dinormalisasi ke 62... saat disimpan', stored?.wa === WA_EXPECTED, 'tersimpan: ' + stored?.wa);
check('Bidang tersimpan apa adanya', stored?.bidang === 'Matematika', stored?.bidang);
check('Persetujuan aturan tersimpan sebagai angka 1', Number(stored?.setuju) === 1, 'setuju=' + stored?.setuju);

const dup = await call('/api/register', { method: 'POST', body: validBody('Matematika') });
check('Email yang sama + bidang yang sama ditolak (409)', dup.status === 409 && dup.data?.duplicate === true, 'status=' + dup.status);

const otherField = await call('/api/register', { method: 'POST', body: validBody('Biologi') });
check('Email yang sama di bidang BERBEDA tetap diterima (201)', otherField.status === 201, 'status=' + otherField.status);

/* ================================================================== */

console.log('\n=== F. ADMIN: DAFTAR & CSV ===');

const list = await call('/api/admin/registrations', { token: TOKEN });
const mine = (list.data?.registrations ?? []).filter((r) => r.email === EMAIL);
check('Daftar pendaftar memuat baris uji', list.ok && mine.length === 2, 'total=' + list.data?.total + ', uji=' + mine.length);
check('Nomor WA pada daftar sudah ternormalisasi', mine.every((r) => r.wa === WA_EXPECTED), mine.map((r) => r.wa).join(', '));
check('Baris terbaru muncul lebih dulu (urut menurun)',
  (list.data?.registrations ?? []).every((r, i, all) => i === 0 || all[i - 1].id >= r.id));

const csvRes = await fetch(API + '/api/admin/registrations.csv', { headers: { authorization: 'Bearer ' + TOKEN } });
const csvBytes = new Uint8Array(await csvRes.arrayBuffer());
const csvText = new TextDecoder().decode(csvBytes);
check('CSV diekspor sebagai unduhan',
  csvRes.ok && /attachment/i.test(csvRes.headers.get('content-disposition') ?? ''),
  csvRes.headers.get('content-disposition'));
check('CSV diawali BOM UTF-8 (Excel membaca aksara non-ASCII dengan benar)',
  csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf,
  'byte awal: ' + csvBytes.slice(0, 3).join(','));
check('CSV memuat header dan baris uji',
  csvText.includes('"nama"') && csvText.includes('"bidang"') && csvText.includes(EMAIL));

const csvNoToken = await fetch(API + '/api/admin/registrations.csv');
check('CSV juga terlindungi token (401)', csvNoToken.status === 401, 'status=' + csvNoToken.status);

/* ================================================================== */

console.log('\n=== G. BERSIH-BERSIH & PEMULIHAN ===');
{
  const removed = await withDb((conn) =>
    conn.execute("DELETE FROM `registrations` WHERE `email` LIKE 'uji+%@example.com'"),
  ).then(([res]) => res.affectedRows);
  check('Baris uji dihapus dari database', removed >= 2, removed + ' baris');

  const restore = await call('/api/admin/settings', {
    method: 'PUT',
    token: TOKEN,
    body: { values: SETTINGS_BEFORE },
  });
  const restored = await call('/api/content');
  check('Tanggal/hadiah dipulihkan seperti semula',
    restore.ok && restored.data?.settings?.['perdana.pendaftaran'] === SETTINGS_BEFORE['perdana.pendaftaran'],
    restored.data?.settings?.['perdana.pendaftaran']);
}

const missing = await call('/api/entah');
check('Alamat yang tidak ada menjawab 404', missing.status === 404, 'status=' + missing.status);

await sleep(50);
console.log('\n' + '  TOTAL: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail > 0 ? 1 : 0);
