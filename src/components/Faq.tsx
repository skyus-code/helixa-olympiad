/**
 * FAQ - akordeon dengan animasi tinggi GSAP.
 *
 * Animasi `height: auto` adalah bagian yang biasanya paling merepotkan:
 * `auto` bukan nilai yang bisa diinterpolasi, jadi banyak developer resort ke
 * `max-height` dengan angka tebakan, dan akibatnya durasi terasa berbeda antar
 * panel. GSAP mengukur tinggi akhir sendiri lalu menganimasikan ke sana, jadi
 * semua panel terasa sama cepat.
 *
 * Aksesibilitas yang dijaga:
 *  - Tombol punya aria-expanded dan aria-controls.
 *  - Panel tertutup diberi atribut `inert`, sehingga isinya tidak bisa difokus
 *    dengan Tab dan tidak dibaca screen reader.
 *  - Hanya satu panel terbuka pada satu waktu.
 *
 * Fail-safe: CSS menyisakan jawaban pertama terbuka, supaya pengunjung dengan
 * JavaScript mati tetap membaca sesuatu, bukan lima pertanyaan tanpa isi.
 */
import { useRef, useState } from 'react';
import { gsap } from '../lib/gsap';
import { EASE, DUR, MQ } from '../lib/motion';
import { useGsapMedia, useIsoLayoutEffect } from '../hooks/useGsapMedia';
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { RevealGroup } from './ui/Reveal';
import { FAQ } from '../content';

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const mounted = useRef(false);

  // Seluruh kerja tinggi panel terjadi DI SINI, bukan di event handler klik.
  //
  // Alasannya urutan waktu: setState() bersifat asinkron, jadi layout effect
  // selalu berjalan SETELAH event handler selesai. Kalau tween dimulai di
  // handler, layout effect akan langsung menimpanya dengan height 'auto' atau
  // 0, dan animasinya hilang total. Satu tempat, satu sumber kebenaran.
  useIsoLayoutEffect(() => {
    const first = !mounted.current;
    mounted.current = true;

    panelRefs.current.forEach((panel, i) => {
      if (!panel) return;
      const open = i === openIndex;

      if (first) {
        // Pas mounting: set langsung, tanpa tween. Ini juga jalur yang dipakai
        // saat reduced-motion aktif, sehingga panel tidak pernah tersangkut di
        // tengah animasi.
        if (open) {
          panel.removeAttribute('inert');
          gsap.set(panel, { height: 'auto' });
        } else {
          panel.setAttribute('inert', '');
          gsap.set(panel, { height: 0 });
        }
        return;
      }

      const from = panel.getBoundingClientRect().height;

      if (open) {
        panel.removeAttribute('inert');
        gsap.fromTo(
          panel,
          { height: from },
          { height: 'auto', duration: DUR.accordion, ease: EASE.accordion, overwrite: true },
        );
      } else {
        if (from === 0) {
          panel.setAttribute('inert', '');
          return;
        }
        gsap.fromTo(
          panel,
          { height: from },
          {
            height: 0,
            duration: DUR.accordion,
            ease: EASE.accordion,
            overwrite: true,
            onComplete: () => panel.setAttribute('inert', ''),
          },
        );
      }
    });
  }, [openIndex]);

  // Matikan transisi CSS selama blokir reduced-motion berjalan, supaya nilai
  // akhir langsung berlaku tanpa interpolasi apa pun.
  useGsapMedia(MQ.motion, () => {
    panelRefs.current.forEach((panel) => {
      if (panel) panel.style.transition = 'none';
    });
    return () => {
      panelRefs.current.forEach((panel) => {
        if (panel) panel.style.transition = '';
      });
    };
  });

  return (
    <Section id="faq">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <Eyebrow>{FAQ.eyebrow}</Eyebrow>

          <h2 className="mt-5 max-w-[16ch] font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.015em] text-bone">
            {FAQ.title}
          </h2>

          <p className="mt-5 max-w-[38ch] text-bone-dim">{FAQ.lead}</p>
        </div>

        <RevealGroup selector="[data-faq-item]" className="border-t border-gold-line">
          {FAQ.items.map((item, i) => {
            const open = openIndex === i;
            return (
              <div key={item.question} data-faq-item className="faq-item border-b border-gold-line">
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
                  className="faq-body"
                >
                  <p className="max-w-[60ch] pr-8 pb-6 text-[1.0625rem] leading-relaxed text-bone-dim">
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </RevealGroup>
      </div>
    </Section>
  );
}
