/**
 * "Aturan & Transparansi" - daftar aturan dengan penomoran romawi.
 *
 * Header sengaja rata KANAN (satu-satunya section yang begitu) dengan lebar
 * ~38ch, sedangkan daftar aturan tetap di kiri (max 65ch agar baris nyaman
 * dibaca). Garis emas tipis di atas daftar membesar dari kiri saat section
 * masuk layar (gerakan garis pembatas — salah satu dari 8 jenis motion).
 */
import { Reveal, RevealGroup } from './ui/Reveal';
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { RULES } from '../content';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export function RulesTransparency() {
  return (
    <Section id="aturan" z={60} card>
      <div className="section-head section-head--right">
        <Eyebrow>{RULES.eyebrow}</Eyebrow>

        <h2 className="mt-5 font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.015em] text-bone">
          {RULES.title}
        </h2>

        <p className="mt-5 text-bone-dim">{RULES.lead}</p>
      </div>

      <div className="mt-12 max-w-[65ch]">
        <Reveal variant="x">
          <div aria-hidden="true" className="gold-rule h-px w-full" />
        </Reveal>

        <RevealGroup as="ol">
          {RULES.items.map((rule, i) => (
            <li
              key={rule}
              className="flex gap-5 border-b border-gold-line py-6 transition-colors duration-300 ease-out hover:bg-gold/[0.03]"
            >
              <span
                aria-hidden="true"
                className="shrink-0 pt-1 font-sans text-[0.75rem] tracking-[0.18em] text-gold"
              >
                {NUMERALS[i] ?? i + 1}
              </span>
              <p className="text-[1.0625rem] leading-relaxed text-bone/90">{rule}</p>
            </li>
          ))}
        </RevealGroup>
      </div>
    </Section>
  );
}