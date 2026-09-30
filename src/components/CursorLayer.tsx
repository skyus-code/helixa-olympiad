/**
 * Kursor kustom: cincin emas tipis yang mengikuti pointer, membesar saat
 * berada di atas elemen interaktif.
 *
 * Tiga lapis keamanan, karena kursor kustom adalah fitur yang paling mudah
 * merusak situs kalau salah:
 *
 * 1. HANYA di pointer presisi. Di layar sentuh tidak ada kursor untuk
 *    disembunyikan; memaksa `cursor: none` di sana akan membuat pengguna
 *    kehilangan penanda sentuh sama sekali.
 * 2. HANYA saat reduced-motion tidak aktif. Cincin yang mengejar kursor
 *    adalah gerakan terus-menerus.
 * 3. Ditambahkan lewat portal ke <body> dengan `position: fixed` dan
 *    `pointer-events: none`, sehingga tidak pernah bisa berubah menjadi
 *    blocker klik maupun ikut ter-scroll bersama dokumen.
 *
 * Posisi tidak disimpan di state React: element langsung dimutate lewat
 * transform supaya tidak ada re-render per frame.
 */
import { useRef } from 'react';
import { gsap } from '../lib/gsap';
import { CURSOR, DUR, MQ } from '../lib/motion';
import { useIsoLayoutEffect } from '../hooks/useGsapMedia';
import { subscribeHoverState } from '../hooks/useMagnetic';

export function CursorLayer() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  useIsoLayoutEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const fine = window.matchMedia(MQ.motionFinePointer);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    const root = document.documentElement;

    const teardown: Array<() => void> = [];

    const setup = () => {
      teardown.forEach((fn) => fn());
      teardown.length = 0;

      if (!fine.matches || reduce.matches) {
        root.removeAttribute('data-custom-cursor');
        gsap.set([dot, ring], { autoAlpha: 0 });
        return;
      }

      root.setAttribute('data-custom-cursor', 'on');

      // Titik dalam harus selalu tepat di pusat cincin. Kalau titik diberi
      // lerp sendiri yang lebih cepat daripada cincin, ia akan menyembul
      // keluar dari lingkaran saat kursor bergerak cepat. Solusinya: posisi
      // titik disalin dari posisi cincin — yang sedang dilerp — setiap kali
      // cincin bergerak, sehingga keduanya tidak pernah bisa berpisah.
      const alignDot = () => {
        dot.style.transform =
          'translate(' + gsap.getProperty(ring, 'x') + 'px, ' + gsap.getProperty(ring, 'y') + 'px)';
      };
      const ringX = gsap.quickTo(ring, 'x', {
        duration: DUR.cursorFollow,
        ease: 'power3.out',
        onUpdate: alignDot,
      });
      const ringY = gsap.quickTo(ring, 'y', {
        duration: DUR.cursorFollow,
        ease: 'power3.out',
        onUpdate: alignDot,
      });

      let visible = false;
      const show = () => {
        if (visible) return;
        visible = true;
        gsap.to([dot, ring], { autoAlpha: 1, duration: 0.2 });
      };
      const hide = () => {
        visible = false;
        gsap.to([dot, ring], { autoAlpha: 0, duration: 0.15 });
      };

      const onMove = (e: PointerEvent) => {
        show();
        ringX(e.clientX);
        ringY(e.clientY);
      };

      const onDown = () => gsap.to(ring, { scale: 0.82, duration: 0.2 });
      const onUp = () => gsap.to(ring, { scale: 1, duration: 0.3 });

      // Kursor keluar jendela (mis. pindah ke tab lain) -> sembunyikan.
      const onLeaveWindow = () => hide();
      const onEnterWindow = () => {
        show();
      };

      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onDown, { passive: true });
      window.addEventListener('pointerup', onUp, { passive: true });
      document.addEventListener('mouseleave', onLeaveWindow);
      document.addEventListener('mouseenter', onEnterWindow);

      teardown.push(() => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        document.removeEventListener('mouseleave', onLeaveWindow);
        document.removeEventListener('mouseenter', onEnterWindow);
        gsap.killTweensOf([dot, ring]);
      });

      // Ukuran cincin mengikuti status hover global (tombol, kartu, link).
      const unsub = subscribeHoverState((active) => {
        gsap.to(ring, {
          width: active ? CURSOR.sizeActive : CURSOR.sizeIdle,
          height: active ? CURSOR.sizeActive : CURSOR.sizeIdle,
          borderColor: active ? 'rgba(246,231,180,0.9)' : 'rgba(212,175,55,0.65)',
          duration: DUR.hover,
          ease: 'power3.out',
        });
        gsap.to(dot, { autoAlpha: active ? 0 : 1, duration: DUR.hover });
      });
      teardown.push(() => {
        unsub();
      });

      // Kondisi awal: sembunyikan, dan letakkan di tengah layar supaya tidak
      // berkedip di pojok kiri atas saat halaman dimuat.
      gsap.set([dot, ring], { autoAlpha: 0 });
      gsap.set(dot, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
      gsap.set(ring, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    };

    setup();

    const onChange = () => setup();
    fine.addEventListener('change', onChange);
    reduce.addEventListener('change', onChange);

    return () => {
      fine.removeEventListener('change', onChange);
      reduce.removeEventListener('change', onChange);
      teardown.forEach((fn) => fn());
      root.removeAttribute('data-custom-cursor');
    };
  }, []);


  return (
    <>
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[100] rounded-full border opacity-0"
        style={{
          width: CURSOR.sizeIdle,
          height: CURSOR.sizeIdle,
          marginLeft: -CURSOR.sizeIdle / 2,
          marginTop: -CURSOR.sizeIdle / 2,
          borderColor: 'rgba(212,175,55,0.65)',
          borderWidth: 1,
          willChange: 'transform, width, height',
          mixBlendMode: 'screen',
        }}
      />
      <div
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[101] rounded-full bg-gold-bright opacity-0"
        style={{ width: 4, height: 4, marginLeft: -2, marginTop: -2, willChange: 'transform' }}
      />
    </>
  );
}
