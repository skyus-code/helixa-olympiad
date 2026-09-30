/**
 * "Kenapa Helixa" - empat kartu interaktif + header di tengah.
 *
 * Setiap kartu punya spotlight emas yang mengikuti kursor (lihat
 * SpotlightCard). Ornamen DNA di belakang diberi parallax lebih lambat dari
 * isi section, sehingga muncul kesan kedalaman saat section naik menutupi
 * hero. Parallax ini salah satu dari dua titik parallax yang diizinkan
 * (>=1024px, pointer presisi, tanpa reduced-motion).
 */
import { useRef } from 'react';
import { motion, useReducedMotion, useTransform } from 'motion/react';
import { MQ, PARALLAX } from '../lib/motion';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { RevealGroup } from './ui/Reveal';
import { SpotlightCard } from './ui/SpotlightCard';
import { DnaHelix } from './ornaments/DnaHelix';
import { WHY } from '../content';

export function WhyHelixa() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fineWide = useMediaQuery(MQ.motionFineWide);
  const reduce = useReducedMotion();

  // Progress dihitung dari window.scrollY (bukan rect elemen — section di-pin).
  // DNA bergerak sedikit keluar saat pengunjung turun lewat section ini.
  const progress = useScrollProgress(rootRef, { lead: 0.35, span: 0.85 });
  const dnaY = useTransform(progress, (p) => (fineWide && !reduce ? p * PARALLAX.dna.y : 0));
  const dnaStyle = fineWide && !reduce ? { y: dnaY } : undefined;

  return (
    <Section id="tentang" z={20} stack card>
      <motion.div
        aria-hidden="true"
        data-parallax
        className="pointer-events-none absolute -top-10 right-[-60px] hidden w-[220px] opacity-50 lg:block"
        style={dnaStyle}
      >
        <DnaHelix className="h-full w-full" />
      </motion.div>

      <div ref={rootRef} className="relative">
        <div className="section-head section-head--center">
          <Eyebrow>{WHY.eyebrow}</Eyebrow>

          <h2 className="mt-5 font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.015em] text-bone">
            {WHY.title}
          </h2>

          <p className="mt-5 text-bone-dim">{WHY.lead}</p>
        </div>

        <RevealGroup className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.items.map((item) => (
            <SpotlightCard
              key={item.number}
              as="div"
              className="flex flex-col gap-4 p-7 lg:p-8"
            >
              <span className="font-sans text-[0.75rem] tracking-[0.18em] text-gold">
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