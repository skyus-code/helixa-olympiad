/**
 * Pemanggilan API Helixa Olympiad.
 *
 * KENAPA SATU FILE UNTUK SEMUA ENDPOINT
 * -------------------------------------
 * Aturan kejujuran situs ini ("jangan pernah bilang berhasil kalau data tidak
 * sampai") hanya kuat kalau SEMUA jalur jaringan melewati satu tempat yang
 * sama. Kalau `fetch` ditulis langsung di komponen, tiap tempat punya cara
 * sendiri menafsirkan balasan, dan satu tempat pasti lupa memeriksa sesuatu.
 * Di sini balasan SELALU diperiksa bentuknya, bukan hanya status HTTP-nya.
 *
 * KENAPA BENTUK BALASAN DIPERIKSA, BUKAN CUMA `res.ok`
 * ---------------------------------------------------
 * Ini bukan kehati-hatian teoretis. Situs ini di-deploy sebagai SPA statis, dan
 * di sana `/api/*` tidak dilayani API sama sekali: server statis menjawabnya
 * dengan `index.html` berstatus 200. Tanpa pemeriksaan bentuk, HTML itu akan
 * lolos sebagai "berhasil" dan pengunjung melihat "Pendaftaran terkirim" untuk
 * data yang tidak pernah tersimpan. Karena itu setiap balasan harus punya
 * bentuk yang diharapkan (angka `id`, `settings` berupa objek, dan seterusnya).
 */

/** Basis URL API. Kosong = origin sendiri (diproxy Vite saat pengembangan). */
const BASE = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const API_BASE = BASE;

/** Path publik yang dipakai test untuk mengenali permintaan pendaftaran. */
export const REGISTER_PATH = '/api/register';
export const CONTENT_PATH = '/api/content';

const TOKEN_KEY = 'helixa.admin.token';

export function getToken(): string {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setToken(token: string): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Mode privat/penyimpanan penuh: token hanya bertahan sampai halaman
    // ditutup. Login tetap bekerja, hanya tidak diingat.
  }
}

/* -------------------------------------------------------------------------- */
/* Bentuk data                                                                 */
/* -------------------------------------------------------------------------- */

export interface Person {
  id: number;
  kind: 'juri' | 'mitra';
  name: string;
  role: string;
  monogram: string;
}

export interface ContentPayload {
  settings: Record<string, string>;
  people: Person[];
}

export interface RegistrationInput {
  nama: string;
  sekolah: string;
  kota: string;
  kelas: string;
  jurusan: string;
  wa: string;
  email: string;
  bidang: string;
  setuju: boolean;
}

export interface RegistrationRow {
  id: number;
  nama: string;
  sekolah: string;
  kota: string;
  kelas: string;
  jurusan: string;
  wa: string;
  email: string;
  bidang: string;
  created_at: string;
}

/** Hasil satu panggilan. `status` 0 berarti permintaan tidak pernah sampai. */
export interface Reply<T> {
  ok: boolean;
  status: number;
  data: T | null;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Inti                                                                        */
/* -------------------------------------------------------------------------- */

function errorOf(data: unknown): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const value = (data as Record<string, unknown>).error;
    if (typeof value === 'string') return value;
  }
  return '';
}

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<Reply<T>> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.token) headers.Authorization = 'Bearer ' + init.token;

  try {
    const res = await fetch(BASE + path, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

    // Dibaca sebagai teks dulu, baru di-parse. `res.json()` melempar pada
    // balasan HTML, dan lemparan itu tidak bisa dibedakan dari "jaringan mati";
    // padahal dua hal itu butuh pesan yang berbeda untuk pengguna.
    const raw = await res.text();
    let data: T | null = null;
    if (raw) {
      try {
        data = JSON.parse(raw) as T;
      } catch {
        data = null;
      }
    }

    const errorText = errorOf(data);

    return { ok: res.ok, status: res.status, data, message: errorText };
  } catch {
    return { ok: false, status: 0, data: null, message: 'Tidak bisa menghubungi server.' };
  }
}

