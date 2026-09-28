import { useEffect, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * Parallax halus: geser `ref` secara vertikal mengikuti kecepatan scroll.
 *
 * Aturan main:
 *  - Hanya aktif di layar lebar (>= 1024px) DAN pointer presisi.
 *  - Dimatikan total bila `prefers-reduced-motion: reduce`.
 *  - Hanya memakai `transform` (tidak pernah top/margin) supaya tidak memicu layout.
 *  - `maxShift` membatasi jarak agar ornaments tidak meleset jauh.
 */
export function useParallax(maxShift = 60) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;

    const finePointer = window.matchMedia('(pointer: fine)');
    const wideScreen = window.matchMedia('(min-width: 1024px)');

    let frame = 0;
    let enabled = finePointer.matches && wideScreen.matches;

    const node = ref.current;
    if (!node) return;

    const render = () => {
      frame = 0;
      if (!enabled) {
        node.style.transform = 'translate3d(0, 0, 0)';
        return;
      }

      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight;
      if (rect.bottom < -200 || rect.top > viewport + 200) return;

      // -1 (element di bawah layar) .. 1 (element di atas layar)
      const center = rect.top + rect.height / 2;
      const progress = (center - viewport / 2) / (viewport / 2);
      const clamped = Math.max(-1, Math.min(1, progress));
      const shift = clamped * maxShift;

      node.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(render);
    };

    const sync = () => {
      enabled = finePointer.matches && wideScreen.matches;
      onScroll();
    };

    node.style.willChange = 'transform';
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    finePointer.addEventListener('change', sync);
    wideScreen.addEventListener('change', sync);
    render();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      finePointer.removeEventListener('change', sync);
      wideScreen.removeEventListener('change', sync);
      node.style.willChange = 'auto';
      node.style.transform = 'translate3d(0, 0, 0)';
    };
  }, [maxShift, reduced]);

  return ref;
}
