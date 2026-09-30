/**
 * CTA penutup + footer digabung.
 *
 * Kontak, Instagram, dan hak cipta memakai font mono pada label kecil supaya
 * menyatu dengan bahasa visual tanggal dan data di section lain.
 */
import { Section } from './ui/Section';
import { Eyebrow } from './ui/Eyebrow';
import { Reveal } from './ui/Reveal';
import { PrimaryButton, SecondaryButton } from './ui/Buttons';
import { CLOSING, FOOTER, INSTAGRAM_URL, SITE } from '../content';

export function ClosingCta() {
  return (
    <Section id="daftar" divider>
      <div className="relative flex flex-col items-center gap-8 py-6 text-center">
        {/* Cincin emas samar sebagai latar aksen tunggal. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-line opacity-60 max-md:h-[260px] max-md:w-[260px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-line opacity-30 max-md:h-[380px] max-md:w-[380px]"
        />

        <Reveal className="relative flex flex-col items-center gap-6">
          <Eyebrow>{CLOSING.eyebrow}</Eyebrow>

          <h2 className="font-display text-[clamp(2.5rem,8vw,4.5rem)] leading-[1.02] font-semibold tracking-[-0.02em] text-bone">
            {CLOSING.title}
          </h2>

          <p className="max-w-[46ch] text-bone-dim">{CLOSING.lead}</p>

          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
            <PrimaryButton href={CLOSING.primaryCtaHref}>{CLOSING.primaryCta}</PrimaryButton>
            <SecondaryButton href={CLOSING.secondaryCtaHref} external>
              {CLOSING.secondaryCta}
            </SecondaryButton>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

export function Footer() {
  return (
    <footer className="relative overflow-x-clip border-t border-gold-line">
      <div className="shell flex flex-col gap-8 py-12 md:flex-row md:items-center md:justify-between md:py-14">
        <div className="flex flex-col gap-2">
          <span className="font-display text-[1.75rem] leading-none font-semibold text-gold">
            {SITE.wordmark}
            <span className="ml-2.5 font-mono text-[0.6875rem] tracking-[0.18em] text-bone-dim uppercase">
              {SITE.wordmarkSuffix}
            </span>
          </span>
          <p className="text-[0.875rem] text-bone-dim">{FOOTER.note}</p>
        </div>

        <div className="flex flex-col gap-4 md:items-end">
          <a
            href={INSTAGRAM_URL}
            className="nav-link inline-flex min-h-11 items-center font-mono text-[0.875rem] text-bone/80 hover:text-bone"
            {...(/^https?:/i.test(INSTAGRAM_URL)
              ? { target: '_blank', rel: 'noreferrer noopener' }
              : {})}
          >
            Instagram
          </a>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[0.8125rem] text-bone-dim">
            <span>{FOOTER.contact}</span>
            <span aria-hidden="true" className="hidden h-3 w-px bg-gold-line sm:inline-block" />
            <span>{FOOTER.privacy}</span>
          </div>
        </div>
      </div>

      <div className="shell pb-10">
        <div className="flex flex-col gap-2 border-t border-gold-line pt-6 font-mono text-[0.75rem] text-bone-dim md:flex-row md:items-center md:justify-between">
          <span>
            {'© '}
            {SITE.copyrightYear} {SITE.wordmark} {SITE.wordmarkSuffix}
          </span>
          <span>Matematika &amp; Biologi · SMA</span>
        </div>
      </div>
    </footer>
  );
}
