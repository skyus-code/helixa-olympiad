/**
 * Halaman Form Pendaftaran.
 *
 * HAL YANG HARUS DISIKUTI METERI
 * ------------------------------
 * 1. Isi halaman ini tidak bergantung pada objek 3D. Kalau WebGL ditolak,
 *    scene tidak muncul dan form tetap utuh. Objek itu hiasan; isi form
 *    adalah produknya.
 *
 * 2. Latar 3D dan partikel ada DI BELAKANG kotak form, bukan di dalam atau
 *    sampingnya. Kotak form dibuat hampir pekat (alpha tinggi) supaya
 *    legibilitas field tidak bergantung pada apa yang kebetulan sedang
 *    bergerak di belakangnya. Bandingkan dengan armillary di section Aturan:
 *    di sana cincin memang melintas di belakang teks dan karena itu opasitasnya
 *    harus diturunkan sampai 0,16 hanya supaya rasio kontrasnya tetap di atas
 *    4,5:1. Di halaman ini tidak perlu pengorbanan seperti itu - form punya
 *    kotak sendiri, jadi legibilitasnya dijamin oleh arsitektur, bukan oleh
 *    penyetelan angka.
 *
 * 3. Tombol kirim TIDAK diam-diam menelepon server yang tidak ada. Validasi
 *    form tetap berjalan, lalu hasilnya adalah pengakuan jujur bahwa data
 *    belum terkirim ke mana pun, ditambah ringkasan yang bisa disalin sendiri.
 *    Alasan lengkapnya ada di content.ts.
 *
 * 4. a11y form: setiap input punya <label>, setiap pesan error terhubung lewat
 *    `aria-describedby`, ada ringkasan error `role="alert"` yang bisa diklik
 *    untuk melompat ke field bermasalah, dan fokus pindah ke field pertama yang
 *    salah setelah submit gagal.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { REGISTRATION } from '../content';
import { Eyebrow } from './ui/Eyebrow';
import { Reveal } from './ui/Reveal';
import { OlympiadScene } from './OlympiadScene';

type Values = {
  nama: string;
  sekolah: string;
  kota: string;
  kelas: string;
  jurusan: string;
  wa: string;
  email: string;
  bidang: string;
  setuju: boolean;
};

type FieldName = keyof Values;

const EMPTY: Values = {
  nama: '',
  sekolah: '',
  kota: '',
  kelas: '',
  jurusan: '',
  wa: '',
  email: '',
  bidang: '',
  setuju: false,
};

/**
 * Urutan field untuk pesan "lompat ke field yang pertama salah".
 *
 * Urutan ini bukan urutan di layar: field yang paling atas dibaca paling dulu,
 * jadi memperbaiki dari atas ke bawah jauh lebih masuk akal daripada melompat
 * bolak-balik. `kelas` dan `jurusan` berurutan karena keduanya langsung di bawah
 * `kota` di form.
 */
const ORDER: FieldName[] = ['nama', 'sekolah', 'kota', 'kelas', 'jurusan', 'wa', 'email', 'bidang', 'setuju'];

/** Label yang dipakai di ringkasan error dan di teks salin. */
const LABELS: Record<FieldName, string> = {
  nama: REGISTRATION.fields.nama.label,
  sekolah: REGISTRATION.fields.sekolah.label,
  kota: REGISTRATION.fields.kota.label,
  kelas: REGISTRATION.fields.kelas.label,
  jurusan: REGISTRATION.fields.jurusan.label,
  wa: REGISTRATION.fields.wa.label,
  email: REGISTRATION.fields.email.label,
  bidang: REGISTRATION.fields.bidangLabel,
  setuju: REGISTRATION.fields.setujuLabel,
};

/**
 * Nomor WhatsApp dinormalisasi ke digit saja sebelum dicek.
 *
 * Users Indonesia menulis nomornya empat-enam cara berbeda: `0812 3456 7890`,
 * `0812-3456-7890`, `+62 812 3456 7890`, `62-812-3456-7890`. Kalau pola dicek
 * apa adanya terhadap string asli, sebagian besar orang yang benar-benar punya
 * WhatsApp akan ditolak. Jadi yang diperiksa adalah bentuk setelah dibersihkan.
 */
function digitsOf(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('62')) return '0' + d.slice(2);
  if (d.startsWith('0')) return d;
  return '0' + d;
}

/**
 * Panjang nomor Indonesia: 10-13 digit setelah normalisasi (021 + 8 digit lokal,
 * atau 08xx + 8-10 digit). Batas bawah 10 mencegah "0812" lolos; batas atas 13
 * mencegah nomor asing atau string acak yang panjangnya tidak masuk akal.
 */
const WA_MIN = 10;
const WA_MAX = 13;

