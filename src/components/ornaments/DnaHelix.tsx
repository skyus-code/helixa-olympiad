/**
 * Ornamen DNA — dua untai sinusoidal yang saling berpelintir.
 *
 * SVG murni, tanpa aset. Dipakai sebagai latar section "Kenapa Helixa" dan
 * diberi parallax lewat ScrollTrigger (speed berbeda dari konten).
 */
export function DnaHelix({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 420"
      fill="none"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="dna-strand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6E7B4" stopOpacity="0.5" />
          <stop offset="45%" stopColor="#D4AF37" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#996515" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* Anak tangga: pasangan basa */}
      {Array.from({ length: 16 }, (_, i) => {
        const t = i / 15;
        const y = 20 + t * 380;
        const spread = Math.sin(t * Math.PI) * 58 + 8;
        return (
          <line
            key={`rung-${i}`}
            x1={100 - spread}
            y1={y}
            x2={100 + spread}
            y2={y}
            stroke="#D4AF37"
            strokeWidth="0.75"
            strokeOpacity={0.1 + Math.sin(t * Math.PI) * 0.14}
          />
        );
      })}

      {/* Dua untai */}
      {[
        Array.from({ length: 61 }, (_, i) => {
          const t = i / 60;
          const y = 20 + t * 380;
          const x = 100 + Math.sin(t * Math.PI * 5) * (Math.sin(t * Math.PI) * 58 + 8);
          return [x, y] as const;
        }),
        Array.from({ length: 61 }, (_, i) => {
          const t = i / 60;
          const y = 20 + t * 380;
          const x = 100 - Math.sin(t * Math.PI * 5) * (Math.sin(t * Math.PI) * 58 + 8);
          return [x, y] as const;
        }),
      ].map((pts, s) => (
        <polyline
          key={`strand-${s}`}
          points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
          stroke="url(#dna-strand)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
