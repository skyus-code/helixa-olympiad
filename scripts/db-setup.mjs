/**
 * Siapkan database: jalankan `server/schema.sql`, lalu isi nilai awal.
 *
 * KENAPA SKEMA DIJALANKAN DARI FILE .sql, BUKAN DITULIS ULANG DI SINI
 * -------------------------------------------------------------------
 * Skema adalah sumber kebenaran tunggal. Kalau DDL-nya hidup di dua tempat
 * (file .sql untuk dibaca orang + fungsi JS untuk dijalankan mesin), keduanya
 * pasti berbeda cepat atau lambat, dan yang dipakai aplikasi adalah yang tidak
 * pernah dibaca siapa pun. File .sql juga bisa ditempel langsung ke
 * phpMyAdmin/HeidiSQL kalau suatu saat mesin ini tidak dipakai.
 *
 * Idempoten: `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` untuk settings,
 * dan people hanya diisi kalau tabelnya masih kosong. Menjalankannya dua kali
 * tidak menimpa tanggal/hadiah/juri yang sudah diedit admin.
 *
 * Jalankan: npm run db:setup
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, '..', 'server', 'schema.sql');

export const DB_NAME = process.env.DB_NAME ?? 'helixa_olympiad';

const config = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  multipleStatements: true,
  charset: 'utf8mb4_unicode_ci',
};

/*
 * Nilai awal = teks yang sekarang ada di `src/content.ts`.
 *
 * Disalin apa adanya, termasuk penanda `[ISI ...]`, karena tujuannya bukan
 * mengarang data: database harus mulai dari keadaan yang SAMA dengan situs
 * yang sudah tayang, supaya tidak ada perubahan mendadak bagi pengunjung
 * begitu admin panel dinyalakan.
 */
const SETTINGS = [
  ['perdana.pendaftaran', '[ISI TANGGAL]'],
  ['perdana.pelaksanaan', '[ISI TANGGAL], online'],
  ['perdana.pengumuman', '[ISI TANGGAL]'],
  ['perdana.hadiah', 'e-sertifikat untuk semua peserta; [ISI JIKA ADA]'],
];

const PEOPLE = [
  ['juri', '[Nama Juri/Penyusun Soal]', '[Jabatan, instansi, bukti kredensial]', 'A'],
  ['juri', '[Nama Juri/Penyusun Soal]', '[Jabatan, instansi, bukti kredensial]', 'B'],
  ['mitra', '[Mitra Sekolah/Komunitas]', '[Peran dalam kegiatan]', 'C'],
];

console.log('Menyambung ke MySQL ' + config.host + ':' + config.port + ' ...');

// Koneksi pertama TANPA `database`: database-nya belum ada saat baris ini jalan.
const conn = await mysql.createConnection(config);

try {
  const schema = await readFile(schemaPath, 'utf8');
  /*
   * Komentar `--` dibuang dulu. `multipleStatements` memecah isi file pada
   * setiap `;`, dan komentar penjelas di skema memakai kalimat biasa yang
   * gampang berisi titik dua, tanda kurung, atau tanda baca lain yang membuat
   * pemecahan mentah rapuh. Yang dieksekusi harus hanya DDL-nya.
   */
  const ddl = schema
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  await conn.query(ddl);
  console.log('Skema dijalankan (database `' + DB_NAME + '`).');

  await conn.query('USE `' + DB_NAME + '`');

  // `INSERT IGNORE`: hanya menambah kunci yang belum ada.
  for (const [key, value] of SETTINGS) {
    await conn.execute('INSERT IGNORE INTO `settings` (`key`, `value`) VALUES (?, ?)', [
      key,
      value,
    ]);
  }
  console.log('settings: ' + SETTINGS.length + ' kunci awal dipastikan ada.');

  const [[{ count }]] = await conn.query('SELECT COUNT(*) AS count FROM `people`');
  if (count === 0) {
    for (const [kind, name, role, monogram] of PEOPLE) {
      await conn.execute(
        'INSERT INTO `people` (`kind`, `name`, `role`, `monogram`, `sort_order`) VALUES (?,?,?,?,?)',
        [kind, name, role, monogram, 0],
      );
    }
    console.log('people: ' + PEOPLE.length + ' baris awal dimasukkan.');
  } else {
    console.log('people: sudah berisi ' + count + ' baris, tidak disentuh.');
  }

  console.log('\nSelesai. Langkah berikutnya:');
  console.log('  npm run api      # jalankan API di http://localhost:4000');
  console.log('  npm run dev      # jalankan situs');
  console.log('  buka  #admin     # panel admin');
} finally {
  await conn.end();
}
