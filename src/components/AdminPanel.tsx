/**
 * Panel admin (`#admin`).
 *
 * HALAMAN INI BUKAN HALAMAN PUBLIK
 * --------------------------------
 * Tidak ada satu pun tautan ke sini dari halaman utama. Alasannya bukan
 * kerahasiaan - URL-nya gampang ditebak - tapi supaya pengunjung tidak pernah
 * mendarat di alat kerja pengurus. Yang benar-benar menjaga adalah token di
 * server: tanpa `Authorization: Bearer ...` yang sah, setiap endpoint tulis
 * menjawab 401, dan tidak ada perubahan yang bisa dilakukan dari halaman ini.
 *
 * KENAPA EDITORNYA MENYIMPAN PER BAGIAN, BUKAN SATU TOMBOL BESAR
 * --------------------------------------------------------------
 * Tanggal dan daftar juri adalah dua hal yang diubah pada waktu yang berbeda
 * (tanggal diubah saat jadwal berubah; juri diubah saat ada yang mengundurkan
 * diri). Satu tombol "Simpan semua" berarti setiap perubahan kecil mengirim
 * ulang seluruh isi halaman - dan satu field yang salah ketik membuat
 * perubahan lain yang sudah benar ikut tidak tersimpan.
 *
 * KENAPA TIDAK ADA OPTIMISTIC UPDATE
 * ----------------------------------
 * Nilai yang tampil HANYA berubah setelah server mengonfirmasi. Panel ini
 * menulis ke situs yang dibaca calon peserta: menampilkan tanggal baru
 * seolah-olah tersimpan padahal gagal akan membuat pengurus mengumumkan
 * jadwal yang tidak pernah ada. Server yang menolak harus terlihat, bukan
 * ditutupi.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eyebrow } from './ui/Eyebrow';
import { PERDANA } from '../content';
import {
  checkSession,
  createPerson,
  deletePerson,
  downloadCsv,
  getToken,
  listRegistrations,
  login,
  saveSettings,
  setToken,
  updatePerson,
} from '../lib/api';
import type { Person, RegistrationRow } from '../lib/api';
import { PERDANA_FIELDS, reloadContent, useSiteContent } from '../lib/siteContent';

/* -------------------------------------------------------------------------- */

/** Pesan gagal yang seragam, termasuk kasus "API tidak berjalan". */
function failureMessage(status: number, message: string): string {
  if (status === 0) {
    return 'API tidak berjalan. Jalankan `npm run api` di terminal, lalu coba lagi.';
  }
  return message || 'Server menolak permintaan (HTTP ' + status + ').';
}

const TAB_LABELS = ['Tanggal & Hadiah', 'Juri & Mitra', 'Pendaftar'] as const;
type Tab = (typeof TAB_LABELS)[number];

/* -------------------------------------------------------------------------- */
/* Masuk                                                                       */
/* -------------------------------------------------------------------------- */

