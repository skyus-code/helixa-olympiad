/**
 * Koneksi MySQL (pool) untuk API Helixa Olympiad.
 *
 * Konfigurasi dibaca dari env, dengan default yang cocok untuk instalasi lokal
 * Laragon/XAMPP (host 127.0.0.1, user `root`, tanpa password). Default itu
 * sengaja dibuat "langsung jalan" di mesin pengembang; di server sungguhan
 * semuanya wajib diisi lewat env, karena password database tidak boleh ada di
 * dalam repositori.
 */
import mysql from 'mysql2/promise';

export const DB_NAME = process.env.DB_NAME ?? 'helixa_olympiad';

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  // Tabel dibuat sebagai TIMESTAMP; tanpa ini, driver mengembalikan objek Date
  // lokal dan CSV-nya ikut bergeser sesuai zona waktu mesin.
  dateStrings: true,
});

/** Uji koneksi sekali. Dipakai `/api/health` supaya kegagalan DB terlihat jelas. */
export async function ping() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}
