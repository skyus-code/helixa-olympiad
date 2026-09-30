/**
 * Hero.
 *
 * Susunan dari belakang ke depan:
 *   1. .hero-ambient - glow radial (CSS murni, bukan WebGL), statis; parallax
 *      datang dari transform yang ditulis paket `motion` saat scroll.
 *   2. vignette      - gelapkan tepi supaya teks tetap terbaca.
 *   3. konten        - eyebrow, headline kinetic, subteks, dua CTA, scroll hint.
 *
 * Headline dipecah jadi tiga elemen (lead / accent / tail) sesuai konten.
 * "sains" dibiarkan utuh sengaja supaya gradient emas tidak restart per huruf.
 * Tiap baris naik dari dalam mask overflow (kinetic) satu kali saat mount —
 * bukan loop, bukan scroll-linked.
 */
import { useRef, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { DUR, EASE, MQ, PARALLAX } from '../lib/motion';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { PrimaryButton, SecondaryButton } from './ui/Buttons';
import { HERO } from '../content';

/** Baris headline yang naik dari dalam mask, sekali saat mount. */
function KineticLine({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <span className={'kinetic-line block ' + className}>
      {reduce ? (
        children
      ) : (
        <motion.span
          className="block will-change-transform"
          initial={{ y: '110%' }}
          animate={{ y: '0%' }}
          transition={{ duration: DUR.kinetic, delay, ease: EASE.kinetic }}
        >
          {children}
        </motion.span>
      )}
    </span>
  );
}

/** Chrome hero (eyebrow, subteks, CTA): fade + naik, sekali. */
function FadeUp({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.reveal, delay, ease: EASE.reveal }}
    >
      {children}
    </motion.div>
  );
}

export function Hero() {
  const rootRef = useRef<HTMLElement | null>(null);
  const fineWide = useMediaQuery(MQ.motionFineWide);
  const reduce = useReducedMotion();
  const parallaxOn = fineWide && !reduce;

  // Parallax & fade-hint berbasis scroll JENDELA: section di-pin `top: 0`
  // (sticky stack), jadi rect elemen tidak bergerak lagi setelah tertahan —
  // `window.scrollY` yang terus berjalan dipakai sebagai sumbernya.
  const { scrollY } = useScroll();
  const ambientY = useTransform(scrollY, [0, 1200], [0, PARALLAX.heroBackdrop.y]);
  const ambientStyle = parallaxOn ? { y: ambientY } : undefined;
  const hintOpacity = useTransform(scrollY, [0, 220], [1, 0]);
  const hintStyle = !reduce ? { opacity: hintOpacity } : undefined;

  return (
    <section
      ref={rootRef}
      className="hero-section stack-wrap isolate flex min-h-[100svh] items-center overflow-x-clip"
      style={{ zIndex: 10, scrollMarginTop: 88 }}
    >
      {/* Ambient glow statis; parallax ditulis paket motion saat fineWide. */}
      <motion.div
        aria-hidden="true"
        data-parallax
        className="hero-ambient pointer-events-none absolute inset-0"
        style={ambientStyle}
      />

      {/* Vignette: gelapkan tepi agar teks tetap terbaca. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_65%_at_50%_45%,transparent_0%,rgba(10,10,11,0.55)_70%,rgba(10,10,11,0.9)_100%)]"
      />

      <div className="shell relative w-full pt-28 pb-24 md:pt-32 md:pb-28">
        <div className="max-w-2xl">
          <FadeUp delay={0.55}>
            <p className="eyebrow mb-7">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="inline-block h-px w-6 bg-gold/50" />
                {HERO.eyebrow}
              </span>
            </p>
          </FadeUp>

          <h1 className="font-display text-[clamp(2.75rem,9vw,5.5rem)] font-semibold leading-[0.98] tracking-[-0.02em] text-bone">
            <KineticLine delay={0.1}>{HERO.headlineLead}</KineticLine>
            <span className="flex flex-wrap items-baseline">
              <KineticLine delay={0.28} className="text-gold-gradient">
                {HERO.headlineAccent}
              </KineticLine>
              <KineticLine delay={0.34}>{HERO.headlineTail}</KineticLine>
            </span>
          </h1>

          <FadeUp delay={0.72}>
            <p className="mt-8 max-w-[52ch] text-bone-dim text-[1.0625rem] leading-relaxed md:text-[1.125rem]">
              {HERO.subtext}
            </p>
          </FadeUp>

          <FadeUp delay={0.84}>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <PrimaryButton href={HERO.primaryCtaHref}>{HERO.primaryCta}</PrimaryButton>
              <SecondaryButton href={HERO.secondaryCtaHref}>{HERO.secondaryCta}</SecondaryButton>
            </div>
          </FadeUp>
        </div>
      </div>

      <motion.div
        aria-hidden="true"
        className="hero-scroll-hint pointer-events-none absolute inset-x-0 bottom-7 flex justify-center"
        style={hintStyle}
      >
        <span className="flex flex-col items-center gap-2">
          <span className="font-sans text-[0.6875rem] tracking-[0.18em] text-bone-dim uppercase">
            {HERO.scrollHint}
          </span>
          <span className="relative block h-9 w-px overflow-hidden bg-gold/20">
            <span className="absolute inset-x-0 top-0 block h-3 bg-gold/70" />
          </span>
        </span>
      </motion.div>
    </section>
  );
}