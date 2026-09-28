import { Section } from './ui/Section';
import { Reveal } from './ui/Reveal';
import { Eyebrow } from './ui/Eyebrow';
import { Placeholder } from './ui/Placeholder';
import { PrimaryButton } from './ui/Buttons';
import { PERDANA } from '../content';

export function PerdanaInfo() {
  return (
    <Section id="perdana">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
        <Reveal>
          <Eyebrow>{PERDANA.eyebrow}</Eyebrow>
          <h2 className="mt-5 font-display text-[clamp(1.875rem,4vw,3rem)] leading-[1.08] font-semibold tracking-[-0.015em] text-balance text-bone">
            {PERDANA.title}
          </h2>
          <p className="mt-5 text-pretty text-bone-dim">{PERDANA.lead}</p>
          <div className="mt-9">
            <PrimaryButton href={PERDANA.ctaHref}>{PERDANA.ctaLabel}</PrimaryButton>
          </div>
        </Reveal>

        {/* Daftar berlabel bertumpuk di ponsel, dua kolom label-nilai di >= 768px.
            Bukan tabel, jadi tidak pernah memaksa scroll horizontal. */}
        <Reveal delay={80}>
          <dl className="rounded-2xl border border-gold-line bg-surface p-6 sm:p-8">
            {PERDANA.details.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-1 gap-x-8 gap-y-1.5 py-4 md:grid-cols-[minmax(0,9rem)_1fr] md:gap-y-0 md:py-4 ${
                  i > 0 ? 'border-t border-gold-line' : ''
                }`}
              >
                <dt className="text-[0.75rem] font-semibold tracking-[0.14em] text-gold/80 uppercase md:pt-1">
                  {row.label}
                </dt>
                <dd className="text-[0.9375rem] leading-1.7 text-pretty text-bone">
                  {row.placeholder ? <Placeholder>{row.value}</Placeholder> : row.value}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </Section>
  );
}
