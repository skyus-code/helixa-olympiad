/**
 * "Aturan & Transparansi" - daftar aturan dengan penomoran romawi.
 *
 * Header sengaja rata KANAN (satu-satunya section yang begitu) dengan lebar
 * ~38ch, sedangkan daftar aturan tetap di kiri (max 65ch agar baris nyaman
 * dibaca). Garis emas tipis di atas daftar membesar dari kiri saat section
 * masuk layar (gerakan garis pembatas).
 *
 * ARMILLARY: TENGAH SECTION, SEBESAR MOTIF HERO
 * ---------------------------------------------
 * Permintaan eksplisit: objek 3D section ini digeser ke tengah-tengah dan
 * dibesar sampai seukuran objek 3D di Hero. Jadi ia TIDAK lagi menjadi
 * dekorasi pinggir.
 *
 * Konsekuensi yang harus diterima dengan sadar: armillary sekarang melintas
 * di belakang daftar aturan dan header. Itu pilihan, bukan kelalaian, dan
 * karena itu legibilitas tidak boleh diserahkan pada perasaan:
 *
 *   - `.rules-gyro` di index.css memakai `opacity: 0.16`, dan canvas di dalamnya
 *     `opacity-70`, jadi cincin efektif 0.112. Angka itu turun drastis karena
 *     sekarang cincin melintas di belakang paragraf: pada 0.5 (efektif 0.35)
 *     rasio kontras WCAG terburuk hanya 2.19:1, jauh di bawah ambang AA. Ini
 *     bukan sekadar penyetelan: pada latar sedekat hitam dengan teks terang,
 *     tidak ada opasitas yang sekaligus membuat cincin mencolok dan menjaga
 *     teks di atas 4.5:1. Yang dikorbankan adalah TERANG, bukan UKURAN -
 *     permintaan "seukuran objek Hero" menyangkut ukuran dan tetap terpenuhi
 *     penuh.
 *   - `verify.mjs` menghitung rasio kontras WCAG dari EMPAT blok teks di depan
 *     armillary (daftar aturan, eyebrow, judul, lead), masing-masing dengan
 *     warnanya sendiri, selama 300 bingkai, dan menuntut yang terburuk tetap
 *     >= 4.5:1. Jendela 300 bingkai itu wajib: puncak alpha cincin hanya
 *     dijumpai di fase rotasi tertentu, dan nilainya di sana bisa lebih dari
 *     dua kali lipat.
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

export function RulesTransparency() {
  return (
    <Section id="aturan" z={60} card decor={<GyroCanvas className="rules-gyro" />}>
      <div className="section-head section-head--right">
        <Eyebrow>{RULES.eyebrow}</Eyebrow>

        <h2 className="mt-5 font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.015em] text-bone">
          {RULES.title}
        </h2>

        <p className="mt-5 text-bone-dim">{RULES.lead}</p>
      </div>

      <div className="mt-12 max-w-[65ch]">
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
    </Section>
  );
}
