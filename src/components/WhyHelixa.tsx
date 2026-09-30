/**
 * "Kenapa Helixa" - empat kartu interaktif.
 *
 * Setiap kartu punya spotlight emas yang mengikuti kursor (lihat
 * SpotlightCard). Ornamen DNA di belakang diberi parallax lebih lambat dari
 * isi section, sehingga muncul kesan kedalaman.
 *
 * Catatan grid: pemisah antar kartu dibuat dengan `gap-px` di atas latar
 * `bg-gold-line`, bukan border per kartu. Border per kartu akan menghasilkan
 * garis ganda (1px kartu + 1px gap) yang terlihat tebal di ukuran 320px.
 */
import { useRef } from 'react';
import { gsap } from '../lib/gsap';
import { MQ, PARALLAX } from '../lib/motion';
import { useGsapMedia } from '../hooks/useGsapMedia';
import { useKineticText } from '../hooks/useKineticText';
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { RevealGroup } from './ui/Reveal';
import { SpotlightCard } from './ui/SpotlightCard';
import { DnaHelix } from './ornaments/DnaHelix';
import { WHY } from '../content';

export function WhyHelixa() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dnaRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLSpanElement | null>(null);

  useKineticText(titleRef, { selector: '[data-kinetic-title]' });

  useGsapMedia(MQ.motionFineWide, () => {
    if (!dnaRef.current) return;
    gsap.to(dnaRef.current, {
      y: PARALLAX.dna.y,
      ease: 'none',
      scrollTrigger: {
        trigger: rootRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  });

  return (
    <Section id="tentang">
      <div
        ref={dnaRef}
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 right-[-60px] hidden w-[220px] opacity-50 lg:block"
      >
        <DnaHelix className="h-full w-full" />
      </div>

      <div ref={rootRef} className="relative">
        <Eyebrow>{WHY.eyebrow}</Eyebrow>

        <h2 className="mt-5 max-w-[18ch] font-display text-[clamp(2.25rem,6vw,3.75rem)] font-semibold leading-[1.05] tracking-[-0.015em] text-bone">
          <span ref={titleRef}>
            <span data-kinetic-title className="kinetic-line block">
              {WHY.title}
            </span>
          </span>
        </h2>

        <p className="mt-5 max-w-[46ch] text-bone-dim">{WHY.lead}</p>

        <RevealGroup
          selector="[data-spotlight-card]"
          className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-gold-line bg-gold-line sm:grid-cols-2 lg:grid-cols-4"
        >
          {WHY.items.map((item) => (
            <SpotlightCard
              key={item.number}
              as="div"
              className="flex flex-col gap-4 border-0 bg-surface p-7 lg:p-8"
            >
              <span className="font-mono text-[0.75rem] tracking-[0.18em] text-gold">
                {item.number}
              </span>
              <h3 className="font-display text-[1.75rem] leading-tight font-semibold text-bone">
                {item.title}
              </h3>
              <p className="text-[0.9375rem] leading-relaxed text-bone-dim">{item.body}</p>
            </SpotlightCard>
          ))}
        </RevealGroup>
      </div>
    </Section>
  );
}
