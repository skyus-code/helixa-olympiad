/**
 * "Aturan & Transparansi" - daftar aturan dengan penomoran romawi.
 *
 * Header sengaja rata KANAN (satu-satunya section yang begitu) dengan lebar
 * ~38ch, sedangkan daftar aturan tetap di kiri (max 65ch agar baris nyaman
 * dibaca). Garis emas tipis di atas daftar membesar dari kiri saat section
 * masuk layar (gerakan garis pembatas).
 *
 * Di sisi kanan section ada kanvas armillary (cincin presisi berlapis) lewat
 * GyroCanvas. Bentuknya dipilih karena maknanya, bukan cuma karena param
 * visualnya: cincin berlapis = ketertiban, wireframe tembus pandang =
 * transparansi, gerakan yang konsisten dan dapat diprediksi = kepercayaan.
 *
 * POSISI ARMILLARY: KOLOM KANAN, SEJENJAK DAFTAR ATURAN
 * -----------------------------------------------------
 * Susunan aslinya dipertahankan: header penuh di atas, daftar aturan di bawahnya
 * selebar 65ch. Hanya itu yang membuat separuh kanan baris daftar kosong.
 * Armillary mengisi ruang kosong itu, dan itu disengaja karena dua alasan
 * sekaligus:
 *
 *   1. Objeknya tidak pernah menutupi teks. Kalau armillary memenuhi seluruh
 *      section, cincinnya melingkari paragraf aturan dan teksnya jadi sulit
 *      dibaca. Memberinya kolom sendiri membuat tabrakan mustahil secara
 *      struktur, bukan hanya kebetulan pada lebar tertentu.
 *   2. Kotak kanvasnya jadi persegi dan berukuran tetap, jadi cincin utuh.
 *      Ini yang memperbaiki keluhan "3D-nya hilang-hilang": lihat catatan
 *      panjang di `three/gyroscope.ts` soal apa yang sebenarnya membuat cincin
 *      terpenggal.
 *
 * Di bawah `lg` gridnya runtuh jadi satu kolom dan kotak armillary hilang
 * (`hidden`) - di lebar itu tidak ada ruang kosong yang bisa dipakai, dan
 * GyroCanvas sendiri sudah tidak merender di luar mode 'rich' anyway.
 *
 * Fallback mode simple/reduced: section ini tidak punya ornamen SVG pengganti
 * (berbeda dengan Hero), karena armillary adalah bonus - daftar aturannya
 * harus terbaca penuh tanpa objek apa pun.
 */
import { Reveal, RevealGroup } from './ui/Reveal';
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { GyroCanvas } from './GyroCanvas';
import { RULES } from '../content';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/**
 * Lebar maksimum kotak armillary. Di bawah 380px cincinnya jadi terlalu kecil
 * untuk dibaca sebagai cincin, dan di atas itu kotak mulai memakan ruang kosong
 * yang cuma ada di layar lebar.
 */
const GYRO_MAX = 380;

export function RulesTransparency() {
  return (
    <Section id="aturan" z={60} card>
      {/*
       * Grid hanya di `lg` ke atas. Kolom pertama selebar 65ch - lebar yang
       * dipakai daftar -, kolom kedua adalah sisa ruang shell, tempat armillary.
       * Di bawah `lg` semuanya satu kolom dan urutannya mengikuti DOM: header,
       * daftar aturan. Itu persis urutan membacanya.
       */}
      <div className="grid lg:grid-cols-[minmax(0,65ch)_minmax(0,1fr)] lg:gap-x-12 xl:gap-x-16">
        {/* Baris 1, melintasi kedua kolom: header rata kanan seperti aslinya. */}
        <div className="section-head section-head--right lg:col-span-2">
          <Eyebrow>{RULES.eyebrow}</Eyebrow>

          <h2 className="mt-5 font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.015em] text-bone">
            {RULES.title}
          </h2>

          <p className="mt-5 text-bone-dim">{RULES.lead}</p>
        </div>

        {/* Baris 2, kolom kiri: daftar aturan. */}
        <div className="mt-12 lg:col-start-1 lg:row-start-2">
          <Reveal variant="x">
            <div aria-hidden="true" className="gold-rule h-px w-full" />
          </Reveal>

          <RevealGroup as="ol">
            {RULES.items.map((rule, i) => (
              <li
                key={rule}
                className="flex gap-5 border-b border-gold-line py-6 transition-colors duration-300 ease-out hover:bg-gold/[0.03]"
              >
                <span
                  aria-hidden="true"
                  className="shrink-0 pt-1 font-sans text-[0.75rem] tracking-[0.18em] text-gold"
                >
                  {NUMERALS[i] ?? i + 1}
                </span>
                <p className="text-[1.0625rem] leading-relaxed text-bone/90">{rule}</p>
              </li>
            ))}
          </RevealGroup>
        </div>

        {/*
         * Baris 2, kolom kanan: kotak armillary.
         *
         * Kotak Persegi di dalam flow, bukan `absolute inset-0` ke seluruh
         * section. `aspect-square` menjaga aspect 1:1 di semua lebar, jadi
         * kamera three.js tidak perlu ikut menebalkan fov, dan cincinnya tidak
         * pernah keluar dari kotaknya.
         */}
        <div
          className="relative mt-12 hidden w-full overflow-hidden lg:col-start-2 lg:row-start-2 lg:ml-auto lg:block"
          style={{ aspectRatio: '1 / 1', maxWidth: GYRO_MAX }}
        >
          <GyroCanvas className="rules-gyro" />
        </div>
      </div>
    </Section>
  );
}
