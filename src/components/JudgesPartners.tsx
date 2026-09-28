import { Section } from './ui/Section';
import { Reveal } from './ui/Reveal';
import { Eyebrow } from './ui/Eyebrow';
import { Placeholder } from './ui/Placeholder';
import { JUDGES } from '../content';

export function JudgesPartners() {
  return (
    <Section id="juri-mitra">
      <Reveal className="max-w-[38rem]">
        <Eyebrow>{JUDGES.eyebrow}</Eyebrow>
        <h2 className="mt-5 font-display text-[clamp(1.875rem,4vw,3rem)] leading-[1.08] font-semibold tracking-[-0.015em] text-bone">
          {JUDGES.title}
        </h2>
        <p className="mt-5 text-pretty text-bone-dim">{JUDGES.lead}</p>
      </Reveal>

      <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-18 lg:grid-cols-3">
        {JUDGES.items.map((person, i) => (
          <Reveal
            as="li"
            key={`${person.kind}-${i}`}
            delay={i * 80}
            className="card-hover flex h-full flex-col items-center rounded-2xl border border-gold-line bg-surface p-7 text-center lg:p-8"
          >
            {/* Avatar berupa lingkaran monogram emas, bukan foto */}
            <span
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/6 font-display text-2xl font-semibold text-gold"
            >
              {person.monogram}
            </span>

            <p className="mt-6 text-[0.6875rem] font-semibold tracking-[0.18em] text-gold/70 uppercase">
              {person.kind === 'juri' ? 'Juri' : 'Mitra'}
            </p>

            <h3 className="mt-3 font-display text-[1.75rem] leading-[1.15] font-semibold text-balance text-bone">
              <Placeholder>{person.name}</Placeholder>
            </h3>

            <p className="mt-2.5 text-[0.875rem] leading-1.7 text-pretty text-bone-dim">
              <Placeholder>{person.role}</Placeholder>
            </p>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
