/**
 * Aturan: kanvas armillary three.js.
 *
 * Ini kanvas WebGL KEDUA di situs, dan sifatnya beda dari partikel Hero:
 *
 *   - Di-mount HANYA saat section benar-benar mendekati viewport, dan di-dispose
 *     lagi saat menjauh. Tanpa ini kita memegang satu context WebGL nganggur
 *     sepanjang halaman di-scroll. Browser membatasi jumlah context aktif
 *     (sekitar 16), jadi context yang menganggur bukan hanya boros listrik, dia
 *     juga bisa membuat feature WebGL berikutnya gagal dialokasikan.
 *   - Tidak bereaksi pointer sama sekali. Bentuknya armillary, bukan hero.
 *
 * Modul three.js di-`import()` dinamis dan hanya di dalam cabang mode 'rich',
 * sama seperti Hero, supaya HP tidak pernah mengunduhnya.
 *
 * Fallback: kalau WebGL ditolak, komponen merender null dan section Aturan
 * tetap utuh, karena objek ini murni dekoratif. Tidak ada teks yang bergantung
 * padanya, jadi kegagalan di sini tidak boleh merusak apa pun.
 *
 * rootMargin 20% expired semua sisi: context dialokasikan saat section masuk
 * band yang 20% lebih besar dari viewport, dan dilepas saat keluar lagi. Ada
 * jeda 20% antara keduanya, jadi observer ini tidak berkedip-ganti di tepat
 * batas viewport.
 */
import { useEffect, useRef, useState } from 'react';
import { useMotionMode } from '../hooks/useMotionMode';
import type { GyroHandle } from '../three/gyroscope';

export function GyroCanvas({ className = '' }: { className?: string }) {
  const mode = useMotionMode();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<GyroHandle | null>(null);
  const [failed, setFailed] = useState(false);

  // Hanya mode 'rich'. Di 'simple' objek dekoratif ini memang tidak boleh
  // muncul. Di 'reduced' pun memuat three.js untuk satu cincin yang diam
  // tidak sepadan dengan biaya unduhnnya.
  const eligible = mode === 'rich';

  useEffect(() => {
    if (!eligible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (disposed) return;

        if (entry.isIntersecting) {
          if (handleRef.current) {
            // Sudah dialokasikan sebelumnya (user kembali ke section ini).
            // Lanjutkan loop-nya.
            handleRef.current.setPaused(document.hidden);
            return;
          }
          import('../three/gyroscope')
            .then((mod) => {
              if (disposed || handleRef.current) return;
              try {
                handleRef.current = mod.createGyroScene(canvas, { reduced: false });
              } catch (err) {
                console.warn('WebGL giroskop gagal, section tetap tanpa objek:', err);
                setFailed(true);
              }
            })
            .catch((err) => {
              console.warn('Modul giroskop gagal dimuat, section tetap tanpa objek:', err);
              setFailed(true);
            });
        } else {
          // Jauh dari viewport: lepaskan context sepenuhnya, bukan cuma jeda.
          handleRef.current?.dispose();
          handleRef.current = null;
        }
      },
      { rootMargin: '20% 0px 20% 0px' },
    );
    io.observe(canvas);

    // Tab disembunyikan: jeda loop, tapi jangan dispose. Context tetap dipegang
    // supaya tidak perlu allocate ulang saat user kembali ke tab.
    const onVis = () => handleRef.current?.setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      disposed = true;
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [eligible]);

  if (!eligible || failed) return null;

  return (
    <div
      aria-hidden="true"
      className={'pointer-events-none absolute inset-0 overflow-hidden ' + className}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-70" />
    </div>
  );
}