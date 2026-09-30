import type { ReactNode } from 'react';

type SectionProps = {
  id: string;
  children: ReactNode;
  /** Garis emas tipis di bagian atas section. */
  divider?: boolean;
  className?: string;
  /** Padding vertikal ditimpa, mis. section hero yang butuh layar penuh. */
  innerClassName?: string;
  /** Lebar isi. `wide` dipakai section dengan daftar dua kolom. */
  width?: 'default' | 'wide' | 'narrow';
};

/**
 * Pembungkus section: `overflow-x-clip` (bukan `hidden`) supaya elemen
 * dekoratif boleh keluar dari kotak tanpa memunculkan scroll bar, padding
 * 72/96/120px, dan `scrollMarginTop` agar tidak tertutup navbar.
 */
export function Section({
  id,
  children,
  divider = true,
  className = '',
  innerClassName = 'py-18 md:py-24 lg:py-30',
  width = 'default',
}: SectionProps) {
  const shellMax = {
    default: '1120px',
    wide: '1240px',
    narrow: '820px',
  }[width];

  return (
    <section
      id={id}
      className={`relative overflow-x-clip ${divider ? 'hairline' : ''} ${className}`}
      style={{ scrollMarginTop: '88px' }}
    >
      <div
        className={`shell ${innerClassName}`}
        style={{ ['--shell-max' as string]: shellMax }}
      >
        {children}
      </div>
    </section>
  );
}
