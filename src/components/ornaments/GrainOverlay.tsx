/**
 * Grain/noise sangat tipis sebagai tekstur di atas seluruh halaman.
 * Dibuat dari inline SVG feTurbulence (data URI) — tanpa berkas gambar.
 * Opacity 0.035, pointer-events none, di luar aliran layout.
 */
export function GrainOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 opacity-[0.035]"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundSize: '160px 160px',
      }}
    />
  );
}
