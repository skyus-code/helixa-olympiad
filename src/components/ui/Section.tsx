import type { ReactNode } from 'react';

type SectionProps = {
  id: string;
  children: ReactNode;
  /** Garis emas tipis di bagian atas section. */
  divider?: boolean;
  className?: string;
};

/**
 * Pembungkus section standar: overflow-x clip, padding section 72/96/120px,
 * dan offset scroll agar tidak tertutup navbar.
 */
export function Section({ id, children, divider = true, className = '' }: SectionProps) {
  return (
    <section
      id={id}
      className={`relative overflow-x-clip ${divider ? 'hairline' : ''} ${className}`}
      style={{ scrollMarginTop: '88px' }}
    >
      <div className="shell py-18 md:py-24 lg:py-30">{children}</div>
    </section>
  );
}