/**
 * Pengecekan email sengaja tidak memakai `type="email"` bawaan browser.
 *
 * Atribut itu hanya menolak input yang tidak valid, dan tidak mencegah user
 * mengetik apa adanya lalu menekan submit - penyebab nomor satu. Validasi di
 * sini berjalan sama untuk semua browser, dan pesannya bisa ditulis dalam
 * bahasa yang sama dengan pesan error lainnya.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(v: Values): Partial<Record<FieldName, string>> {
  const e: Partial<Record<FieldName, string>> = {};

  if (!v.nama.trim()) e.nama = 'Nama lengkap wajib diisi.';
  else if (v.nama.trim().length < 3) e.nama = 'Nama lengkap terlalu pendek.';

  if (!v.sekolah.trim()) e.sekolah = 'Nama sekolah wajib diisi.';
  if (!v.kota.trim()) e.kota = 'Kota wajib diisi.';

  if (!v.kelas) e.kelas = 'Pilih kelas.';
  if (!v.jurusan) e.jurusan = 'Pilih jenis sekolah.';

  if (!v.wa.trim()) e.wa = 'Nomor WhatsApp wajib diisi.';
  else {
    const d = digitsOf(v.wa);
    if (d.length < WA_MIN || d.length > WA_MAX) {
      e.wa = `Nomor ini tidak lengkap. Setelah dibersihkan ada ${d.length} digit; idealnya 10 sampai 13.`;
    }
  }

  if (!v.email.trim()) e.email = 'Email wajib diisi.';
  else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Format email belum benar, mis. nama@sekolah.sch.id.';

  if (!v.bidang) e.bidang = 'Pilih bidang yang diikuti.';
  if (!v.setuju) e.setuju = 'Persetujuan Aturan & Transparansi wajib dicentang.';

  return e;
}

/** Ringkasan plaintext, dipakai untuk tampilan dan untuk teks yang disalin. */
function buildSummary(v: Values): string {
  const rows: Array<[FieldName, string]> = [
    ['nama', v.nama.trim()],
    ['sekolah', v.sekolah.trim()],
    ['kota', v.kota.trim()],
    ['kelas', v.kelas],
    ['jurusan', v.jurusan],
    ['wa', v.wa.trim()],
    ['email', v.email.trim()],
    ['bidang', v.bidang],
    ['setuju', v.setuju ? 'Ya' : 'Tidak'],
  ];
  const w = Math.max(...rows.map(([k]) => LABELS[k].length));
  return [
    REGISTRATION.summaryHeading + ' - Helixa Olympiad Perdana',
    '',
    ...rows.map(([k, val]) => (LABELS[k] + ':').padEnd(w + 1) + ' ' + val),
  ].join('\n');
}