function LoginCard({ onDone }: { onDone: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const reply = await login(password);
    setBusy(false);
    if (!reply.ok || !reply.data) {
      setError(failureMessage(reply.status, reply.message));
      return;
    }
    onDone(reply.data.token);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="register-card mt-8 rounded-3xl border border-gold-line p-6 text-left sm:p-8"
    >
      <label htmlFor="admin-password" className="text-sm font-semibold text-bone">
        Password admin
      </label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="field mt-2"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'admin-password-error' : undefined}
      />
      {error && (
        <p id="admin-password-error" role="alert" className="field-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="btn btn-shimmer bg-gold-gradient mt-5 flex min-h-12 w-full items-center justify-center rounded-full px-6 text-[0.9375rem] font-semibold text-ink disabled:opacity-60"
      >
        {busy ? 'Memeriksa...' : 'Masuk'}
      </button>
      <p className="mt-4 text-xs leading-relaxed text-bone-dim">
        Password diatur lewat <code>ADMIN_PASSWORD</code> di file <code>.env</code> di server. Token
        login disimpan di browser ini selama 12 jam.
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Tab 1: tanggal & hadiah                                                     */
/* -------------------------------------------------------------------------- */

const FIELD_HELP: Record<string, string> = {
  'perdana.pendaftaran': 'Ditampilkan di baris "Pendaftaran". Contoh: 1 - 20 November 2026.',
  'perdana.pelaksanaan': 'Ditampilkan di baris "Pelaksanaan". Contoh: 22 November 2026, online.',
  'perdana.pengumuman': 'Ditampilkan di baris "Pengumuman". Contoh: 5 Desember 2026.',
  'perdana.hadiah': 'Boleh beberapa baris: setiap baris jadi satu baris di kartu Hadiah.',
};

/**
 * Nilai yang SEDANG TAYANG kalau database belum bisa dibaca.
 *
 * Diambil dari `content.ts`, bukan dari string kosong. Kalau API tidak jalan,
 * pengurus tetap harus melihat teks yang sedang dilihat pengunjung - dan itu
 * teks bawaan, bukan kotak kosong yang terlihat seperti data hilang.
 */
const FALLBACK: Record<string, string> = Object.fromEntries(
  PERDANA_FIELDS.map((field) => {
    const row = PERDANA.details.find((detail) => detail.label === field.label);
    return [field.key, row ? row.value : ''];
  }),
);

function SettingsTab({ token }: { token: string }) {
  const { settings, status } = useSiteContent();

  /*
   * Nilai awal digabung dari database di atas teks bawaan.
   *
   * Bukan `settings` saja: kunci yang belum ada di database (mis. database
   * baru dibuat dan seed-nya belum jalan) harus tetap tampil sebagai teks yang
   * benar-benar tayang, bukan kosong.
   */
  const initial = useMemo(() => ({ ...FALLBACK, ...settings }), [settings]);

  /*
   * `null` = belum diisi. Diisi sekali setelah store selesai memuat, bukan
   * lewat `useState(initial)` - pada render pertama store masih `loading`,
   * sehingga nilai awalnya akan berupa teks bawaan dan menimpa hasil database
   * begitu permintaan selesai.
   */
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (draft === null && status !== 'loading') setDraft(initial);
  }, [draft, status, initial]);

  const valueOf = (key: string) => draft?.[key] ?? initial[key] ?? '';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setSaved(false);

    const values: Record<string, string> = {};
    for (const field of PERDANA_FIELDS) values[field.key] = valueOf(field.key);

    const reply = await saveSettings(token, values);
    setBusy(false);
    if (!reply.ok) {
      setError(failureMessage(reply.status, reply.message));
      return;
    }
    setSaved(true);
    // Halaman utama membaca store yang sama; tanpa ini, perubahan baru
    // terlihat setelah halaman dimuat ulang. Draft dikosongkan supaya diisi
    // ulang dari nilai yang baru benar-benar tersimpan.
    await reloadContent();
    setDraft(null);
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
      {PERDANA_FIELDS.map((field, index) => {
        const id = 'setting-' + index;
        const multiline = field.key === 'perdana.hadiah';
        return (
          <div key={field.key}>
            <label htmlFor={id} className="text-sm font-semibold text-bone">
              {field.label}
            </label>
            {multiline ? (
              <textarea
                id={id}
                rows={3}
                value={valueOf(field.key)}
                onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="field mt-2"
              />
            ) : (
              <input
                id={id}
                type="text"
                value={valueOf(field.key)}
                onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="field mt-2"
              />
            )}
            <p className="mt-1.5 text-xs text-bone-dim">{FIELD_HELP[field.key]}</p>
          </div>
        );
      })}

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" aria-live="polite" className="text-sm text-gold-bright">
          Tersimpan. Halaman utama sudah memakai nilai baru.
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="btn btn-shimmer bg-gold-gradient flex min-h-12 items-center justify-center rounded-full px-6 text-[0.9375rem] font-semibold text-ink disabled:opacity-60"
      >
        {busy ? 'Menyimpan...' : 'Simpan tanggal & hadiah'}
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Tab 2: juri & mitra                                                         */
/* -------------------------------------------------------------------------- */

function PersonEditor({
  person,
  token,
  onChanged,
  onError,
}: {
  person: Person;
  token: string;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState({ ...person });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft({ ...person });
  }, [person]);

  const dirty =
    draft.kind !== person.kind ||
    draft.name !== person.name ||
    draft.role !== person.role ||
    draft.monogram !== person.monogram;

  async function onSave() {
    if (busy) return;
    setBusy(true);
    const reply = await updatePerson(token, person.id, {
      kind: draft.kind,
      name: draft.name,
      role: draft.role,
      monogram: draft.monogram,
    });
    setBusy(false);
    if (!reply.ok) {
      onError(failureMessage(reply.status, reply.message));
      return;
    }
    onChanged();
  }

  async function onDelete() {
    if (busy) return;
    // Konfirmasi bawaan browser: penghapusan di sini tidak bisa dibatalkan,
    // dan tombol Hapus berdampingan dengan Simpan di layar kecil.
    if (!window.confirm('Hapus "' + person.name + '" dari daftar?')) return;
    setBusy(true);
    const reply = await deletePerson(token, person.id);
    setBusy(false);
    if (!reply.ok) {
      onError(failureMessage(reply.status, reply.message));
      return;
    }
    onChanged();
  }

  const idBase = 'person-' + person.id;

  return (
    <div className="rounded-2xl border border-gold-line bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-[7rem_1fr_1fr_5rem]">
        <div>
          <label htmlFor={idBase + '-kind'} className="text-xs tracking-wide text-bone-dim uppercase">
            Jenis
          </label>
          <select
            id={idBase + '-kind'}
            value={draft.kind}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, kind: e.target.value as Person['kind'] }))
            }
            className="field mt-1"
          >
            <option value="juri">juri</option>
            <option value="mitra">mitra</option>
          </select>
        </div>
        <div>
          <label htmlFor={idBase + '-name'} className="text-xs tracking-wide text-bone-dim uppercase">
            Nama
          </label>
          <input
            id={idBase + '-name'}
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            className="field mt-1"
          />
        </div>
        <div>
          <label htmlFor={idBase + '-role'} className="text-xs tracking-wide text-bone-dim uppercase">
            Keterangan
          </label>
          <input
            id={idBase + '-role'}
            type="text"
            value={draft.role}
            onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
            className="field mt-1"
          />
        </div>
        <div>
          <label
            htmlFor={idBase + '-monogram'}
            className="text-xs tracking-wide text-bone-dim uppercase"
          >
            Inisial
          </label>
          <input
            id={idBase + '-monogram'}
            type="text"
            maxLength={4}
            value={draft.monogram}
            placeholder="otomatis"
            onChange={(e) => setDraft((prev) => ({ ...prev, monogram: e.target.value }))}
            className="field mt-1"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={busy || !dirty}
          className="btn min-h-11 items-center justify-center rounded-full border border-gold/35 px-5 text-sm font-semibold text-bone disabled:opacity-45"
        >
          {busy ? 'Menyimpan...' : dirty ? 'Simpan' : 'Tersimpan'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="btn min-h-11 items-center justify-center rounded-full border border-transparent px-4 text-sm text-bone-dim hover:border-red-400/40 hover:text-red-300 disabled:opacity-45"
        >
          Hapus
        </button>
      </div>
    </div>
  );
}

