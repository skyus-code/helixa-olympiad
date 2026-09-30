/**
 * Hero.
 *
 * Susunan dari belakang ke depan:
 *   1. HeroCanvas  - mesh WebGL (desktop) / ambient glow (mobile, reduced-motion)
 *   2. vignette    - gelapkan tepi supaya teks tetap terbaca di atas mesh
 *   3. konten      - eyebrow, headline kinetic, subteks, dua CTA, scroll hint
 *
 * Kenapa headline dipecah jadi tiga elemen terpisah, bukan satu <h1>:
 * SplitText akan memecah huruf, dan satu kata berearna gradien tidak boleh
 * ikut terpecah per huruf (gradasi akanrestart setiap huruf). Jadi kata
 * "sains" dibiarkan utuh sebagai elemen tersendiri.
 */
import { useRef } from 'react';
import { gsap } from '../lib/gsap';
import { EASE, DUR, MQ, PARALLAX } from '../lib/motion';
import { useGsapMedia } from '../hooks/useGsapMedia';
import { useKineticText } from '../hooks/useKineticText';
import { HeroCanvas } from './HeroCanvas';
import { PrimaryButton, SecondaryButton } from './ui/Buttons';
import { HERO } from '../content';

export function Hero() {
  const rootRef = useRef<HTMLElement | null>(null);
  const leadRef = useRef<HTMLSpanElement | null>(null);
  const accentRef = useRef<HTMLSpanElement | null>(null);
  const tailRef = useRef<HTMLSpanElement | null>(null);
  const chromeRef = useRef<HTMLDivElement | null>(null);

  // Kinetic typography: dua baris pertama, delay 0.1 dan 0.28.
  useKineticText(leadRef, { selector: '[data-kinetic-lead]', delay: 0.1 });
  useKineticText(accentRef, { selector: '[data-kinetic-accent]', delay: 0.28 });
  useKineticText(tailRef, { selector: '[data-kinetic-tail]', delay: 0.34 });

  // Chrome hero (eyebrow, subteks, CTA, scroll hint) muncul setelah headline
  // mulai jalan, supaya mata sudah tertarik ke sana dulu.
  useGsapMedia(MQ.motion, () => {
    const el = chromeRef.current;
    if (!el) return;
    const items = el.querySelectorAll('[data-hero-chrome]');
    if (!items.length) return;

    gsap.from(items, {
      opacity: 0,
      y: 24,
      duration: DUR.reveal,
      ease: EASE.reveal,
      stagger: 0.1,
      delay: 0.5,
      force3D: true,
    });
  });

  // Parallax latar: hero conteúdo bergerak lebih cepat dari mesh, memberi
  // rasa kedalaman tanpa perlu WebGL tambahan.
  useGsapMedia(MQ.motionFineWide, () => {
    if (!chromeRef.current) return;
    gsap.to(chromeRef.current, {
      y: PARALLAX.heroBackdrop.y,
      ease: 'none',
      scrollTrigger: {
        trigger: rootRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });
  });

  // Scroll hint ikut memudar saat halaman digulir, supaya tidak mengganggu
  // begitu pengguna sudah mulai membaca.
  useGsapMedia(MQ.motion, () => {
    const hint = rootRef.current?.querySelector('.hero-scroll-hint');
    if (!hint) return;
    gsap.to(hint, {
      opacity: 0,
      y: -12,
      ease: 'none',
      scrollTrigger: { trigger: rootRef.current, start: 'top top', end: '20% top', scrub: true },
    });
  });

  return (
    <section
      ref={rootRef}
      className="hero-section relative isolate flex min-h-[100svh] items-center overflow-x-clip"
    >
      <HeroCanvas />

      {/* Vignette: gelapkan tepi agar teks tetap terbaca di atas mesh. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_65%_at_50%_45%,transparent_0%,rgba(10,10,11,0.55)_70%,rgba(10,10,11,0.9)_100%)]"
      />

      <div ref={chromeRef} className="shell relative w-full pt-28 pb-24 md:pt-32 md:pb-28">
        <div className="max-w-2xl">
          <p data-hero-chrome className="eyebrow mb-7">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-px w-6 bg-gold/50" />
              {HERO.eyebrow}
            </span>
          </p>

          <h1 className="font-display text-[clamp(2.75rem,9vw,5.5rem)] font-semibold leading-[0.98] tracking-[-0.02em] text-bone">
            <span ref={leadRef} className="block">
              <span data-kinetic-lead className="kinetic-line block">
                {HERO.headlineLead}
              </span>
            </span>
            <span className="flex flex-wrap items-baseline">
              <span ref={accentRef} className="block">
                <span data-kinetic-accent className="kinetic-line text-gold-gradient block">
                  {HERO.headlineAccent}
                </span>
              </span>
              <span ref={tailRef} className="block">
                <span data-kinetic-tail className="kinetic-line block">
                  {HERO.headlineTail}
                </span>
              </span>
            </span>
          </h1>

          <p
            data-hero-chrome
            className="mt-8 max-w-[52ch] text-bone-dim text-[1.0625rem] leading-relaxed md:text-[1.125rem]"
          >
            {HERO.subtext}
          </p>

          <div data-hero-chrome className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryButton href={HERO.primaryCtaHref}>{HERO.primaryCta}</PrimaryButton>
            <SecondaryButton href={HERO.secondaryCtaHref}>{HERO.secondaryCta}</SecondaryButton>
          </div>
        </div>
      </div>

      <div
        className="hero-scroll-hint pointer-events-none absolute inset-x-0 bottom-7 flex justify-center"
        aria-hidden="true"
      >
        <span className="flex flex-col items-center gap-2">
          <span className="font-mono text-[0.6875rem] tracking-[0.18em] text-bone-dim uppercase">
            {HERO.scrollHint}
          </span>
          <span className="relative block h-9 w-px overflow-hidden bg-gold/20">
            <span className="absolute inset-x-0 top-0 block h-3 bg-gold/70" />
          </span>
        </span>
      </div>
    </section>
  );
}
