/**
 * Simbol matematika (Sigma, pi, integral) sebagai latar section.
 *
 * Font serif besar, opasitas sangat rendah. Dipakai di section "Cara Ikut"
 * dengan parallax paling cepat dari semua ornamen, sehingga terasa hampir
 * lepas dari dokumen saat digulir.
 */
const SYMBOLS = [
  { ch: '\u03A3', x: 8, y: 22, size: 128, rot: -6 },
  { ch: '\u03C0', x: 72, y: 58, size: 96, rot: 5 },
  { ch: '\u222B', x: 18, y: 86, size: 112, rot: -3 },
] as const;

export function MathSymbols({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={className}>
      {SYMBOLS.map((s) => (
        <span
          key={s.ch}
          className="math-symbol absolute font-display leading-none text-bone"
          style={{
            left: s.x + '%',
            top: s.y + '%',
            fontSize: s.size,
            transform: `rotate(${s.rot}deg)`,
          }}
        >
          {s.ch}
        </span>
      ))}
    </div>
  );
}
