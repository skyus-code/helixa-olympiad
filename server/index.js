/**
 * API Helixa Olympiad (Express + MySQL).
 *
 * KENAPA ADA SERVER, PADAHAL SITUSNYA STATIC
 * ------------------------------------------
 * Browser tidak bisa bicara langsung ke MySQL: kredensial database akan ikut
 * terkirim ke setiap pengunjung, dan itu berarti siapa pun bisa membaca,
 * mengubah, atau menghapus seluruh data pendaftaran dari DevTools. Jadi satu
 * lapisan kecil di antaranya wajib, dan lapisan ini juga yang memegang
 * RAHASIA (password DB, password admin) yang tidak boleh ada di bundle klien.
 *
 * Situs tetap berfungsi tanpa server ini: `/api/content` yang gagal membuat
 * halaman memakai teks bawaan di `src/content.ts`. Yang hilang hanya
 * kemampuan admin mengubahnya, bukan halamannya.
 *
 * Jalankan: npm run api        (port dari env PORT, default 4000)
 */
import express from 'express';
import { pool, ping, DB_NAME } from './db.js';
import { login, requireAdmin, usingDefaultPassword } from './auth.js';

const PORT = Number(process.env.PORT ?? 4000);

/**
 * Kunci `settings` yang boleh ditulis admin.
 *
 * Daftar putih, bukan "terima apa saja": tanpa ini, satu permintaan bisa
 * menyuntikkan kunci baru yang tidak pernah dibaca siapa pun, dan tabel
 * `settings` perlahan berubah jadi tempat sampah yang tidak terlihat.
 */
const SETTING_KEYS = [
  'perdana.pendaftaran',
  'perdana.pelaksanaan',
  'perdana.pengumuman',
  'perdana.hadiah',
];

const KELAS = ['X', 'XI', 'XII'];
const JURUSAN = ['SMA', 'MA', 'SMK'];
const BIDANG = ['Matematika', 'Biologi'];

/**
 * Normalisasi nomor WhatsApp ke bentuk `62...` tanpa spasi/tanda baca.
 *
 * Dipakai supaya panitia bisa mengklik wa.me langsung dari daftar pendaftar:
 * `+62 812-3456-7890`, `0812 3456 7890`, dan `62812...` adalah nomor yang sama
 * dan harus tersimpan sama. Aturannya sengaja kecil: buang semua non-digit,
 * lalu ubah awalan `0` jadi `62`.
 */
