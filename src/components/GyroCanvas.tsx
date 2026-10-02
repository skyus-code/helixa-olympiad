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
 * KANVAS BARU SETIAP KALI CONTEXT DILEPAS
 * ---------------------------------------
 * Ini penyebab objek armillary yang "hilang sendiri", dan hilang secara
 * permanen.
 *
 * `dispose()` di three/gyroscope.ts memanggil `renderer.forceContextLoss()`.
 * `forceContextLoss` tidak menandai context "bisa dipulihkan" - ia MEMBUNUH
 * context itu untuk selamanya di elemen canvas yang sama. Jadi kalau section ini
 * disposes lalu di-scroll masuk lagi, dan scene baru dibangun di canvas yang
 * SAMA, `canvas.getContext()` akan mengembalikan context lama yang sudah mati.
 * Scene baru berjalan normal, tidak ada error, tidak ada warning - tapi tidak
 * satu piksel pun yang tergambar, karena tidak ada yang menerima perintah
 * gambar.
 *
 * Urutan yang memunculkan persis gejala yang dilaporkan:
 *   1. Halaman dibuka di atas, section Aturan belum terlihat: belum ada scene.
 *   2. Klik navbar "Aturan": section masuk viewport, scene dibuat, cincin
 *      terlihat.
 *   3. Scroll lewat ke bawah: context dibunuh.
 *   4. Klik navbar "Aturan" lagi: scene baru dibangun di canvas mati, dan
 *      cincin tidak akan pernah muncul lagi sampai halaman dimuat ulang.
 *
 * Perbaikannya: setiap kali context dilepas, elemen canvas-nya sendiri
 * dilepas juga (lewat `key` yang berubah), sehingga alokasi berikutnya
 * selalu mendapat elemen baru dan context baru yang masih hidup.
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
 * batas viewport. Pelepasan juga ditunda `RELEASE_MS` supaya menggulir cepat
 * tidak mengidlok-allocate context berulang kali.
 */
import { useEffect, useRef, useState } from 'react';
import { useMotionMode } from '../hooks/useMotionMode';
import type { GyroHandle } from '../three/gyroscope';

/**
 * Jeda sebelum context benar-benar dilepas. Momen section keluar band 20%
 * sering hanya lewat karena pengguna menggulir cepat, dan membangun ulang scene
 * di balik layar hanya untuk langsung dibuang lagi adalah pemborosan context
 * yang tidak perlu.
 */
const RELEASE_MS = 250;

export function GyroCanvas({ className = '' }: { className?: string }) {
  const mode = useMotionMode();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<GyroHandle | null>(null);
  const [failed, setFailed] = useState(false);
  /**
   * Bertambah setiap kali context dilepas. `key` pada canvas membuat React
   * membuang elemen lama dan membuat yang baru, dan `generation` juga membuat
   * efek di bawah memasang observer baru pada elemen baru itu.
   */
  const [generation, setGeneration] = useState(0);

  // Hanya mode 'rich'. Di 'simple' objek dekoratif ini memang tidak boleh
  // muncul. Di 'reduced' pun memuat three.js untuk satu cincin yang diam
  // tidak sepadan dengan biaya unduhnnya.
  const eligible = mode === 'rich';

  useEffect(() => {
    if (!eligible) return;
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    let disposed = false;
    let releaseTimer = 0;

    const release = () => {
      releaseTimer = 0;
      if (disposed || !handleRef.current) return;
      handleRef.current.dispose();
      handleRef.current = null;
      // Ganti elemen canvas, bukan hanya melepas scenenya. Lihat catatan
      // panjang di header file: context yang sudah dibunuh oleh
      // forceContextLoss tidak pernah bisa dipakai lagi.
      setGeneration((g) => g + 1);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (disposed) return;

        if (entry.isIntersecting) {
          clearTimeout(releaseTimer);
          releaseTimer = 0;
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
          // Ada penundaan supaya scroll cepat tidak membangun dan membongkar
          // scene berulang kali.
          clearTimeout(releaseTimer);
          if (handleRef.current) releaseTimer = window.setTimeout(release, RELEASE_MS);
        }
      },
      { rootMargin: '20% 0px 20% 0px' },
    );
    io.observe(wrapper);

    // Tab disembunyikan: jeda loop, tapi jangan dispose. Context tetap dipegang
    // supaya tidak perlu allocate ulang saat user kembali ke tab.
    const onVis = () => handleRef.current?.setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      disposed = true;
      clearTimeout(releaseTimer);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [eligible, generation]);

  if (!eligible || failed) return null;

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className={'pointer-events-none absolute inset-0 overflow-hidden ' + className}
    >
      <canvas key={generation} ref={canvasRef} className="absolute inset-0 h-full w-full opacity-70" />
    </div>
  );
}
