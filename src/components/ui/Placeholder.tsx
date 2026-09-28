type PlaceholderProps = {
  children: string;
  className?: string;
};

/**
 * Placeholder dalam kurung siku, tampil dengan border putus-putus emas
 * supaya mudah terlihat dan diganti cepat.
 *
 * Sengaja TIDAK memakai `white-space: nowrap` — label juri/mitra panjang
 * harus boleh membungkus agar tidak meluber di layar 320px.
 */
export function Placeholder({ children, className = '' }: PlaceholderProps) {
  return (
    <span
      className={`inline-block max-w-full rounded-sm border border-dashed border-gold/35 px-1.5 py-0.5 text-balance break-words text-bone/80 ${className}`}
    >
      {children}
    </span>
  );
}
