/**
 * Label kecil di atas judul section.
 *
 * Font mono + letter-spacing lebar, huruf kapital, warna emas. Monospace
 * dipilih karena font mono memberi kesan "label data", berbeda dari
 * heading serif dan body sans.
 */
export function Eyebrow({ children, className = '' }: { children: string; className?: string }) {
  return (
    <p className={'eyebrow ' + className}>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="inline-block h-px w-6 bg-gold/50" />
        {children}
      </span>
    </p>
  );
}