/* -------------------------------------------------------------------------- */
/* Publik                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Teks yang ditimpa admin + daftar juri/mitra.
 *
 * Mengembalikan `null` kalau API tidak ada atau balasannya bukan JSON yang
 * diharapkan. Pemanggil WAJIB memperlakukan `null` sebagai "pakai teks bawaan
 * di content.ts", bukan sebagai error yang perlu ditampilkan.
 */
export async function fetchContent(): Promise<ContentPayload | null> {
  const reply = await call<ContentPayload>(CONTENT_PATH);
  const data = reply.data;
  if (!reply.ok || !data || typeof data !== 'object') return null;
  if (!data.settings || typeof data.settings !== 'object') return null;
  if (!Array.isArray(data.people)) return null;
  return { settings: data.settings, people: data.people };
}

/** Simpan satu pendaftaran. `ok` hanya true kalau server mengembalikan `id`. */
export interface RegisterReply {
  ok: boolean;
  status: number;
  message: string;
  /** `id` baris yang dibuat. Satu-satunya bukti data benar-benar tersimpan. */
  id: number | null;
  /** Kesalahan per-field dari server (HTTP 400), siap dipetakan ke form. */
  fields: Record<string, string>;
}

export async function submitRegistration(input: RegistrationInput): Promise<RegisterReply> {
  const reply = await call<{ id?: number; fields?: Record<string, string> }>(REGISTER_PATH, {
    method: 'POST',
    body: input,
  });

  // `id` yang berupa angka adalah bukti satu-satunya bahwa barisnya benar-benar
  // masuk database. Balasan HTML berstatus 200 tidak lolos di sini.
  const id = typeof reply.data?.id === 'number' ? reply.data.id : null;

  return {
    ok: reply.ok && id !== null,
    status: reply.status,
    message: reply.message,
    id,
    fields: reply.data?.fields ?? {},
  };
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                       */
/* -------------------------------------------------------------------------- */

export async function login(password: string): Promise<Reply<{ token: string }>> {
  const reply = await call<{ token: string }>('/api/admin/login', {
    method: 'POST',
    body: { password },
  });
  if (!reply.ok || typeof reply.data?.token !== 'string') {
    return { ...reply, ok: false, data: null };
  }
  return reply;
}

export function checkSession(token: string): Promise<Reply<unknown>> {
  return call('/api/admin/session', { token });
}

export function saveSettings(
  token: string,
  values: Record<string, string>,
): Promise<Reply<{ updated: number }>> {
  return call('/api/admin/settings', { method: 'PUT', body: { values }, token });
}

export function createPerson(token: string, person: Omit<Person, 'id'>): Promise<Reply<{ id: number }>> {
  return call('/api/admin/people', { method: 'POST', body: person, token });
}

export function updatePerson(token: string, id: number, person: Omit<Person, 'id'>): Promise<Reply<unknown>> {
  return call('/api/admin/people/' + id, { method: 'PUT', body: person, token });
}

export function deletePerson(token: string, id: number): Promise<Reply<{ deleted: number }>> {
  return call('/api/admin/people/' + id, { method: 'DELETE', token });
}

export function listRegistrations(
  token: string,
  limit = 500,
): Promise<Reply<{ total: number; registrations: RegistrationRow[] }>> {
  return call('/api/admin/registrations?limit=' + limit, { token });
}

/**
 * Unduh CSV.
 *
 * Bukan `<a href>` biasa: endpoint-nya butuh header `Authorization`, dan
 * tautan tidak bisa mengirim header. Jadi isinya diambil dulu lewat fetch,
 * lalu diserahkan ke browser sebagai blob.
 */
export async function downloadCsv(token: string): Promise<boolean> {
  try {
    const res = await fetch(BASE + '/api/admin/registrations.csv', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pendaftar-helixa.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Dicabut setelah satu putaran event loop: `revokeObjectURL` yang terlalu
    // cepat membuat unduhan gagal di sebagian browser.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}
