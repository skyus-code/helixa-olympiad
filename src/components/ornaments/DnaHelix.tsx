type DnaHelixProps = {
  className?: string;
};

/**
 * Ornamen DNA double helix — dua untai sinusoidal yang saling berpelintir
 * dengan anak tangga penghubung. Murni SVG, tanpa gambar eksternal.
 * Digunakan di hero (desktop: sisi kanan, mobile: di belakang teks).
 */
export function DnaHelix({ className = '' }: DnaHelixProps) {
  const rungs = [30, 78, 126, 174, 222, 270, 318];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 400"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <defs>
        <linearGradient id="helix-strand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6E7B4" stopOpacity="0.30" />
          <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#A17C1B" stopOpacity="0.30" />
        </linearGradient>
        <linearGradient id="helix-rung" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.10" />
          <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.10" />
        </linearGradient>
      </defs>

      {/* Unting A */}
      <path
        d="M30 0 C170 45 170 105 30 150 C-110 195 -110 255 30 300 C170 345 170 380 30 400"
        stroke="url(#helix-strand)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Unting B (cermin) */}
      <path
        d="M210 0 C70 45 70 105 210 150 C350 195 350 255 210 300 C70 345 70 380 210 400"
        stroke="url(#helix-strand)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Anak tangga penghubung */}
      <g stroke="url(#helix-rung)" strokeWidth="1" strokeLinecap="round">
        {rungs.map((y) => (
          <line key={`a-${y}`} x1="24" y1={y} x2="216" y2={y} />
        ))}
      </g>

      {/* Simpul kecil pada dua titik fokus, memberi kesan "pelintir" */}
      <g fill="#D4AF37">
        <circle cx="150" cy="112" r="2.6" opacity="0.5" />
        <circle cx="90" cy="288" r="2.6" opacity="0.5" />
      </g>
    </svg>
  );
}
