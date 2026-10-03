/**
 * Form Pendaftaran: pembungkus kanvas benda ruang Platonic + debu partikel.
 *
 * Aturan yang dipegang komponen ini, sama persis dengan dua kanvas lain:
 *
 *  1. three.js hanya masuk lewat `import()` DINAMIS di dalam cabang
 *     `mode === 'rich'`. Mode 'simple' dan 'reduced' tidak pernah mencapai baris
 *     itu, jadi chunk three.js tidak pernah terunduh di ponsel. Ini bukan
 *     sekadar "tidak dieksekusi" - berkasnya benar-benar tidak pernah diambil
 *     dari jaringan, dan itu yang diukur oleh verify.mjs.
 *
 *  2. Fallback wajib, tapi di sini bentuk fallback-nya "tidak ada".
 *     Berbeda dari Hero, halaman ini tidak punya ornamen SVG pengganti: isinya
 *     adalah form, dan form harus tetap utuh dan tetap terbaca kalau WebGL
 *     ditolak. Jadi komponen ini mengembalikan `null` dan halaman tetap
 *     berfungsi penuh. Tidak ada teks yang bergantung pada objek ini.
 *
 *  3. Render loop berhenti TOTAL saat kanvas keluar viewport (rootMargin
 *     -20%) dan saat tab disembunyikan. Bukan disembunyikan lewat opacity -
 *     rAF dibatalkan supaya GPU tidak menggambar sama sekali.
 *
 *  4. reduced-motion: satu frame statis, benda ruang dan debu tetap terlihat.
 *
 * KANVAS BARU SETIAP KALI CONTEXT DILEPAS
 * ---------------------------------------
 * `renderer.forceContextLoss()` membunuh context untuk selamanya pada elemen
 * canvas yang sama. Kalau scene dilepas lalu dibangun lagi di elemen yang
 * SAMA, `canvas.getContext()` mengembalikan context mati: scene berjalan normal,
 * tidak ada error, tapi tidak satu piksel pun tergambar. Persis gejala yang
 * pernah terjadi di armillary, dan perbaikannya sama - `generation` jadi key
 * canvas supaya React membuang elemen lama dan membuat yang baru.
 */
import { useEffect, useRef, useState } from 'react';
import { useMotionMode } from '../hooks/useMotionMode';
import type { OlympiadHandle } from '../three/olympiadScene';

export function OlympiadScene({ className = '' }: { className?: string }) {
  const mode = useMotionMode();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<OlympiadHandle | null>(null);
  const [generation, setGeneration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  /*
   * HANYA mode 'rich'.
   *
   * Ini yang membuat permintaan "di layar mobile semua efek dimatikan" terpenuhi
   * tanpa satu pun breakpoint tambahan: mode 'simple' sudah menutup HP, tablet,
   * pointer kasar, DAN pengguna reduced-motion. Menambah `@media (max-width: ...)`
   * di sini hanya akan membuat cabang kedua yang harus dijaga sinkron dengan
   * cabang pertama - dan dua sumber kebenaran untuk hal yang sama selalu
   * berakhir salah satu.
   */
  const rich = mode === 'rich';

  useEffect(() => {
    if (!rich) {
      setFailed(false);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    import('../three/olympiadScene')
      .then((mod) => {
        if (cancelled) return;
        try {
          handleRef.current = mod.createOlympiadScene(canvas, { reduced: false });
          requestAnimationFrame(() => {
            if (!cancelled) setReady(true);
          });
        } catch (err) {
          // Wajib: WebGL ditolak. Halaman form tetap harus utuh tanpa objek.
          console.warn('WebGL scene form gagal, form tetap tanpa latar 3D:', err);
          setFailed(true);
        }
      })
      .catch((err) => {
        console.warn('Modul scene form gagal dimuat, form tetap tanpa latar 3D:', err);
        setFailed(true);
      });

    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
      setReady(false);
      // Ganti elemen canvas, bukan hanya melepas scenenya (lihat header file).
      setGeneration((g) => g + 1);
    };
  }, [rich]);

  // Loop berhenti saat kanvas tidak terlihat. `rootMargin` negatif menyusutkan
  // area deteksi, jadi jeda terjadi sedikit SEBELUM benar-benar keluar layar:
  // tidak ada bingkai yang digambar untuk sesuatu yang tidak terlihat.
  useEffect(() => {
    if (!rich || failed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const io = new IntersectionObserver(([e]) => {
      handleRef.current?.setPaused(!e.isIntersecting);
    }, { rootMargin: '-20%' });
    io.observe(canvas);

    return () => io.disconnect();
  }, [rich, failed, generation]);

  if (!rich || failed) return null;

  return (
    <div
      aria-hidden="true"
      className={'pointer-events-none absolute inset-0 overflow-hidden ' + className}
    >
      <canvas
        key={generation}
        ref={canvasRef}
        className={
          'absolute inset-0 h-full w-full transition-opacity duration-1000 ease-out ' +
          (ready ? 'opacity-90' : 'opacity-0')
        }
      />
    </div>
  );
}
