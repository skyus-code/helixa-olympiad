import { Section } from './ui/Section';
import { Reveal } from './ui/Reveal';
import { Eyebrow } from './ui/Eyebrow';
import { HOW_TO_JOIN } from '../content';

export function HowToJoin() {
  return (
    <Section id="cara-ikut">
      <Reveal className="max-w-[38rem]">
        <Eyebrow>{HOW_TO_JOIN.eyebrow}</Eyebrow>
        <h2 className="mt-5 font-display text-[clamp(1.875rem,4vw,3rem)] leading-[1.08] font-semibold tracking-[-0.015em] text-bone">
          {HOW_TO_JOIN.title}
        </h2>
        <p className="mt-5 text-pretty text-bone-dim">{HOW_TO_JOIN.lead}</p>
      </Reveal>

      {/* Vertikal dengan garis penghubung tipis di ponsel, horizontal 4 kolom di lg */}
      <ol className="relative mt-14 grid grid-cols-1 gap-10 lg:mt-18 lg:grid-cols-4 lg:gap-6">
        <span
          aria-hidden="true"
          className="absolute top-6 left-[0.4375rem] h-[calc(100%-3.5rem)] w-px bg-gold/20 lg:top-6 lg:left-0 lg:h-px lg:w-full"
        />

        {HOW_TO_JOIN.steps.map((step, i) => (
          <Reveal
            as="li"
            key={step.number}
            delay={i * 80}
            className="relative pl-9 lg:pl-0"
          >
            <span
              aria-hidden="true"
              className="absolute top-0 left-0 flex h-6 w-6 items-center justify-center rounded-full border border-gold/35 bg-ink lg:relative lg:top-0"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-gold/80" />
            </span>

            <span className="block text-[0.75rem] font-semibold tracking-[0.14em] text-gold/70 tabular-nums">
              {step.number}
            </span>
            <h3 className="mt-3 font-display text-[1.75rem] leading-[1.15] font-semibold text-bone">
              {step.title}
            </h3>
            <p className="mt-2.5 max-w-[26ch] text-[0.9375rem] leading-1.7 text-pretty text-bone-dim">
              {step.body}
            </p>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
