import type { ReactNode } from 'react';
import { useMagnetic, registerHoverTarget } from '../../hooks/useMagnetic';
import { useIsoLayoutEffect } from '../../hooks/useGsapMedia';

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
 * Pembungkus magnetic pull sekaligus penanda bagi kursor kustom.
 *
 * Host magnet adalah span ini sendiri, bukan elemen anak, sehingga transform
 * tarikan bekerja pada satu elemen saja dan tidak berlapis dengan transform
 * scale milik tombol saat ditekan.
 */
export function Magnetic({
  children,
  className = '',
  enabled = true,
}: {
  children: ReactNode;
  className?: string;
  enabled?: boolean;
}) {
  const ref = useMagnetic<HTMLSpanElement>(enabled);

  // Pendaftaran di layout effect: pointer bisa sudah berada di atas elemen
  // sebelum React selesai mount.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return registerHoverTarget(el);
  }, [ref]);

  return (
    <span ref={ref} className={'magnetic inline-flex ' + className}>
      {children}
    </span>
  );
}

/**
 * Tombol utama. Gradasi emas hanya dipakai di sini, di satu kata headline
 * hero, dan di garis dekoratif.
 */
export function PrimaryButton({ children, href, className = '', external }: ButtonProps) {
  const isExternal = external ?? /^https?:/i.test(href);
  return (
    <Magnetic className="inline-flex">
      <a
        href={href}
        className={
          'btn-shimmer bg-gold-gradient group relative overflow-hidden text-ink shadow-[0_10px_30px_-14px_rgba(212,175,55,0.45)] ' +
          BASE +
          ' ' +
          className
        }
        {...(isExternal ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      >
        <span className="relative inline-flex items-center gap-2 px-6 py-3">
          {children}
          <ArrowRight className="transition-transform duration-300 ease-out group-hover:translate-x-1" />
        </span>
      </a>
    </Magnetic>
  );
}

/** Tombol sekunder: border emas, terisi tipis saat hover. */
export function SecondaryButton({ children, href, className = '' }: ButtonProps) {
  return (
    <Magnetic className="inline-flex">
      <a
        href={href}
        className={'border border-gold/30 text-bone hover:border-gold/55 hover:bg-gold/8 ' + BASE + ' px-6 py-3 ' + className}
      >
        <span className="inline-flex items-center gap-2">{children}</span>
      </a>
    </Magnetic>
  );
}
