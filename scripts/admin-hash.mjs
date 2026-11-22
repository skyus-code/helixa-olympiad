/**
 * Buat hash password admin untuk ADMIN_PASSWORD_HASH di .env.
 * Pakai: npm run admin:hash -- "password-baru"
 */
import { hashPassword } from '../server/auth.js';

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('Pakai: npm run admin:hash -- "<password, minimal 10 karakter>"');
  process.exit(1);
}
console.log('ADMIN_PASSWORD_HASH=' + hashPassword(password));
