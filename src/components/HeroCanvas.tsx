/**
 * Canvas WebGL untuk latar hero.
 *
 * Kenapa tidak memakai React Three Fiber: yang dibutuhkan di sini hanya satu
 * canvas statis yang tidak punya state React. R3F menambah reconciler, drei,
 * dan sekitar 90 kB gzip tanpa keuntungan apa pun di sini, sementara Three.js
 * murni membuat bundel tetap ringan.
 *
 * Canvas di-import() secara dinamis. Konsekuensi yang disengaja: bundle
 * utama tidak menunggu three.js, sehingga teks hero tampil lebih dulu (LCP
 * cepat) dan mesh muncul menyusul dengan fade-in.
 *
 * Canvas hanya boleh tampil kalau scene benar-benar ada. Dua syarat harus
 * terpenuhi bersamaan: viewport sudah menyentuhnya, dan createHelixScene()
 * selesai. Tanpa syarat kedua, di mobile (WebGL dimatikan) atau saat WebGL
 * ditolak, canvas tetap fade-in menampakkan bidang kosong di atas ambient
 * glow.
 */
import { useRef, useState } from 'react';
import { MQ } from '../lib/motion';
import { useGsapMedia, useIsoLayoutEffect } from '../hooks/useGsapMedia';
import type { SceneHandle } from '../three/helixScene';

export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);

  // Gate lebar: di bawah 768px Three.js dimatikan dan diganti ambient glow
  // CSS, agar menghemat baterai dan mencegah frame drop saat scroll di ponsel.
  useGsapMedia(MQ.motionWide, () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let handle: SceneHandle | null = null;
    let cancelled = false;

    import('../three/helixScene')
      .then(async (mod) => {
        if (cancelled) return;
        try {
          handle = await mod.createHelixScene(canvas);
        } catch (err) {
          // WebGL bisa ditolak (GPU blocklist, driver, context lost).
          // Situs harus tetap utuh, jadi jatuh ke ambient glow.
          console.warn('WebGL hero gagal, memakai fallback CSS:', err);
          setFailed(true);
          return;
        }
        if (cancelled) {
          handle.dispose();
          handle = null;
          return;
        }
        setReady(true);
      })
      .catch((err) => {
        console.warn('Modul WebGL hero gagal dimuat, memakai fallback CSS:', err);
        setFailed(true);
      });

    const onPointer = (e: PointerEvent) => {
      // Normalisasi ke -1..1 relatif terhadap tengah viewport.
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      handle?.setPointer(x, y);
    };

    const onScroll = () => {
      const progress = window.scrollY / Math.max(1, window.innerHeight);
      handle?.setScroll(Math.min(1, Math.max(0, progress)));
    };

    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      cancelled = true;
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      handle?.dispose();
      handle = null;
      setReady(false);
    };
  });

  // Ambient glow selalu ada sebagai lapisan dasar: ia yang terlihat di
  // reduced-motion, di mobile, dan sewaktu three.js masih dimuat.
  useIsoLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 });
    io.observe(canvas);
    return () => io.disconnect();
  }, [failed]);

  if (failed) return null;

  return (
    <div
      aria-hidden="true"
      className="hero-canvas-wrap pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="hero-ambient absolute inset-0" />
      <canvas
        ref={canvasRef}
        className={
          'hero-canvas absolute inset-0 h-full w-full transition-opacity duration-1000 ' +
          (ready && inView ? 'opacity-100' : 'opacity-0')
        }
      />
    </div>
  );
}
