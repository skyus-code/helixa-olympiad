/**
 * Hero: partikel DNA three.js, hanya di mode 'rich'.
 *
 * Aturan yang dipegang komponen ini:
 *
 *  1. three.js hanya masuk lewat `import()` DINAMIS di dalam cabang
 *     `mode === 'rich'`. Mode 'simple' dan 'reduced' tidak pernah mencapai baris
 *     itu, jadi chunk three.js tidak pernah terunduh di HP. Inilah yang membuat
 *     syarat "mobile tidak boleh mengunduh chunk three.js" terpenuhi di level
 *     jaringan, bukan hanya di level "tidak dieksekusi".
 *
 *  2. Fallback wajib. Pembuatan WebGL context dibungkus try/catch di dalam
 *     `.then()`. Kalau GPU atau driver menolak (WebGL dimatikan lewat DevTools,
 *     context habis, polity ketat), komponen ini melapor kegagalan lewat
 *     `onFallback` dan Hero merender SVG DnaHelix sebagai gantinya. Hero tidak
 *     boleh kosong.
 *
 *  3. Render loop berhenti TOTAL saat hero keluar jauh dari viewport
 *     (IntersectionObserver dengan rootMargin -20%). Bukan sekadar disembunyikan
 *     lewat opacity: rAF dibatalkan sehingga GPU tidak menggambar sama sekali.
 *
 *  4. reduced-motion: satu frame statis. Partikel tetap terlihat, hanya tidak
 *     berputar dan tidak mengejar mouse.
 */
import { useEffect, useRef, useState } from 'react';
import { useMotionMode } from '../hooks/useMotionMode';
import type { DnaSceneHandle } from '../three/dnaParticles';

export function HeroParticles({
  className = '',
  onFallback,
}: {
  className?: string;
  /** Dipanggil sekali saat WebGL gagal, supaya Hero bisa merender SVG. */
  onFallback?: () => void;
}) {
  const mode = useMotionMode();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<DnaSceneHandle | null>(null);
  const [status, setStatus] = useState<'idle' | 'ready' | 'failed'>('idle');

  const rich = mode === 'rich';

  useEffect(() => {
    if (!rich) {
      setStatus('idle');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    import('../three/dnaParticles')
      .then((mod) => {
        if (cancelled) return;
        let scene: DnaSceneHandle;
        try {
          scene = mod.createDnaScene(canvas, { reduced: false });
        } catch (err) {
          // Wajib: WebGL ditolak. Jatuh ke SVG, jangan biarkan hero kosong.
          console.warn('WebGL hero gagal, memakai SVG helix:', err);
          setStatus('failed');
          onFallback?.();
          return;
        }
        if (cancelled) {
          scene.dispose();
          return;
        }
        handleRef.current = scene;
        setStatus('ready');
      })
      .catch((err) => {
        console.warn('Modul partikel hero gagal dimuat, memakai SVG helix:', err);
        setStatus('failed');
        onFallback?.();
      });

    const onPointer = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      handleRef.current?.setPointer(x, y);
    };
    const onScroll = () => {
      const progress = window.scrollY / Math.max(1, window.innerHeight);
      handleRef.current?.setScroll(Math.min(1, Math.max(0, progress)));
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      cancelled = true;
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      handleRef.current?.dispose();
      handleRef.current = null;
      setStatus('idle');
    };
    // onFallback sengaja tidak masuk dependensi: callback dari induk berubah
    // identitas setiap render, dan memakainya akan tearing down scene tiap
    // render. Scene boleh hidup sedikit lebih lama dari callback-nya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rich]);

  // Berhenti total saat hero jauh dari viewport, dan saat tab disembunyikan.
  // rootMargin -20% membuat isIntersecting sudah false SEBELUM elemen benar-benar
  // keluar layar, jadi tidak ada frame wasted saat user scroll cepat ke bawah.
  useEffect(() => {
    if (status !== 'ready') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // rootMargin -20% menyusutkan area deteksi, jadi isIntersecting sudah
    // false SEBELUM hero benar-benar keluar layar. Efeknya loop berhenti
    // sedikit lebih awal: tidak ada frame yang digambar untuk hero yang sudah
    // tidak terlihat sama sekali. Ini yang membuat syarat "render loop benar-
    // benar berhenti saat hero jauh" benar-benar terpenuhi, bukan sekadar
    // "tidak terlihat ada yang jalan".
    const io = new IntersectionObserver(
      ([e]) => {
        handleRef.current?.setPaused(!e.isIntersecting);
      },
      { rootMargin: '-20%' },
    );
    io.observe(canvas);

    const onVis = () => {
      if (document.hidden) handleRef.current?.setPaused(true);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [status]);

  // Mode non-rich tidak memasang canvas sama sekali; fallback-nya dipegang Hero.
  if (!rich || status === 'failed') return null;

  return (
    <div
      aria-hidden="true"
      className={'pointer-events-none absolute inset-0 overflow-hidden ' + className}
    >
      <canvas
        ref={canvasRef}
        className={
          'absolute inset-0 h-full w-full transition-opacity duration-1000 ' +
          (status === 'ready' ? 'opacity-100' : 'opacity-0')
        }
      />
    </div>
  );
}