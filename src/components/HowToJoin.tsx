/**
 * "Cara Ikut" - empat langkah dengan garis progres.
 *
 * Garis progres memakai ScrollTrigger dengan `scrub`: panjang garis mengikuti
 * persentase section yang sudah dilewati.
 *
 * Orientasi garis berbeda antara mobile (vertikal, di kiri) dan desktop
 * (horizontal, di atas). Bukan dua markup berbeda, melainkan dua registrasi
 * matchMedia: masing-masing membangun tween dengan sumbu yang tepat, lalu GSAP
 * me-revert dan me-refresh ScrollTrigger otomatis saat breakpoint tersentuh.
 */
import { useRef } from 'react';
import { gsap } from '../lib/gsap';
import { EASE, MQ, PARALLAX } from '../lib/motion';
import { useGsapMedia } from '../hooks/useGsapMedia';
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { RevealGroup } from './ui/Reveal';
import { MathSymbols } from './ornaments/MathSymbols';
import { HOW_TO_JOIN } from '../content';

const SCRUB_TRIGGER = {
  start: 'top 72%',
  end: 'bottom 78%',
  scrub: 0.4,
} as const;

export function HowToJoin() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const symbolsRef = useRef<HTMLDivElement | null>(null);

  useGsapMedia(`${MQ.motion} and (max-width: 767px)`, () => {
    const line = progressRef.current;
    if (!line) return;
    gsap.fromTo(
      line,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: { trigger: rootRef.current, ...SCRUB_TRIGGER },
      },
    );
  });

  useGsapMedia(`${MQ.motion} and (min-width: 768px)`, () => {
    const line = progressRef.current;
    if (!line) return;
    gsap.fromTo(
      line,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { trigger: rootRef.current, ...SCRUB_TRIGGER },
      },
    );
  });

  useGsapMedia(MQ.motionFineWide, () => {
    if (!symbolsRef.current) return;
    gsap.to(symbolsRef.current, {
      y: PARALLAX.symbols.y,
      ease: 'none',
      scrollTrigger: {
        trigger: rootRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  });

  // Overlap 2: isi section naik dari bawah menimpa ekor Perdana yang masih
  // terlihat di layar. Perbatasan antar section terasa seperti dua lapisan
  // yang saling melintas, bukan sekadar potongan yang bertumpuk.
  useGsapMedia(MQ.motion, () => {
    if (!rootRef.current) return;
    gsap.fromTo(
      rootRef.current,
      { y: 150 },
      {
        y: 0,
        ease: EASE.reveal,
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top bottom',
          end: 'top 35%',
          scrub: true,
        },
      },
    );
  });

  return (
    <Section id="cara-ikut">
      <div
        ref={symbolsRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden overflow-hidden opacity-[0.045] lg:block"
      >
        <MathSymbols className="relative h-full w-full" />
      </div>

      <div ref={rootRef} className="relative">
        <Eyebrow>{HOW_TO_JOIN.eyebrow}</Eyebrow>

        <h2 className="mt-5 max-w-[18ch] font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.015em] text-bone">
          {HOW_TO_JOIN.title}
        </h2>

        <p className="mt-5 max-w-[46ch] text-bone-dim">{HOW_TO_JOIN.lead}</p>

        <RevealGroup selector="[data-step]" className="relative mt-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-2 bottom-2 left-[1.375rem] w-px bg-gold-line md:top-[1.375rem] md:right-0 md:bottom-auto md:left-0 md:h-px md:w-auto"
          >
            <div
              ref={progressRef}
              className="h-full w-full origin-top bg-gold-gradient md:origin-left"
            />
          </div>

          <ol className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-x-10 md:gap-y-12 lg:grid-cols-4 lg:gap-8">
            {HOW_TO_JOIN.steps.map((step) => (
              <li key={step.number} data-step className="relative flex gap-5 md:block">
                <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold-line bg-ink font-mono text-[0.75rem] text-gold">
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
          </ol>
        </RevealGroup>
      </div>
    </Section>
  );
}
