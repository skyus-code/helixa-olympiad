/**
 * FAQ - akordeon murni CSS (grid-template-rows 0fr -> 1fr).
 *
 * `auto` bukan nilai yang bisa diinterpolasi, jadi animasi tinggi panel
 * memakai trik grid-rows: panel luar membungkus inner ber-`overflow hidden`,
 * dan mengalihkan `grid-template-rows` dari `0fr` ke `1fr` membuat tinggi
 * animasi halus dengan durasi merata untuk semua panel, tanpa mengukur apa
 * pun di JS.
 *
 * Aksesibilitas yang dijaga:
 *  - Tombol punya aria-expanded dan aria-controls.
 *  - Panel tertutup diberi atribut `inert`, sehingga isinya tidak bisa difokus
 *    dengan Tab dan tidak dibaca screen reader.
 *  - Hanya satu panel terbuka pada satu waktu.
 *
 * Fail-safe: CSS membiarkan jawaban pertama terbuka selama container belum
 * punya data-js (`.faq-list:not([data-js]) .faq-item:first-of-type`), jadi
 * pengunjung dengan JavaScript mati tetap membaca sesuatu.
 */
import { useRef, useState } from 'react';
import { useIsoLayoutEffect } from '../hooks/useIsoLayoutEffect';
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { RevealGroup } from './ui/Reveal';
import { FAQ } from '../content';

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Satu-satunya kerja JS pada panel: menandai item terbuka dan mengatur
  // `inert`. Transisi tinggi sepenuhnya ada di CSS (grid-rows).
  useIsoLayoutEffect(() => {
    panelRefs.current.forEach((panel, i) => {
      if (!panel) return;
      const open = i === openIndex;
      panel.closest('.faq-item')?.classList.toggle('is-open', open);
      if (open) panel.removeAttribute('inert');
      else panel.setAttribute('inert', '');
    });
  }, [openIndex]);

  return (
    <Section id="faq" z={70} card>
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <Eyebrow>{FAQ.eyebrow}</Eyebrow>

          <h2 className="mt-5 max-w-[16ch] font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.015em] text-bone">
            {FAQ.title}
          </h2>

          <p className="mt-5 max-w-[38ch] text-bone-dim">{FAQ.lead}</p>
        </div>

        <RevealGroup
          className="faq-list border-t border-gold-line"
          htmlAttrs={{ 'data-js': '' }}
        >
          {FAQ.items.map((item, i) => {
            const open = openIndex === i;
            return (
              <div key={item.question} className="faq-item border-b border-gold-line">
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpenIndex((cur) => (cur === i ? null : i))}
                    aria-expanded={open}
                    aria-controls={'faq-panel-' + i}
                    className="group flex min-h-14 w-full items-center justify-between gap-5 py-5 text-left"
                  >
                    <span
                      className={
                        'text-[1.0625rem] leading-snug font-medium transition-colors duration-300 ease-out ' +
                        (open ? 'text-gold' : 'text-bone group-hover:text-bone/70')
                      }
                    >
                      {item.question}
                    </span>

                    <span aria-hidden="true" className="relative block h-4 w-4 shrink-0">
                      <span className="absolute top-1/2 left-0 block h-px w-4 -translate-y-1/2 bg-gold" />
                      <span
                        className={
                          'absolute top-1/2 left-0 block h-px w-4 -translate-y-1/2 bg-gold transition-transform duration-300 ease-out ' +
                          (open ? 'rotate-90 scale-x-0' : 'rotate-0')
                        }
                      />
                    </span>
                  </button>
                </h3>

                <div
                  id={'faq-panel-' + i}
                  ref={(el) => {
                    panelRefs.current[i] = el;
                  }}
                  role="region"
                  aria-label={item.question}
                  className="faq-panel"
                >
                  <div className="faq-panel-inner">
                    <p className="max-w-[60ch] pr-8 pb-6 text-[1.0625rem] leading-relaxed text-bone-dim">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </RevealGroup>
      </div>
    </Section>
  );
}