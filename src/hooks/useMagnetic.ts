/**
 * Magnetic pull — elemen yang "tertarik" ke arah kursor saat didekati.
 *
 * Dua syarat yang tidak bisa dilewati:
 *  1. Hanya di perangkat dengan pointer presisi. Di layar sentuh tidak ada
 *     kursor, jadi magnet hanya akan menambah event tanpa efek apa pun.
 *  2. Hanya saat reduced-motion tidak aktif (query `motionFine`).
 *
 * Implementasi tanpa GSAP: `pointermove` menulis dua custom property
 * (`--magnet-x`, `--magnet-y`) di elemen, dan CSS (`.magnetic`) menerjemahkan
 * keduanya ke transform dengan transisi halus. Pointermove yang datang
 * 60x/detik cukup mengubah custom property — tidak ada tween yang menumpuk
 * dan tidak ada re-render React (style satu elemen yang berubah).
 */
import { useRef } from 'react';
import { CURSOR, MQ } from '../lib/motion';
import { useIsoLayoutEffect } from './useIsoLayoutEffect';

export function useMagnetic<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T | null>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!enabled) return;
    if (!window.matchMedia(MQ.motionFine).matches) return;

    let rect: DOMRect | null = null;
    let stale = true;

    /*
     * Rect diukur LAZY (hanya saat pointer benar-benar bergerak), bukan saat
     * mount: mengukur saat mount memaksa layout sinkron di tengah load halaman.
     */
    const measure = () => {
      rect = el.getBoundingClientRect();
      stale = false;
    };

    /*
     * Scroll & resize hanya menandai rect basi — TIDAK mengoreksinya dengan
     * delta scroll. Tombol ini berada di dalam section `position: sticky`
     * yang berhenti bergerak begitu ter-pin, jadi koreksi delta scroll membuat
     * cached rect melenceng justru di section yang sedang ditonjolkan.
     * Pengukuran ulang ditunda ke frame berikutnya: satu layout per frame
     * scroll, bukan satu per event scroll.
     */
    let raf = 0;
    const invalidate = () => {
      stale = true;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    const apply = (x: number, y: number) => {
      el.style.setProperty('--magnet-x', x + 'px');
      el.style.setProperty('--magnet-y', y + 'px');
    };

    const onMove = (e: PointerEvent) => {
      if (!rect || stale) measure();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      // Jarak dari titik tengah: mengukur jarak (bukan offset per sumbu)
      // membuat magnet terasa melingkar, bukan kotak.
      const dist = Math.hypot(dx, dy);
      const radius = Math.max(rect.width, rect.height) / 2 + CURSOR.magneticRadius;
      if (dist > radius) {
        apply(0, 0);
        return;
      }
      // Pergeseran dibatasi dua lapis: proporsional terhadap ukuran elemen
      // lalu pagar keras `magneticMax`.
      const cap = Math.min(Math.max(rect.width, rect.height) * 0.12, CURSOR.magneticMax);
      const pull = (v: number) => Math.max(-cap, Math.min(cap, v * CURSOR.magneticStrength));
      apply(pull(dx), pull(dy));
    };

    const onReset = () => apply(0, 0);

    window.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onReset);
    window.addEventListener('scroll', invalidate, { passive: true });
    window.addEventListener('resize', invalidate, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onReset);
      window.removeEventListener('scroll', invalidate);
      window.removeEventListener('resize', invalidate);
    };
  }, [enabled]);

  return ref;
}

/**
 * Registri global elemen interaktif — dipakai CursorLayer untuk membesarkan
 * cincin kursor saat kursor berada di atas elemen yang terdaftar.
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
  // tidak pernah tahu targets sudah ada.
  fn(hoverTargets.size > 0);
  return () => listeners.delete(fn);
}