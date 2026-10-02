/**
 * "Cara Ikut" - empat langkah dengan garis progres yang mengunci scroll.
 *
 * MARKUP dikembalikan persis ke versi sebelum revisi ke-4: eyebrow + judul
 * terpusat, garis emas, lalu empat langkah dalam satu baris dengan lingkaran
 * bernomor. Yang berubah hanya sumber nilai progresnya, bukan tampilannya.
 *
 * Dua sumber progres, dipilih bergantian, tidak pernah aktif bersamaan:
 *
 *   - mode 'rich' (GSAP ScrollTrigger): section di-pin, halaman tertahan di
 *     sini, dan scroll vertikal mengisi garis ke kanan sampai penuh. Baru
 *     setelah penuh, scroll dilepas ke section berikutnya. Ada runway scroll
 *     yang disengaja supaya ada "waktu" untuk mengisi garis.
 *   - mode lain: `useScrollProgress` yang lama, persis seperti sebelum
 *     revisi ke-4. Tidak ada lock, tidak ada pin, dan tidak ada listener
 *     GSAP yang diunduh di ponsel.
 *
 * Kenapa bukan satu jalur untuk semua mode: scroll lock adalah fitur BARU,
 * dan aturan proyek ini menyatakan mode 'simple' tidak boleh berubah sama
 * sekali. Memaksakan lock di ponsel berarti mengubahnya.
 *
 * Kenapa `useScrollProgress` lama tidak bisa dipakai untuk lock: ia menghitung
 * progress dari `window.scrollY` terhadap rentang yang diukur sekali. Itu benar
 * untuk "garis yang mengisi sambil lalu", tapi tidak bisa MEMAKAN scroll - tidak
 * ada runway, jadi begitu wheel pertama dipakai halaman sudah bergeser ke
 * section berikutnya. Runway itulah pekerjaan ScrollTrigger.
 */
import { useRef, type RefObject } from 'react';
import { motion, useReducedMotion, useTransform } from 'motion/react';
import { useMotionMode } from '../hooks/useMotionMode';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { useScrollLockTimeline } from '../hooks/useGsapScrollLock';
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { RevealGroup } from './ui/Reveal';
import { MathSymbols } from './ornaments/MathSymbols';
import { HOW_TO_JOIN } from '../content';

/** Track 1px tempat garis tumbuh. Sama untuk kedua mode. */
const TRACK_CLASS =
  'pointer-events-none absolute top-2 bottom-2 left-[1.375rem] w-px bg-gold-line md:top-[1.375rem] md:right-0 md:bottom-auto md:left-0 md:h-px md:w-auto';

/**
 * Track + garis yang dikendalikan ScrollTrigger. `fill` ditulis lewat
 * `transform` oleh hook, bukan lewat React, supaya tidak ada re-render di
 * tengah gerakan scroll.
 */
function LockedLine({ fillRef }: { fillRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div aria-hidden="true" className={TRACK_CLASS}>
      <div
        ref={fillRef}
        className="timeline-progress-fill h-full w-full origin-left bg-gold-gradient"
      />
    </div>
  );
}

/**
 * Track + garis yang mengikuti scroll tanpa lock. Ini jalur mode 'simple' dan
 * reduced-motion, dan isinya sama persis dengan versi sebelum revisi ke-4:
 * satu sumbu tumbuh dari atas di mobile, dari kiri di desktop.
 */
function ScrollDrivenLine({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const reduce = useReducedMotion();
  const progress = useScrollProgress(rootRef, { lead: 0.15, span: 0.85 });
  // Reduced-motion: garis ditampilkan penuh dan diam, bukan hasil scroll.
  const lineT = useTransform(progress, (p) => (reduce ? 1 : p));

  return (
    <div aria-hidden="true" className={TRACK_CLASS}>
      <motion.div
        className="h-full w-full origin-top bg-gold-gradient md:origin-left"
        style={{ scaleX: lineT, scaleY: lineT }}
      />
    </div>
  );
}

export function HowToJoin() {
  const mode = useMotionMode();
  const reduce = useReducedMotion();

  // Dua ref, dua keperluan, jangan ditukar.
  //
  // `sectionRef` dipakai ScrollTrigger sebagai target PIN, jadi harus section
  // penuh - mem-pin elemen di dalamnya hanya akan menahan kotak kontennya,
  // sementara garis rambut dan latar section tetap ikut bergeser.
  //
  // `rootRef` dipakai `useScrollProgress` untuk mengukur posisi konten terhadap
  // dokumen, sama seperti versi sebelum revisi ke-4.
  const sectionRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const locked = mode === 'rich' && !reduce;

  useScrollLockTimeline({
    sectionRef,
    fillRef,
    stepRefs,
    enabled: locked,
  });

  const symbolsParallax = mode === 'rich';

  return (
    <Section id="cara-ikut" z={40} card ref={sectionRef}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden overflow-hidden opacity-[0.045] lg:block"
      >
        <MathSymbols className="relative h-full w-full" parallax={symbolsParallax} />
      </div>

      <div className="relative">
        <div className="section-head section-head--center">
          <Eyebrow>{HOW_TO_JOIN.eyebrow}</Eyebrow>

          <h2 className="mt-5 font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.015em] text-bone">
            {HOW_TO_JOIN.title}
          </h2>

          <p className="mt-5 text-bone-dim">{HOW_TO_JOIN.lead}</p>
        </div>

        <div className="relative mt-14">
          {locked ? <LockedLine fillRef={fillRef} /> : <ScrollDrivenLine rootRef={rootRef} />}

          <RevealGroup
            as="ol"
            className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-x-10 md:gap-y-12 lg:grid-cols-4 lg:gap-8"
          >
            {HOW_TO_JOIN.steps.map((step, i) => (
              <li key={step.number} className="relative flex gap-5 md:block">
                <span
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  className="step-node relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold-line bg-ink font-sans text-[0.75rem] text-gold"
                >
                  {step.number}
                </span>
                <div className="md:mt-5">
                  <h3 className="font-display text-[1.75rem] leading-tight font-semibold text-bone">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[32ch] text-[0.9375rem] leading-relaxed text-bone-dim">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </RevealGroup>
        </div>
      </div>
    </Section>
  );
}
