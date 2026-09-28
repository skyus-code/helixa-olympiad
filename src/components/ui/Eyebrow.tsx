type EyebrowProps = {
  children: string;
  className?: string;
  as?: 'p' | 'span' | 'div';
};

/**
 * Label kecil: Manrope 12–13px, huruf kapital, letter-spacing 0.18em, warna emas.
 */
export function Eyebrow({ children, className = '', as = 'p' }: EyebrowProps) {
  const Tag = as;
  return (
    <Tag
      className={`text-[0.75rem] font-semibold tracking-[0.18em] text-gold uppercase sm:text-[0.8125rem] ${className}`}
    >
      {children}
    </Tag>
  );
}