function AddPersonForm({
  token,
  onChanged,
  onError,
}: {
  token: string;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState({ kind: 'juri' as Person['kind'], name: '', role: '', monogram: '' });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!draft.name.trim()) return;
    setBusy(true);
    const reply = await createPerson(token, draft);
    setBusy(false);
    if (!reply.ok) {
      onError(failureMessage(reply.status, reply.message));
      return;
    }
    setDraft({ kind: draft.kind, name: '', role: '', monogram: '' });
    onChanged();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-dashed border-gold-line p-4">
      <p className="text-sm font-semibold text-bone">Tambah orang</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[7rem_1fr_1fr_5rem]">
        <select
          aria-label="Jenis"
          value={draft.kind}
          onChange={(e) => setDraft((prev) => ({ ...prev, kind: e.target.value as Person['kind'] }))}
          className="field"
        >
          <option value="juri">juri</option>
          <option value="mitra">mitra</option>
        </select>
        <input
          aria-label="Nama"
          type="text"
          placeholder="Nama"
          value={draft.name}
          onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
          className="field"
        />
        <input
          aria-label="Keterangan"
          type="text"
          placeholder="Keterangan (boleh dikosongkan)"
          value={draft.role}
          onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
          className="field"
        />
        <input
          aria-label="Inisial"
          type="text"
          maxLength={4}
          placeholder="Inisial"
          value={draft.monogram}
          onChange={(e) => setDraft((prev) => ({ ...prev, monogram: e.target.value }))}
          className="field"
        />
      </div>
      <button
        type="submit"
        disabled={busy || !draft.name.trim()}
        className="btn mt-3 min-h-11 items-center justify-center rounded-full border border-gold/35 px-5 text-sm font-semibold text-bone disabled:opacity-45"
      >
        {busy ? 'Menambah...' : 'Tambah'}
      </button>
    </form>
  );
}

