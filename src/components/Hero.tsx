import { m, useReducedMotion as useMotionReducedMotion } from 'motion/react';
import { DnaHelix } from './ornaments/DnaHelix';
import { useParallax } from '../hooks/useParallax';
import { PrimaryButton, SecondaryButton } from './ui/Buttons';
import { Eyebrow } from './ui/Eyebrow';
import { HERO } from '../content';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const helixRef = useParallax(60);
  const glowRef = useParallax(60);
  const motionReduced = useMotionReducedMotion();

  const rise = (delay: number) =>
    motionReduced
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: EASE },
        };

  return (
    <section
      id="top"
      className="hero-section relative flex min-h-svh items-center overflow-x-clip pt-28 pb-20 md:pt-32 md:pb-24 lg:min-h-svh lg:pt-36 lg:pb-28"
    >
      {/* Cahaya radial emas sangat halus (opacity <= 0.16) di atas hitam */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute inset-0 opacity-60 md:opacity-100"
      />

      {/* Ornamen heliks: di belakang & lebih samar di ponsel, di kanan saat desktop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          ref={helixRef}
          className="hero-helix absolute top-1/2 left-1/2 h-[62svh] max-h-[520px] w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.10] lg:top-1/2 lg:right-[4%] lg:left-auto lg:h-[86%] lg:max-h-[720px] lg:translate-x-0 lg:opacity-[0.30]"
        >
          <DnaHelix className="h-full w-full" />
        </div>
      </div>

      <div className="shell relative z-10">
        <div className="mx-auto max-w-[42rem] text-center lg:mx-0 lg:max-w-[38rem] lg:text-left">
          <m.div {...rise(0)}>
            <Eyebrow>{HERO.eyebrow}</Eyebrow>
          </m.div>

          <m.h1
            {...rise(0.1)}
            className="mt-6 font-display text-[clamp(2.5rem,8vw,5.5rem)] leading-[1.02] font-semibold tracking-[-0.02em] text-balance text-bone"
          >
            {HERO.headlineLead}{' '}
            <span className="text-gold-gradient">{HERO.headlineAccent}</span>
            {HERO.headlineTail}
          </m.h1>

          <m.p
            {...rise(0.2)}
            className="mx-auto mt-7 max-w-[34rem] text-[1.0625rem] leading-1.7 text-pretty text-bone-dim lg:mx-0"
          >
            {HERO.subtext}
          </m.p>

          <m.div
            {...rise(0.3)}
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start"
          >
            <PrimaryButton href={HERO.primaryCtaHref} className="w-full sm:w-auto">
              {HERO.primaryCta}
            </PrimaryButton>
            <SecondaryButton href={HERO.secondaryCtaHref} className="w-full sm:w-auto">
              {HERO.secondaryCta}
            </SecondaryButton>
          </m.div>
        </div>
      </div>

      {/* Petunjuk scroll kecil */}
      <m.div
        {...rise(0.45)}
        className="hero-scroll-hint absolute inset-x-0 bottom-6 z-10 flex justify-center lg:bottom-9 lg:left-0 lg:right-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <a
          href="#tentang"
          className="group inline-flex min-h-11 items-center gap-2.5 text-[0.6875rem] font-medium tracking-[0.18em] text-bone-dim/80 uppercase transition-colors duration-300 ease-out hover:text-gold"
        >
          <span className="h-px w-8 bg-gold/40 transition-all duration-300 ease-out group-hover:w-11 group-hover:bg-gold/70" />
          {HERO.scrollHint}
        </a>
      </m.div>
    </section>
  );
}
