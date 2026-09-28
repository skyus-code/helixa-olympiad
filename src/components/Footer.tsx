import { FOOTER, SITE } from '../content';

export function Footer() {
  return (
    <footer
      className="hairline relative overflow-x-clip"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div
        className="shell flex flex-col items-center gap-5 py-10 text-center md:flex-row md:justify-between md:gap-8 md:py-12 md:text-left"
      >
        <div>
          <p className="font-display text-[1.75rem] leading-none font-semibold text-gold">
            {SITE.wordmark} <span className="text-bone-dim">{SITE.wordmarkSuffix}</span>
          </p>
          <p className="mt-1.5 text-[0.8125rem] text-bone-dim/85">
            © {SITE.copyrightYear} Helixa Olympiad · Kontak:{' '}
            <span className="border-b border-dashed border-gold/30 text-bone/90">
              {FOOTER.contact}
            </span>
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 md:items-end">
          <a
            href="#daftar"
            className="inline-flex min-h-11 items-center text-[0.875rem] font-medium text-bone-dim transition-colors duration-300 ease-out hover:text-gold"
          >
            {FOOTER.privacy}
          </a>
          <p className="max-w-[28ch] text-[0.75rem] leading-1.6 text-bone-dim/70 md:max-w-none md:text-right">
            {FOOTER.note}
          </p>
        </div>
      </div>
    </footer>
  );
}
