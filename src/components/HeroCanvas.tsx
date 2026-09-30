/**
 * Canvas untuk latar hero: objek 3D heliks DNA dengan satelit yang mengorbit.
 *
 * Kenapa komponen React ini sangat tipis? Karena React hanya perlu
 * `createHelixScene(canvas)` lalu `dispose()`. Loop render sepenuhnya di luar
 * React (lihat three/helixScene.ts), jadi re-render komponen lain — misalnya
 * saat FAQ dibuka — tidak menyentuh canvas sama sekali.
 *
 * Modul scene di-`import()` dinamis. Konsekuensi yang disengaja: bundle utama
 * tidak menunggu scene, sehingga teks hero tampil lebih dulu (LCP cepat) dan
 * objek 3D menyusul dengan fade-in.
 *
 * Canvas hanya boleh tampil kalau scene benar-benar ada. Dua syarat harus
 * terpenuhi bersamaan: viewport sudah menyentuhnya, dan `createHelixScene()`
 * selesai. Tanpa syarat kedua, di perangkat tanpa Canvas 2D atau saat
 * inisialisasi gagal, canvas tetap fade-in menampakkan bidang kosong di atas
 * ambient glow.
 *
 * Gerbang `MQ.motionScene`: reduced-motion atau layar < 768px berarti scene
 * tidak pernah dibuat sama sekali, dan yang tampil murni ambient glow CSS.
 * Batas 768px ada untuk dua alasan: hemat baterai, dan mencegah rAF scene
 * berjalan bersamaan dengan hal lain saat user scroll di ponsel.
 */
import { useEffect, useRef, useState } from 'react';
import { MQ } from '../lib/motion';
import { useMediaQuery } from '../hooks/useMediaQuery';
import type { SceneHandle } from '../three/helixScene';

export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);
  const sceneAllowed = useMediaQuery(MQ.motionScene);

  useEffect(() => {
    if (!sceneAllowed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let handle: SceneHandle | null = null;
    let cancelled = false;

    /*
     * Scene dibangun tanpa jeda. Dulu ada gerbang `load` di sini dengan
     * alasan "menghemat TBT". Alasan itu salah dan gerbangnya sudah dicabut.
     *
     * Pengukuran yang menyesatkan: satu seri angka TBT dianggap sebagai bukti
     * bahwa objek 3D mahal. Padahal TBT untuk build yang identik berfluktuasi
     * 1300-3720 ms di mesin ini, jadi selisih segitu tidak membuktikan apa pun.
     *
     * Yang benar diukur langsung — biaya satu frame scene:
     *
     *   1024x720 @1x ..... 4.4 ms
     *   1440x900 @1x ..... 4.5 ms
     *   1440x900 @2x ..... 4.9 ms   (canvas 2880x1800)
     *
     * Itu sekitar 27% dari anggaran frame 60 fps, dan mustahil menjadi long
     * task (ambang 50 ms) yang dihitung TBT. Menunggu `load` tidak
     * menghemat apa pun — ia hanya memperlambat objek yang justru diminta
     * untuk tampil.
     */
    import('../three/helixScene')
      .then((mod) => {
        if (cancelled) return;
        try {
          handle = mod.createHelixScene(canvas);
        } catch (err) {
          // Canvas 2D praktis selalu ada, tapi situs harus tetap utuh kalau
          // ternyata tidak. Jatuh ke ambient glow CSS.
          console.warn('Scene hero gagal, memakai fallback CSS:', err);
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
        console.warn('Modul scene hero gagal dimuat, memakai fallback CSS:', err);
        setFailed(true);
      });

    // Pointer dinormalisasi ke -1..1 relatif tengah viewport, lalu dipakai
    // scene untuk memiringkan heliks. Scroll mengatur fase putaran supaya
    // hero terasa terhubung dengan posisi halaman.
    const onPointer = (e: PointerEvent) => {
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
  }, [sceneAllowed]);

  // Canvas hanya boleh fade-in kalau benar-benar sedang terlihat. Observer
  // dipasang terpisah dari effect scene karena yang diamati adalah elemen
  // canvas-nya, bukan handle scene.
  const mounted = sceneAllowed && !failed;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 });
    io.observe(canvas);
    return () => io.disconnect();
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className={
          'absolute inset-0 h-full w-full transition-opacity duration-1000 ' +
          (ready && inView ? 'opacity-100' : 'opacity-0')
        }
      />
    </div>
  );
}
