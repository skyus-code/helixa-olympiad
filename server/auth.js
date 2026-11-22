/**
 * Login admin: satu password, token bertanda tangan (stateless).
 *
 * Kenapa bukan tabel `users` + bcrypt: situs ini punya SATU admin. Tabel user
 * berarti satu tabel lagi yang harus diamankan, satu alur lupa-password, dan
 * satu ketergantungan hashing - semuanya untuk melayani satu orang yang
 * passwordnya bisa diganti lewat env. Kalau nanti adminnya lebih dari satu,
 * titik gantinya jelas: fungsi `login()` di bawah.
 *
 * Tokennya stateless (expiry + HMAC), bukan sesi di memori. Alasannya bukan
 * kerapian: server ini ikut dimatikan-nyalakan saat pengembangan, dan sesi
 * in-memory berarti admin ter-logout sendiri setiap kali server restart.
 *
 * KENAPA PERLU ADMIN_SECRET TERPISAH: token ditandatangani dengan secret, dan
 * password TIDAK dipakai sebagai secret. Kalau password jadi secret, mengganti
 * password otomatis membatalkan semua token lama - dan itu justru sumber bug
 * "tiba-tiba logout" yang tidak perlu.
 */
import crypto from 'node:crypto';

/**
 * Password admin disimpan sebagai HASH (scrypt) di ADMIN_PASSWORD_HASH, dibuat
 * dengan `npm run admin:hash`. Tidak ada password di kode dan tidak ada nilai
 * bawaan: tanpa hash, login ditolak (503).
 *
 * ADMIN_PASSWORD (teks biasa) masih diterima HANYA untuk pengembangan lokal dan
 * skrip uji; server memperingatkan saat memakainya.
 */
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ?? '';
const ADMIN_PASSWORD_PLAIN = process.env.ADMIN_PASSWORD ?? '';
const TOKEN_HOURS = Number(process.env.ADMIN_TOKEN_HOURS ?? 12);

// Tanpa ADMIN_SECRET, dipakai kunci acak per proses: token tidak bisa
// dipalsukan, hanya hangus saat server restart. Password TIDAK jadi kunci.
const ADMIN_SECRET = process.env.ADMIN_SECRET || crypto.randomBytes(32).toString('hex');
export const secretIsEphemeral = !process.env.ADMIN_SECRET;

/** Format hash: `scrypt$<salt hex>$<hash hex>`. */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function checkHash(password, stored) {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export function loginConfigured() {
  return Boolean(ADMIN_PASSWORD_HASH || ADMIN_PASSWORD_PLAIN);
}

export function usingPlainPassword() {
  return !ADMIN_PASSWORD_HASH && Boolean(ADMIN_PASSWORD_PLAIN);
}

/** Bandingkan dua string dengan waktu tetap, supaya panjang/pemetaan tidak bocor. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) {
    // Tetap jalankan perbandingan supaya waktunya tidak bergantung pada panjang.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function signature(expiry) {
  return crypto.createHmac('sha256', ADMIN_SECRET).update(String(expiry)).digest('hex');
}

/** Password benar -> token. Salah -> null. */
export function login(password) {
  const ok = ADMIN_PASSWORD_HASH
    ? checkHash(password ?? '', ADMIN_PASSWORD_HASH)
    : ADMIN_PASSWORD_PLAIN !== '' && safeEqual(password ?? '', ADMIN_PASSWORD_PLAIN);
  if (!ok) return null;
  const expiry = Date.now() + TOKEN_HOURS * 3600 * 1000;
  return `${expiry}.${signature(expiry)}`;
}

/** Token masih berlaku dan tanda tangannya cocok. */
export function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [expiryRaw, sig] = token.split('.');
  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  const expected = Buffer.from(signature(expiry), 'hex');
  const given = Buffer.from(sig ?? '', 'hex');
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Middleware: butuh header `Authorization: Bearer <token>`. */
export function requireAdmin(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verify(token)) {
    res.status(401).json({ error: 'Tidak diizinkan. Silakan login ulang.' });
    return;
  }
  next();
}