/** Salin teks, dengan fallback untuk konteks non-secure (http di LAN). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Lanjut ke fallback di bawah.
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function RegistrationPage() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const summaryRef = useRef<HTMLTextAreaElement | null>(null);
  const copyTimer = useRef(0);

  /*
   * FOKUS KE JUDUL SAAT HALAMAN INI MUNCUL.
   *
   * Tanpa ini, menekan tombol "Daftar" dari navbar memindahkan isi layar tanpa
   * memindahkan fokus keyboard: orang yang sedang navigasi dengan Tab atau
   * screen reader akan tetap thinks they're di section CTA yang sekarang sudah
   * tidak ada. Fokusnya ke <h1> karena itu yang pertama kali harus dibaca.
   */
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const summary = useMemo(() => (submitted ? buildSummary(values) : ''), [submitted, values]);

  function set<K extends FieldName>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Pesan error dibersihkan begitu field-nya disentuh, tapi HANYA kalau field
    // itu sedang salah. Kalau belum pernah disubmit, tidak ada yang perlu
    // dihapus, dan menghapus apa pun di sini akan membuat pesan muncul-lalu
    // hilang tanpa sebab.
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    const bad = ORDER.find((k) => found[k]);
    if (bad) {
      setSubmitted(false);
      document.getElementById('daftar-' + bad)?.focus();
      return;
    }
    setSubmitted(true);
    /*
     * TITIK PASANG BACKEND.
     *
     * Panel ini satu-satunya tempat yang perlu disentuh kalau pendaftaran
     * dibuka. Cukup ganti `setSubmitted(true)` dengan:
     *
     *   const res = await fetch(REGISTER_URL, { method: 'POST', ... });
     *   if (!res.ok) { setErrors({ nama: 'Server menolak, coba lagi.' }); return; }
     *
     * dan REGISTER_URL di content.ts diisi endpoint aslinya. Pesan "belum
     * terkirim" di content.ts ikut dihapus saat itu.
     */
    window.setTimeout(() => summaryRef.current?.focus(), 0);
  }

  async function onCopy() {
    const ok = await copyText(summary);
    setCopied(ok);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2500);
  }

  const F = REGISTRATION.fields;

  return (
    <div className="register-wrap relative isolate overflow-x-clip">
      {/*
       * Latar 3D. `aria-hidden` dan `pointer-events-none` dipasang di dalam
       * OlympiadScene, jadi tidak ada yang bisa diklik lewat form dan tidak ada
       * yang diumumkan screen reader.
       */}
      <OlympiadScene />

      <div className="shell relative flex min-h-screen min-h-[100svh] flex-col justify-center gap-8 py-28 md:py-32">
        <div className="mx-auto w-full max-w-[46rem]">
          <Reveal className="flex flex-col items-center text-center">
            <Eyebrow>{REGISTRATION.eyebrow}</Eyebrow>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-4 font-display text-4xl leading-tight text-bone outline-none sm:text-5xl"
            >
              {REGISTRATION.title}
            </h1>
            <p className="mt-4 max-w-[52ch] text-bone-dim">{REGISTRATION.lead}</p>
          </Reveal>

          <Reveal delay={0.08}>
            {/*
             * RINGKASAN ERROR.
             *
             * `role="alert"` supaya dibacakan begitu muncul, dan tiap barisnya
             * tautan ke field yang dimaksud: tanpa itu, pesan "pilih bidang"
             * yang hanya terlihat di bawah field yang jauh tidak pernah
             * ditemukan orang yang sedang memakai screen reader.
             */}
            {Object.keys(errors).length > 0 && (
              <div
                role="alert"
                className="mt-6 rounded-2xl border border-gold-line-strong bg-ink-deep/90 p-4 text-left"
              >
                <p className="text-sm font-semibold text-gold-bright">
                  {Object.keys(errors).length} isian belum benar:
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-bone">
                  {ORDER.filter((k) => errors[k]).map((k) => (
                    <li key={k}>
                      <a href={'#daftar-' + k} className="underline decoration-gold/50 underline-offset-4">
                        {LABELS[k]}
                      </a>
                      <span className="text-bone-dim"> - {errors[k]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Reveal>

          <Reveal delay={0.16}>
            <form
              noValidate
              onSubmit={onSubmit}
              className="register-card mt-8 rounded-3xl border border-gold-line p-6 text-left sm:p-8"
            >
              <div className="grid items-stretch gap-5 sm:grid-cols-2">
                <TextField
                  name="nama"
                  label={F.nama.label}
                  hint={F.nama.hint}
                  value={values.nama}
                  autoComplete="name"
                  error={errors.nama}
                  onChange={(v) => set('nama', v)}
                />
                <TextField
                  name="sekolah"
                  label={F.sekolah.label}
                  value={values.sekolah}
                  autoComplete="organization"
                  error={errors.sekolah}
                  onChange={(v) => set('sekolah', v)}
                />
                <TextField
                  name="kota"
                  label={F.kota.label}
                  value={values.kota}
                  autoComplete="address-level2"
                  error={errors.kota}
                  onChange={(v) => set('kota', v)}
                />
                <SelectField
                  name="kelas"
                  label={F.kelas.label}
                  options={F.kelas.options}
                  value={values.kelas}
                  error={errors.kelas}
                  onChange={(v) => set('kelas', v)}
                />
                <SelectField
                  name="jurusan"
                  label={F.jurusan.label}
                  options={F.jurusan.options}
                  value={values.jurusan}
                  error={errors.jurusan}
                  onChange={(v) => set('jurusan', v)}
                />
                <TextField
                  name="wa"
                  label={F.wa.label}
                  hint={F.wa.hint}
                  value={values.wa}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0812 3456 7890"
                  error={errors.wa}
                  onChange={(v) => set('wa', v)}
                />
              </div>

              <TextField
                name="email"
                label={F.email.label}
                hint={F.email.hint}
                value={values.email}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nama@sekolah.sch.id"
                error={errors.email}
                onChange={(v) => set('email', v)}
              />

              <fieldset className="mt-5 border-0 p-0">
                <legend className="text-sm font-semibold text-bone">{F.bidangLabel}</legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {/*
                   * Radio pertama memakai id polos `daftar-bidang`, yang
                   * dengan begitu sama dengan id yang dipakai tautan ringkasan
                   * error dan `document.getElementById()` saat submit gagal.
                   * Radio berikutnya diberi akhiran angka. Jadi "lompat ke field
                   * yang salah" untuk kelompok ini mendarat di radio pertama - yang
                   * juga benar secara keyboard: memindahkan fokus ke dalam
                   * radio group harus mendarat di radio yang tercentang, atau di
                   * radio pertama kalau belum ada yang tercentang. Yang kedua
                   * persis yang terjadi di sini.
                   *
                   * Nama yang bisa dibaca tetap datang dari <label> yang
                   * membungkus input, jadi id tidak perlu ikut dibaca user.
                   */}
                  {F.bidangOptions.map((opt, i) => (
                    <label key={opt} className="field-choice">
                      <input
                        type="radio"
                        id={i === 0 ? 'daftar-bidang' : 'daftar-bidang-' + i}
                        name="bidang"
                        value={opt}
                        checked={values.bidang === opt}
                        onChange={() => set('bidang', opt)}
                        className="sr-only"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                {errors.bidang && (
                  <p id="err-bidang" className="field-error">
                    {errors.bidang}
                  </p>
                )}
              </fieldset>

              <label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 py-2">
                <input
                  type="checkbox"
                  name="setuju"
                  id="daftar-setuju"
                  checked={values.setuju}
                  onChange={(e) => set('setuju', e.target.checked)}
                  aria-invalid={errors.setuju ? true : undefined}
                  aria-describedby={errors.setuju ? 'err-setuju' : undefined}
                  className="field-check mt-0.5"
                />
                <span className="text-sm text-bone-dim">{F.setujuLabel}</span>
              </label>
              {errors.setuju && (
                <p id="err-setuju" className="field-error">
                  {errors.setuju}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-shimmer bg-gold-gradient mt-7 flex min-h-12 w-full items-center justify-center rounded-full px-6 text-[0.9375rem] font-semibold text-ink shadow-[0_10px_30px_-14px_rgba(212,175,55,0.45)]"
              >
                {REGISTRATION.submitLabel}
              </button>

              {/*
               * PENGAKUAN HONEST.
               *
               * `role="status"` dengan `aria-live="polite"`: muncul setelah
               * onSubmit selesai, bukan di tengah-tengah pengetikan, jadi tidak
               * perlu membatalkan apa pun yang sedang dibaca screen reader.
               */}
              {submitted && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-6 rounded-2xl border border-gold-line-strong bg-ink-deep/90 p-4"
                >
                  <p className="text-sm font-semibold text-gold-bright">
                    {REGISTRATION.notSentTitle}
                  </p>
                  <p className="mt-2 text-sm text-bone-dim">{REGISTRATION.notSentBody}</p>
                  <label className="sr-only" htmlFor="ringkasan">
                    {REGISTRATION.summaryHeading}
                  </label>
                  <textarea
                    ref={summaryRef}
                    id="ringkasan"
                    readOnly
                    rows={10}
                    value={summary}
                    className="field mt-3 text-xs leading-relaxed"
                  />
                  <button
                    type="button"
                    onClick={onCopy}
                    className="btn mt-3 inline-flex min-h-11 items-center justify-center rounded-full border border-gold/30 px-5 text-sm font-semibold text-bone hover:border-gold/55 hover:bg-gold/8"
                  >
                    {copied ? REGISTRATION.copiedLabel : REGISTRATION.copyLabel}
                  </button>
                </div>
              )}
            </form>
          </Reveal>

          <Reveal delay={0.24}>
            <p className="mt-8 text-center">
              <a
                href="#top"
                className="inline-flex min-h-11 items-center gap-2 text-sm text-bone-dim underline decoration-gold/40 underline-offset-4 hover:text-bone"
              >
                {REGISTRATION.backLabel}
              </a>
            </p>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type BaseProps = {
  name: FieldName;
  label: string;
  hint?: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
};

function ErrorText({ name, error }: { name: FieldName; error?: string }) {
  if (!error) return null;
  return (
    <p id={'err-' + name} className="field-error">
      {error}
    </p>
  );
}

function TextField({
  name,
  label,
  hint,
  value,
  error,
  onChange,
  type = 'text',
  ...rest
}: BaseProps & {
  type?: string;
  inputMode?: 'text' | 'tel' | 'email';
  autoComplete?: string;
  placeholder?: string;
}) {
  const id = 'daftar-' + name;
  const hintId = hint ? id + '-hint' : undefined;
  return (
    <div className="flex flex-col justify-end gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-bone">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-bone-dim">
          {hint}
        </p>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, error ? 'err-' + name : null].filter(Boolean).join(' ') || undefined}
        {...rest}
        className="field"
      />
      <ErrorText name={name} error={error} />
    </div>
  );
}

function SelectField({
  name,
  label,
  options,
  value,
  error,
  onChange,
}: BaseProps & { options: readonly string[] }) {
  const id = 'daftar-' + name;
  return (
    <div className="flex flex-col justify-end gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-bone">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'err-' + name : undefined}
        className="field"
      >
        {/*
         * Opsi pertama sengaja kosong dan TIDAK punya nilai pilihan yang sah.
         * Kalau nilainya string kosong, select akan mengirim `""` dan
         * validasi tidak bisa membedakan "tidak memilih" dari "memilih yang
         * salah".
         */}
        <option value="">- Pilih -</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ErrorText name={name} error={error} />
    </div>
  );
}
