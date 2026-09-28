import type { ReactNode } from 'react';

function ArrowRight({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 ${className}`}
    >
      <path d="M3 8h10" />
      <path d="M9 4l4 4-4 4" />
    </svg>
  );
}

const BASE =
  'btn inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-[0.9375rem] font-semibold transition-[color,border-color,background-color,box-shadow,transform] duration-300 ease-out select-none';

type ButtonProps = {
  children: ReactNode;
  href: string;
  className?: string;
  external?: boolean;
};

/**
 * Tombol utama — satu-satunya tempat gradasi emas dipakai pada UI (selain satu
 * kata di headline hero dan garis dekoratif).
 */
export function PrimaryButton({ children, href, className = '', external }: ButtonProps) {
  const isExternal = external ?? /^https?:/i.test(href);
  return (
    <a
      href={href}
      className={`bg-gold-gradient group relative overflow-hidden text-ink shadow-[0_10px_30px_-14px_rgba(212,175,55,0.45)] ${BASE} ${className}`}
      {...(isExternal ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-500 ease-out group-hover:translate-x-full" />
      <span className="relative inline-flex items-center gap-2 px-6 py-3">
        {children}
        <ArrowRight className="transition-transform duration-300 ease-out group-hover:translate-x-1" />
      </span>
    </a>
  );
}

/** Tombol sekunder: border emas, terisi tipis saat hover. */
export function SecondaryButton({ children, href, className = '' }: ButtonProps) {
  return (
    <a
      href={href}
      className={`border border-gold/30 text-bone hover:border-gold/55 hover:bg-gold/8 ${BASE} px-6 py-3 ${className}`}
    >
      <span className="inline-flex items-center gap-2">{children}</span>
    </a>
  );
}
