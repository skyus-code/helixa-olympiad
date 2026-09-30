/**
 * "Helixa Olympiad Perdana" - daftar detail dalam bentuk definition list.
 *
 * Kenapa bukan <table>: tabel memaksa lebar minimum berdasarkan isi terpanjang
 * dan pada 320px menghasilkan scroll horizontal. <dl>/<dt>/<dd> membungkus
 * teks dengan natural, dan di >=768px cukup dua kolom lewat CSS grid.
 *
 * Nilai placeholder memakai font mono agar jelas berbeda dari data nyata:
 * pembaca langsung tahu mana yang masih harus diisi, tanpa perlu warna merah
 * yang bentrok dengan palet.
 *
 * Sama seperti kartu "Kenapa Helixa", daftar ini tidak lagi dibungkus panel
 * emas. Setiap sel berdiri sendiri dengan border dan permukaan `bg-surface`
 * sendiri, dipisahkan `gap-3`.
 */
import { useRef } from 'react';
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { RevealGroup } from './ui/Reveal';
import { PrimaryButton } from './ui/Buttons';
import { PERDANA } from '../content';

export function PerdanaInfo() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  return (
    <Section id="perdana">
      <div ref={rootRef} className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <Eyebrow>{PERDANA.eyebrow}</Eyebrow>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.05] font-semibold tracking-[-0.015em] text-bone">
              {PERDANA.title}
            </h2>
            <span className="rounded-full border border-gold-line-strong bg-gold/10 px-3 py-1 font-mono text-[0.6875rem] tracking-[0.18em] text-gold uppercase">
              Gratis
            </span>
          </div>

          <p className="mt-5 max-w-[44ch] text-bone-dim">{PERDANA.lead}</p>

          <div className="mt-9">
            <PrimaryButton href={PERDANA.ctaHref}>{PERDANA.ctaLabel}</PrimaryButton>
          </div>
        </div>

        <RevealGroup
          selector="[data-perdana-row]"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {PERDANA.details.map((d) => (
            <div
              key={d.label}
              data-perdana-row
              className="flex flex-col gap-2 rounded-2xl border border-gold-line bg-surface p-6 transition-colors duration-300 ease-out hover:border-gold-line-strong hover:bg-ink/60"
            >
              <dt className="font-mono text-[0.6875rem] tracking-[0.18em] text-bone-dim uppercase">
                {d.label}
              </dt>
              <dd
                className={
                  'text-[0.9375rem] leading-relaxed ' +
                  (d.placeholder ? 'font-mono text-gold/80' : 'text-bone')
                }
              >
                {d.value}
              </dd>
            </div>
          ))}
        </RevealGroup>
      </div>
    </Section>
  );
}
