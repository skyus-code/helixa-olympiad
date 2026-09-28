import { Section } from './ui/Section';
import { Reveal } from './ui/Reveal';
import { Eyebrow } from './ui/Eyebrow';
import { RULES } from '../content';

export function RulesTransparency() {
  return (
    <Section id="aturan">
      <div className="max-w-[65ch]">
        <Reveal>
          <Eyebrow>{RULES.eyebrow}</Eyebrow>
          <h2 className="mt-5 font-display text-[clamp(1.875rem,4vw,3rem)] leading-[1.08] font-semibold tracking-[-0.015em] text-balance text-bone">
            {RULES.title}
          </h2>
          <p className="mt-5 text-pretty text-bone-dim">{RULES.lead}</p>
        </Reveal>

        <ul className="mt-10 space-y-5">
          {RULES.items.map((item, i) => (
            <Reveal as="li" key={item} delay={i * 80} className="flex gap-4">
              <span
                aria-hidden="true"
                className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold/70"
              />
              <p className="text-pretty text-bone-dim">{item}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  );
}