function normalizeWa(raw) {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  if (digits.startsWith('8')) return '62' + digits;
  return digits;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validasi isi pendaftaran. Mengembalikan { errors, data }.
 *
 * Divalidasi ULANG di server walaupun klien sudah memvalidasi: validasi klien
 * bisa dilewati dengan satu `fetch` manual, dan yang tersimpan di database
 * harus tetap layak dipakai panitia.
 */
function validateRegistration(body) {
  const errors = {};
  const data = {
    nama: text(body.nama),
    sekolah: text(body.sekolah),
    kota: text(body.kota),
    kelas: text(body.kelas),
    jurusan: text(body.jurusan),
    wa: normalizeWa(body.wa),
    email: text(body.email).toLowerCase(),
    bidang: text(body.bidang),
    setuju: body.setuju === true || body.setuju === 1 || body.setuju === '1',
  };

  if (data.nama.length < 2 || data.nama.length > 160) errors.nama = 'Nama tidak valid.';
  if (data.sekolah.length < 2 || data.sekolah.length > 200) errors.sekolah = 'Nama sekolah tidak valid.';
  if (data.kota.length < 2 || data.kota.length > 100) errors.kota = 'Kota tidak valid.';
  if (!KELAS.includes(data.kelas)) errors.kelas = 'Kelas tidak valid.';
  if (!JURUSAN.includes(data.jurusan)) errors.jurusan = 'Jenjang sekolah tidak valid.';
  if (data.wa.length < 9 || data.wa.length > 15) errors.wa = 'Nomor WhatsApp tidak valid.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 200)
    errors.email = 'Email tidak valid.';
  if (!BIDANG.includes(data.bidang)) errors.bidang = 'Bidang tidak valid.';
  if (!data.setuju) errors.setuju = 'Persetujuan aturan wajib dicentang.';

  return { errors, data };
}

function validatePerson(body) {
  const errors = {};
  const kind = text(body.kind);
  const name = text(body.name);
  const role = text(body.role);
  const monogram = text(body.monogram).slice(0, 4);

  if (!['juri', 'mitra'].includes(kind)) errors.kind = 'Jenis harus juri atau mitra.';
  if (name.length < 1 || name.length > 160) errors.name = 'Nama wajib diisi (maks 160).';
  if (role.length > 200) errors.role = 'Keterangan maksimal 200 karakter.';

  return { errors, data: { kind, name, role, monogram } };
}

/** Kutip satu sel CSV. Selalu dikutip: isi kolom bisa memuat koma atau newline. */
function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return '"' + s.replace(/"/g, '""') + '"';
}

const app = express();
app.use(express.json({ limit: '100kb' }));
// Tanpa ini, fetch dari origin dev (5173/4200) ditolak browser walau API-nya
// sehat. Cukup untuk API yang hanya mengembalikan JSON dan dilindungi token.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', req.get('origin') ?? '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

/* -------------------------------------------------------------------------- */
/* Publik                                                                      */
/* -------------------------------------------------------------------------- */

app.get('/api/health', async (_req, res) => {
  try {
    await ping();
    res.json({ ok: true, database: DB_NAME });
  } catch (err) {
    res.status(503).json({ ok: false, error: String(err?.code ?? err?.message ?? err) });
  }
});

/**
 * Teks yang ditimpa admin + daftar juri/mitra. Dibaca semua pengunjung.
 *
 * Bentuk balasannya sengaja `{ settings: {...}, people: [...] }` yang datar,
 * bukan meniru struktur `content.ts`. Penggabungannya dilakukan di klien,
 * karena hanya klien yang tahu teks bawaan mana yang ditimpa.
 */
app.get('/api/content', async (_req, res, next) => {
  try {
    const [settingRows] = await pool.query('SELECT `key`, `value` FROM `settings`');
    const [people] = await pool.query(
      'SELECT `id`, `kind`, `name`, `role`, `monogram` FROM `people` ORDER BY `kind`, `sort_order`, `id`',
    );
    const settings = {};
    for (const row of settingRows) settings[row.key] = row.value;
    res.json({ settings, people });
  } catch (err) {
    next(err);
  }
});

/** Kirim formulir pendaftaran. */
app.post('/api/register', async (req, res, next) => {
  const { errors, data } = validateRegistration(req.body ?? {});
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ error: 'Ada isian yang belum benar.', fields: errors });
    return;
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO `registrations` (`nama`,`sekolah`,`kota`,`kelas`,`jurusan`,`wa`,`email`,`bidang`,`setuju`,`ip`,`user_agent`) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [
        data.nama,
        data.sekolah,
        data.kota,
        data.kelas,
        data.jurusan,
        data.wa,
        data.email,
        data.bidang,
        data.setuju ? 1 : 0,
        req.ip ?? null,
        (req.get('user-agent') ?? '').slice(0, 300) || null,
      ],
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    // 1062 = ER_DUP_ENTRY pada uniq_email_bidang. Bukan kesalahan server:
    // artinya email itu sudah terdaftar di bidang yang sama.
    if (err?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        error: 'Email ini sudah terdaftar di bidang tersebut.',
        duplicate: true,
      });
      return;
    }
    next(err);
  }
});

/* -------------------------------------------------------------------------- */
/* Admin                                                                       */
/* -------------------------------------------------------------------------- */

app.post('/api/admin/login', (req, res) => {
  const token = login(text(req.body?.password));
  if (!token) {
    res.status(401).json({ error: 'Password salah.' });
    return;
  }
  res.json({ token });
});

/** Verifikasi token yang masih tersimpan di browser. */
app.get('/api/admin/session', requireAdmin, (_req, res) => res.json({ ok: true }));

