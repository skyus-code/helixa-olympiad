import { useId, useState } from 'react';
import { Section } from './ui/Section';
import { Reveal } from './ui/Reveal';
import { Eyebrow } from './ui/Eyebrow';
import { FAQ } from '../content';

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  return (
    <Section id="faq">
      <Reveal className="max-w-[38rem]">
        <Eyebrow>{FAQ.eyebrow}</Eyebrow>
        <h2 className="mt-5 font-display text-[clamp(1.875rem,4vw,3rem)] leading-[1.08] font-semibold tracking-[-0.015em] text-bone">
          {FAQ.title}
        </h2>
        <p className="mt-5 text-pretty text-bone-dim">{FAQ.lead}</p>
      </Reveal>

      <ul className="mt-14 lg:mt-18">
        {FAQ.items.map((item, i) => {
          const isOpen = openIndex === i;
          const buttonId = `${baseId}-q-${i}`;
          const panelId = `${baseId}-a-${i}`;

          return (
            <Reveal as="li" key={item.question} delay={i * 80} className="border-t border-gold-line">
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="btn flex min-h-14 w-full items-center justify-between gap-6 py-5 text-left md:min-h-16"
                >
                  <span className="font-display text-[1.75rem] leading-[1.2] font-medium text-balance text-bone transition-colors duration-300 ease-out">
                    {item.question}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/30 transition-colors duration-300 ease-out ${
                      isOpen ? 'border-gold/60 bg-gold/10' : ''
                    }`}
                  >
                    <span className="absolute h-px w-3 bg-gold" />
                    <span
                      className={`absolute h-3 w-px bg-gold transition-transform duration-300 ease-out ${
                        isOpen ? 'scale-y-0' : 'scale-y-100'
                      }`}
                    />
                  </span>
                </button>
              </h3>

              {/* Tinggi membuka halus tanpa JS: 0fr -> 1fr */}
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="grid transition-[grid-template-rows] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden" inert={!isOpen}>
                  <p className="max-w-[62ch] pb-6 text-[0.9375rem] leading-1.7 text-pretty text-bone-dim md:pb-7">
                    {item.answer}
                  </p>
                </div>
              </div>

              {i === FAQ.items.length - 1 && (
                <div aria-hidden="true" className="border-t border-gold-line" />
              )}
            </Reveal>
          );
        })}
      </ul>
    </Section>
  );
}