function PeopleTab({ token, onError }: { token: string; onError: (msg: string) => void }) {
  const { people, status } = useSiteContent();

  /*
   * `reloadContent()` menulis ulang store, dan store itu yang memicu render
   * ulang daftar di atas - jadi tidak ada state tambahan yang perlu diubah di
   * sini. Yang penting urutannya: server dulu, tampilan kemudian.
   */
  const onChanged = useCallback(() => {
    void reloadContent();
  }, []);

  return (
    <div className="mt-6 flex flex-col gap-3">
      {status === 'loading' && <p className="text-sm text-bone-dim">Memuat daftar...</p>}

      {status !== 'loading' && (people?.length ?? 0) === 0 && (
        <p className="text-sm text-bone-dim">
          Daftar di database masih kosong, jadi halaman utama memakai contoh bawaan. Tambahkan orang
          pertama di bawah untuk menggantinya.
        </p>
      )}

      {people?.map((person) => (
        <PersonEditor
          key={person.id}
          person={person}
          token={token}
          onChanged={onChanged}
          onError={onError}
        />
      ))}

      <AddPersonForm token={token} onChanged={onChanged} onError={onError} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tab 3: pendaftar                                                            */
/* -------------------------------------------------------------------------- */

function RegistrationsTab({ token, onError }: { token: string; onError: (msg: string) => void }) {
  const [rows, setRows] = useState<RegistrationRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const reply = await listRegistrations(token);
    setBusy(false);
    if (!reply.ok || !reply.data) {
      onError(failureMessage(reply.status, reply.message));
      setRows([]);
      return;
    }
    setRows(reply.data.registrations);
    setTotal(reply.data.total);
  }, [token, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="btn min-h-11 items-center justify-center rounded-full border border-gold/35 px-5 text-sm font-semibold text-bone disabled:opacity-45"
        >
          {busy ? 'Memuat...' : 'Muat ulang'}
        </button>
        <button
          type="button"
          onClick={() => void downloadCsv(token)}
          className="btn min-h-11 items-center justify-center rounded-full border border-gold/35 px-5 text-sm font-semibold text-bone"
        >
          Unduh CSV
        </button>
        <p className="text-sm text-bone-dim">
          {rows === null ? '' : total + ' pendaftar' + (rows.length < total ? ' (menampilkan ' + rows.length + ')' : '')}
        </p>
      </div>

      {rows !== null && rows.length === 0 && (
        <p className="mt-5 text-sm text-bone-dim">Belum ada pendaftar.</p>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-gold-line">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <thead className="bg-ink-deep/70 text-xs tracking-wide text-bone-dim uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Waktu</th>
                <th className="px-3 py-2 font-medium">Nama</th>
                <th className="px-3 py-2 font-medium">Sekolah</th>
                <th className="px-3 py-2 font-medium">Kota</th>
                <th className="px-3 py-2 font-medium">Kelas</th>
                <th className="px-3 py-2 font-medium">Bidang</th>
                <th className="px-3 py-2 font-medium">WhatsApp</th>
                <th className="px-3 py-2 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gold-line/60">
                  <td className="px-3 py-2 whitespace-nowrap text-bone-dim">{row.created_at}</td>
                  <td className="px-3 py-2 text-bone">{row.nama}</td>
                  <td className="px-3 py-2 text-bone-dim">{row.sekolah}</td>
                  <td className="px-3 py-2 text-bone-dim">{row.kota}</td>
                  <td className="px-3 py-2 text-bone-dim">
                    {row.kelas} {row.jurusan}
                  </td>
                  <td className="px-3 py-2 text-bone-dim">{row.bidang}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {/* wa.me supaya panitia bisa menghubungi peserta langsung. */}
                    <a
                      href={'https://wa.me/' + row.wa}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gold underline decoration-gold/40 underline-offset-4"
                    >
                      {row.wa}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-bone-dim">{row.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Kerangka                                                                    */
/* -------------------------------------------------------------------------- */

export function AdminPanel() {
  const [token, setTokenState] = useState(() => getToken());
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>(TAB_LABELS[0]);
  const [error, setError] = useState('');

  /*
   * Token yang tersimpan diperiksa ke server sebelum dipercaya. Token bisa
   * kedaluwarsa (12 jam) atau ditandatangani dengan secret lama setelah
   * `ADMIN_SECRET` diganti; tanpa pemeriksaan ini, panel akan tampil seolah
   * sudah masuk lalu setiap simpan gagal 401 - pengalaman yang jauh lebih
   * membingungkan daripada diminta login sekali lagi.
   */
  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    void checkSession(token).then((reply) => {
      if (cancelled) return;
      if (!reply.ok) {
        setToken('');
        setTokenState('');
      }
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onLoggedIn = useCallback((next: string) => {
    setToken(next);
    setTokenState(next);
  }, []);

  const onLogout = useCallback(() => {
    setToken('');
    setTokenState('');
    setError('');
  }, []);

  return (
    <main id="admin-panel" className="shell relative min-h-screen py-24">
      <div className="mx-auto w-full max-w-[64rem]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Panel Admin</Eyebrow>
            <h1 className="mt-4 font-display text-4xl leading-tight text-bone sm:text-5xl">
              Kelola Helixa Olympiad
            </h1>
            <p className="mt-3 max-w-[52ch] text-bone-dim">
              Ubah tanggal, hadiah, juri, dan mitra. Perubahan langsung terlihat di halaman utama.
            </p>
          </div>
          {token && (
            <div className="flex gap-3">
              <a
                href="#top"
                className="btn min-h-11 items-center justify-center rounded-full border border-gold/35 px-5 text-sm font-semibold text-bone"
              >
                Lihat halaman utama
              </a>
              <button
                type="button"
                onClick={onLogout}
                className="btn min-h-11 items-center justify-center rounded-full border border-transparent px-4 text-sm text-bone-dim hover:border-gold/35 hover:text-bone"
              >
                Keluar
              </button>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="field-error mt-6">
            {error}
          </p>
        )}

        {checking ? (
          <p className="mt-8 text-bone-dim">Memeriksa sesi...</p>
        ) : !token ? (
          <LoginCard onDone={onLoggedIn} />
        ) : (
          <>
            <div role="tablist" aria-label="Bagian admin" className="mt-10 flex flex-wrap gap-2">
              {TAB_LABELS.map((label) => {
                const active = label === tab;
                return (
                  <button
                    key={label}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => {
                      setTab(label);
                      setError('');
                    }}
                    className={
                      'btn min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors duration-300 ' +
                      (active
                        ? 'border border-gold/55 bg-gold/12 text-bone'
                        : 'border border-gold-line text-bone-dim hover:text-bone')
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="register-card mt-4 rounded-3xl border border-gold-line p-6 sm:p-8">
              {tab === 'Tanggal & Hadiah' && <SettingsTab token={token} />}
              {tab === 'Juri & Mitra' && <PeopleTab token={token} onError={setError} />}
              {tab === 'Pendaftar' && <RegistrationsTab token={token} onError={setError} />}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
