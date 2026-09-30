/**
 * Magnetic pull — elemen yang "tertarik" ke arah kursor saat didekati.
 *
 * Dua syarat yang tidak bisa dilewati:
 *  1. Hanya di perangkat dengan pointer presisi. Di layar sentuh tidak ada
 *     kursor, jadi magnet hanya akan menambah event tanpa efek apa pun —
 *     dan menguras baterai.
 *  2. Hanya saat reduced-motion tidak aktif. Tarikan adalah perpindahan
 *     posisi yang jelas terasa sebagai gerakan.
 *
 * Implementasi memakai `gsap.quickTo` (bukan `gsap.to` per event) supaya
 * pointermove yang datang 60x/detik tidak menumpuk tween.
 */
import { useRef } from 'react';
import { gsap } from '../lib/gsap';
import { CURSOR, DUR, MQ } from '../lib/motion';
import { useIsoLayoutEffect } from './useGsapMedia';

export function useMagnetic<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T | null>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!enabled) return;
    if (!window.matchMedia(MQ.motionFinePointer).matches) return;

    // quickTo menerima < 0.1s tanpa batas (nilai 0 = infinity) supaya
    // gerakan berhenti tepat saat kursor diam.
    const xTo = gsap.quickTo(el, 'x', { duration: DUR.magnetic, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: DUR.magnetic, ease: 'power3.out' });

    let rect: DOMRect | null = null;
    // Cache rect: memanggil getBoundingClientRect() pada setiap pointermove
    // memaksa layout di setiap frame.
    const measure = () => {
      rect = el.getBoundingClientRect();
    };
    measure();

    const onMove = (e: PointerEvent) => {
      if (!rect) measure();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      // Jarak dari titik tengah. Mengukur jarak (bukan offset per sumbu)
      // bikin magnet terasa melingkar, bukan kotak.
      const dist = Math.hypot(dx, dy);
      const radius = Math.max(rect.width, rect.height) / 2 + CURSOR.magneticRadius;
      if (dist > radius) {
        xTo(0);
        yTo(0);
        return;
      }
      // Pergeseran dibatasi dua lapis. Pertama, proporsional terhadap ukuran
      // elemen: tombol kecil tidak boleh melesat sejauh kartu besar. Kedua,
      // pagar keras `magneticMax`. Tanpa pagar ini, mengarahkan kursor ke tepi
      // tombol yang lebarnya 150px bisa menggesernya 20-30px — cukup untuk
      // menabrak tombol di sebelahnya.
      const cap = Math.min(Math.max(rect.width, rect.height) * 0.12, CURSOR.magneticMax);
      const pull = (v: number) => Math.max(-cap, Math.min(cap, v * CURSOR.magneticStrength));
      xTo(pull(dx));
      yTo(pull(dy));
    };

    const onLeave = () => {
      xTo(0);
      yTo(0);
    };

    const onScroll = () => measure();

    window.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      gsap.killTweensOf(el);
    };
  }, [enabled]);

  return ref;
}

/**
 * Mengubah ukuran cincin kursor saat kursor berada di atas elemen interaktif.
 * Mengembalikan ref untuk dipasang ke elemen target, plus setter yang
 * dipanggil CursorLayer.
 */
const hoverTargets = new Set<HTMLElement>();
const listeners = new Set<(active: boolean) => void>();

function notify() {
  const active = hoverTargets.size > 0;
  listeners.forEach((fn) => fn(active));
}

/** Dipanggil CursorLayer untuk mendeteksi target magnet secara global. */
export function registerHoverTarget(el: HTMLElement) {
  hoverTargets.add(el);
  notify();
  return () => {
    hoverTargets.delete(el);
    notify();
  };
}

export function subscribeHoverState(fn: (active: boolean) => void) {
  listeners.add(fn);
  // Kirim state saat ini seketika. Tanpa ini, subscriber yang terpasang
  // SETELAH semua target terdaftar (CursorLayer berada di akhir pohon DOM)
  // tidak pernah tahu targets sudah ada, sehingga cincin kursor tertahan
  // di ukuran idle sampai ada perubahan berikutnya.
  fn(hoverTargets.size > 0);
  return () => listeners.delete(fn);
}
