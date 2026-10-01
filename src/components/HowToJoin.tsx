/**
 * "Cara Ikut" - empat langkah dengan garis progres yang mengikuti scroll.
 *
 * Garis progres memakai `useScrollProgress` (progress dari window.scrollY,
 * karena section di-pin `top: 0` sehingga rect elemen tidak lagi bergerak -
 * lihat hooks/useScrollProgress.ts). Satu elemen, dua sumbu: mobile garis
 * vertikal tumbuh dari atas (scaleY, origin-top); desktop garis horizontal
 * tumbuh dari kiri (scaleX, origin-left). Sumbu yang tidak relevan berada di
 * elemen dengan ketebalan 1px, jadi tidak terlihat.
 *
 * Simbol matematika latar (Sigma, phi, f(x)) memakai parallax scroll-based
 * dengan kecepatan berbeda-beda; detail mekanismenya ada di MathSymbols.tsx.
 * Parallax ini hanya dipasang di mode 'rich' - di bawah itu simbolnya tetap
 * tampil diam sebagai latar dekoratif, bukan hilang, karena teks langkah
 * tidak bergantung padanya.
 */
import { useRef } from 'react';
import { motion, useReducedMotion, useTransform } from 'motion/react';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { useMotionMode } from '../hooks/useMotionMode';
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { RevealGroup } from './ui/Reveal';
import { MathSymbols } from './ornaments/MathSymbols';
import { HOW_TO_JOIN } from '../content';

export function HowToJoin() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();
  const mode = useMotionMode();

  const progress = useScrollProgress(rootRef, { lead: 0.15, span: 0.85 });
  // Reduced-motion: garis ditampilkan penuh dan diam, bukan hasil scroll.
  const lineT = useTransform(progress, (p) => (reduce ? 1 : p));

  // Parallax simbol hanya di mode 'rich'. Di 'simple'/'reduced' MathSymbols
  // dirender tanpa motion sama sekali (statis), bukan disembunyikan.
  const symbolsParallax = mode === 'rich';

  return (
    <Section id="cara-ikut" z={40} card>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden overflow-hidden opacity-[0.045] lg:block"
      >
        <MathSymbols className="relative h-full w-full" parallax={symbolsParallax} />
      </div>

      <div ref={rootRef} className="relative">
        <div className="section-head section-head--center">
          <Eyebrow>{HOW_TO_JOIN.eyebrow}</Eyebrow>

          <h2 className="mt-5 font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.015em] text-bone">
            {HOW_TO_JOIN.title}
          </h2>

          <p className="mt-5 text-bone-dim">{HOW_TO_JOIN.lead}</p>
        </div>

        <div className="relative mt-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-2 bottom-2 left-[1.375rem] w-px bg-gold-line md:top-[1.375rem] md:right-0 md:bottom-auto md:left-0 md:h-px md:w-auto"
          >
            <motion.div
              className="h-full w-full origin-top bg-gold-gradient md:origin-left"
              style={{ scaleX: lineT, scaleY: lineT }}
            />
          </div>

          <RevealGroup
            as="ol"
            className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-x-10 md:gap-y-12 lg:grid-cols-4 lg:gap-8"
          >
            {HOW_TO_JOIN.steps.map((step) => (
              <li key={step.number} className="relative flex gap-5 md:block">
                <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold-line bg-ink font-sans text-[0.75rem] text-gold">
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