import { MathSymbols } from './ornaments/MathSymbols';
import { useParallax } from '../hooks/useParallax';
import { Section } from './ui/Section';
import { Reveal } from './ui/Reveal';
import { Eyebrow } from './ui/Eyebrow';
import { WHY } from '../content';

export function WhyHelixa() {
  const symbolRef = useParallax(60);

  return (
    <Section id="tentang">
      {/* Simbol matematika sangat samar (opacity <= 0.06) sebagai latar */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block"
      >
        <div
          ref={symbolRef}
          className="absolute top-0 right-[-4%] h-full w-[42%] opacity-[0.06]"
        >
          <MathSymbols className="h-full w-full" />
        </div>
      </div>

      <div className="relative">
        <Reveal className="max-w-[38rem]">
          <Eyebrow>{WHY.eyebrow}</Eyebrow>
          <h2 className="mt-5 font-display text-[clamp(1.875rem,4vw,3rem)] leading-[1.08] font-semibold tracking-[-0.015em] text-bone">
            {WHY.title}
          </h2>
          <p className="mt-5 text-pretty text-bone-dim">{WHY.lead}</p>
        </Reveal>

        <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-18 lg:grid-cols-4">
          {WHY.items.map((item, i) => (
            <Reveal
              as="li"
              key={item.number}
              delay={i * 80}
              className="card-hover flex h-full flex-col rounded-2xl border border-gold-line bg-surface p-6 lg:p-7"
            >
              <span className="block text-[0.75rem] font-semibold tracking-[0.14em] text-gold/70 tabular-nums">
                {item.number}
              </span>
              <h3 className="mt-5 font-display text-[1.75rem] leading-[1.15] font-semibold text-bone">
                {item.title}
              </h3>
              <p className="mt-3 text-[0.9375rem] leading-1.7 text-pretty text-bone-dim">
                {item.body}
              </p>
              <span
                aria-hidden="true"
                className="gold-rule mt-6 block h-px w-10 shrink-0 self-start"
              />
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  );
}
