/**
 * "Aturan & Transparansi" - daftar aturan dengan penomoran romawi.
 *
 * Lebar isi dibatasi 65ch: aturan yang dibaca butuh ukuran baris comfortable,
 * dan membentang penuh 1120px membuat mata harus mengayun jauh untuk kembali
 * ke awal baris berikutnya.
 */
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { RevealGroup } from './ui/Reveal';
import { RULES } from '../content';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export function RulesTransparency() {
  return (
    <Section id="aturan">
      <Eyebrow>{RULES.eyebrow}</Eyebrow>

      <h2 className="mt-5 max-w-[18ch] font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.015em] text-bone">
        {RULES.title}
      </h2>

      <p className="mt-5 max-w-[46ch] text-bone-dim">{RULES.lead}</p>

      <RevealGroup
        selector="[data-rule]"
        className="mt-12 max-w-[65ch] border-t border-gold-line"
      >
        <ol>
          {RULES.items.map((rule, i) => (
            <li
              key={rule}
              data-rule
              className="flex gap-5 border-b border-gold-line py-6 transition-colors duration-300 ease-out hover:bg-gold/[0.03]"
            >
              <span
                aria-hidden="true"
                className="shrink-0 pt-1 font-mono text-[0.75rem] tracking-[0.18em] text-gold"
              >
                {NUMERALS[i] ?? i + 1}
              </span>
              <p className="text-[1.0625rem] leading-relaxed text-bone/90">{rule}</p>
            </li>
          ))}
        </ol>
      </RevealGroup>
    </Section>
  );
}
