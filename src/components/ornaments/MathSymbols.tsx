type MathSymbolsProps = {
  className?: string;
};

/**
 * Simbol matematika (Σ, π, ∫) sangat samar sebagai latar section.
 * Opacity dipegang oleh `opacity-*` pada elemen pembungkus pemanggil
 * sehingga tidak pernah melebihi 0.06.
 */
export function MathSymbols({ className = '' }: MathSymbolsProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 500"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      <g
        fill="none"
        stroke="#D4AF37"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        fontFamily="Cormorant Garamond, serif"
      >
        {/* Sigma */}
        <path d="M60 130 H150 L60 250 H150" />
        {/* Pi */}
        <path d="M270 130 V226 M270 178 H340 M340 178 V226" />
        {/* Integral */}
        <path d="M480 130 C455 155 470 175 480 195 C490 215 475 240 450 250" />
        {/* Sigma kecil */}
        <path d="M180 340 H240 L180 420 H240" opacity="0.7" />
        {/* Phi */}
        <path d="M420 320 V420 M360 370 H480" opacity="0.7" />
      </g>
    </svg>
  );
}
