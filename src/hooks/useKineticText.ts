/**
 * Kinetic typography — SplitText GSAP.
 *
 * Risiko utama yang ditangani di sini: SplitText menulis ulang DOM (membungkus
 * tiap huruf/baris dalam <span>), sedangkan React owning DOM itu. Kalau split
 * tidak di-revert saat unmount, React akan mencoba menghapus/mengganti node
 * yang sudah tidak lagi ada -> error dan memory leak.
 *
 * Karena itu:
 *  - `mask: 'lines'` dipakai supaya tiap baris dapat wrapper ber-overflow
 *    sendiri; huruf "naik dari dalam mask" bukan sekadar fade.
 *  - `autoSplit: true` membuat SplitText menghitung ulang baris sendiri saat
 *    ukuran layar berubah (huruf tidak akan terpotong di tengah kata).
 *  - Callback dibungkus `gsap.context()`, sehingga semua GSAP yang dibuat di
 *    dalamnya ikut ter-revert bersama.
 */
import { useRef } from 'react';
import { gsap, SplitText, ScrollTrigger } from '../lib/gsap';
import { EASE, DUR } from '../lib/motion';
import { useIsoLayoutEffect } from './useGsapMedia';

type Options = {
  /** Query untuk mencari elemen dalam ref ini. */
  selector?: string;
  /** Tekan animasi sampai elemen masuk viewport. Default: true. */
  onScroll?: boolean;
  /** Delay sebelum animasi mulai. */
  delay?: number;
  /** Target animasi boleh dipindai berkali-kali (untuk loop) — default false. */
  start?: string;
};

export function useKineticText(
  containerRef: React.RefObject<HTMLElement | null>,
  options: Options = {},
) {
  const { selector = '[data-kinetic]', onScroll = true, delay = 0, start } = options;
  const ctxRef = useRef<gsap.Context | null>(null);
  const splitRef = useRef<SplitText | null>(null);

  useIsoLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduced = !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    if (reduced) return;

    const targets = container.querySelectorAll(selector);
    if (targets.length === 0) return;

    ctxRef.current = gsap.context(() => {
      targets.forEach((el) => {
        const split = new SplitText(el, {
          type: 'lines,words,chars',
          mask: 'lines',
          autoSplit: true,
          // `aria` membuat GSAP menambah aria-label dengan teks utuh,
          // supaya screen reader tetap membaca kalimat normal, bukan
          // huruf demi huruf.
          aria: 'auto',
        });
        splitRef.current = split;

        const tweenVars: gsap.TweenVars = {
          yPercent: 110,
          opacity: 0,
          duration: DUR.kinetic,
          ease: EASE.kinetic,
          stagger: DUR.kineticStagger,
          delay,
          force3D: true,
        };

        if (onScroll) {
          gsap.to(split.chars, {
            ...tweenVars,
            scrollTrigger: {
              trigger: el,
              start: start ?? 'top 82%',
              once: true,
            },
          });
        } else {
          gsap.to(split.chars, tweenVars);
        }
      });
    }, container);

    // Font Google dimuat belakangan; tanpa refresh, ScrollTrigger menghitung
    // posisi trigger dari tinggi font fallback yang berbeda.
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }

    return () => {
      splitRef.current?.revert();
      splitRef.current = null;
      ctxRef.current?.revert();
      ctxRef.current = null;
    };
  }, [containerRef, selector, onScroll, delay, start]);

  return { splitRef };
}