app.put('/api/admin/settings', requireAdmin, async (req, res, next) => {
  const values = req.body?.values ?? {};
  const entries = Object.entries(values).filter(([key]) => SETTING_KEYS.includes(key));
  if (entries.length === 0) {
    res.status(400).json({ error: 'Tidak ada pengaturan yang dikenali.' });
    return;
  }
  for (const [, value] of entries) {
    if (typeof value !== 'string') {
      res.status(400).json({ error: 'Nilai pengaturan harus teks.' });
      return;
    }
  }

  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const [key, value] of entries) {
        await conn.execute(
          'INSERT INTO `settings` (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
          [key, value],
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    res.json({ ok: true, updated: entries.length });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/people', requireAdmin, async (req, res, next) => {
  const { errors, data } = validatePerson(req.body ?? {});
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ error: 'Data tidak valid.', fields: errors });
    return;
  }
  try {
    const [[{ nextOrder }]] = await pool.query(
      'SELECT COALESCE(MAX(`sort_order`), 0) + 1 AS nextOrder FROM `people`',
    );
    const [result] = await pool.execute(
      'INSERT INTO `people` (`kind`,`name`,`role`,`monogram`,`sort_order`) VALUES (?,?,?,?,?)',
      [
        data.kind,
        data.name,
        data.role,
        data.monogram || data.name.charAt(0).toUpperCase(),
        nextOrder,
      ],
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    next(err);
  }
});

app.put('/api/admin/people/:id', requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'ID tidak valid.' });
    return;
  }
  const { errors, data } = validatePerson(req.body ?? {});
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ error: 'Data tidak valid.', fields: errors });
    return;
  }
  try {
    const [result] = await pool.execute(
      'UPDATE `people` SET `kind` = ?, `name` = ?, `role` = ?, `monogram` = ? WHERE `id` = ?',
      [data.kind, data.name, data.role, data.monogram || data.name.charAt(0).toUpperCase(), id],
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Data tidak ditemukan.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/admin/people/:id', requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'ID tidak valid.' });
    return;
  }
  try {
    const [result] = await pool.execute('DELETE FROM `people` WHERE `id` = ?', [id]);
    res.json({ ok: true, deleted: result.affectedRows });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/registrations', requireAdmin, async (req, res, next) => {
  const limit = Math.min(Number(req.query.limit ?? 500) || 500, 5000);
  try {
    const [rows] = await pool.query(
      'SELECT `id`,`nama`,`sekolah`,`kota`,`kelas`,`jurusan`,`wa`,`email`,`bidang`,`created_at` FROM `registrations` ORDER BY `created_at` DESC, `id` DESC LIMIT ?',
      [limit],
    );
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM `registrations`');
    res.json({ total, registrations: rows });
  } catch (err) {
    next(err);
  }
});

/** Ekspor CSV, siap dibuka di Excel/Sheets. */
app.get('/api/admin/registrations.csv', requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT `id`,`created_at`,`nama`,`sekolah`,`kota`,`kelas`,`jurusan`,`wa`,`email`,`bidang` FROM `registrations` ORDER BY `created_at`, `id`',
    );
    const header = [
      'id',
      'waktu_daftar',
      'nama',
      'sekolah',
      'kota',
      'kelas',
      'jenjang',
      'whatsapp',
      'email',
      'bidang',
    ];
    const lines = [header.map(csvCell).join(',')];
    for (const row of rows) {
      lines.push(
        [
          row.id,
          row.created_at,
          row.nama,
          row.sekolah,
          row.kota,
          row.kelas,
          row.jurusan,
          row.wa,
          row.email,
          row.bidang,
        ]
          .map(csvCell)
          .join(','),
      );
    }
    // BOM di depan supaya Excel di Windows membaca UTF-8 dengan benar;
    // tanpa itu, nama beraksen/emoji jadi karakter acak.
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="pendaftar-helixa.csv"');
    res.send('\uFEFF' + lines.join('\r\n') + '\r\n');
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------------------- */

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ada.' }));

// Error handler terakhir: pesan DB mentah tidak diteruskan ke klien (bisa memuat
// nama tabel/kolom), tapi tetap dicatat di konsol server.
app.use((err, _req, res, _next) => {
  console.error('[api] error:', err?.code ?? '', err?.message ?? err);
  res.status(500).json({ error: 'Terjadi kesalahan di server.' });
});

app.listen(PORT, () => {
  console.log('[api] Helixa Olympiad API siap di http://localhost:' + PORT);
  console.log('[api] database:', DB_NAME);
  if (usingDefaultPassword()) {
    console.warn(
      '[api] PERINGATAN: ADMIN_PASSWORD masih default ("helixa2026"). Ganti lewat .env sebelum dipakai sungguhan.',
    );
  }
});
