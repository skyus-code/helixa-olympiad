import { Section } from './ui/Section';
import { Reveal } from './ui/Reveal';
import { Eyebrow } from './ui/Eyebrow';
import { PrimaryButton } from './ui/Buttons';
import { CLOSING } from '../content';

function InstagramIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[1.125rem] w-[1.125rem] shrink-0"
    >
      <rect x="2.5" y="2.5" width="15" height="15" rx="4.5" />
      <circle cx="10" cy="10" r="3.75" />
      <circle cx="14.6" cy="5.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ClosingCta() {
  return (
    <Section id="daftar">
      <Reveal className="mx-auto max-w-[40rem] text-center">
        <Eyebrow>{CLOSING.eyebrow}</Eyebrow>
        <h2 className="mt-5 font-display text-[clamp(1.875rem,4vw,3rem)] leading-[1.08] font-semibold tracking-[-0.015em] text-balance text-bone">
          {CLOSING.title}
        </h2>
        <p className="mx-auto mt-5 max-w-[34rem] text-pretty text-bone-dim">{CLOSING.lead}</p>

        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <PrimaryButton href={CLOSING.primaryCtaHref} external className="w-full sm:w-auto">
            {CLOSING.primaryCta}
          </PrimaryButton>

          <a
            href={CLOSING.secondaryCtaHref}
            target="_blank"
            rel="noreferrer noopener"
            className="btn inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-gold/30 px-6 py-3 text-[0.9375rem] font-semibold text-bone transition-[color,border-color,background-color,transform] duration-300 ease-out hover:border-gold/55 hover:bg-gold/8 sm:w-auto"
          >
            <InstagramIcon />
            {CLOSING.secondaryCta}
          </a>
        </div>
      </Reveal>
    </Section>
  );
}
