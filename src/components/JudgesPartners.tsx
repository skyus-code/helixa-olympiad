/**
 * "Juri & Mitra" - tiga kartu placeholder dengan monogram emas.
 *
 * Monogram memakai inisial dalam cincin emas, bukan gambar. Semua identitas
 * masih placeholder, jadi tidak ada aset gambar yang perlu dibuat sekarang
 * dan tidak ada foto orang fiktif yang bisa disalahartikan sebagai nyata.
 */
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { RevealGroup } from './ui/Reveal';
import { SpotlightCard } from './ui/SpotlightCard';
import { JUDGES } from '../content';

export function JudgesPartners() {
  return (
    <Section id="juri" z={50} card>
      <Eyebrow>{JUDGES.eyebrow}</Eyebrow>

      <h2 className="mt-5 max-w-[18ch] font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.015em] text-bone">
        {JUDGES.title}
      </h2>

      <p className="mt-5 max-w-[46ch] text-bone-dim">{JUDGES.lead}</p>

      <RevealGroup className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {JUDGES.items.map((person) => (
          <SpotlightCard key={person.monogram} as="div" className="flex flex-col gap-5 p-7">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-gold-line-strong font-display text-2xl font-semibold text-gold"
            >
              {person.monogram}
            </span>

            <div className="flex flex-col gap-2">
              <span className="font-sans text-[0.6875rem] tracking-[0.18em] text-bone-dim uppercase">
                {person.kind}
              </span>
              <h3 className="text-[1.0625rem] leading-snug font-semibold text-bone">
                {person.name}
              </h3>
              <p className="text-[0.875rem] leading-relaxed text-bone-dim">{person.role}</p>
            </div>
          </SpotlightCard>
        ))}
      </RevealGroup>
    </Section>
  );
}