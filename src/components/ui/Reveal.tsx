import { useRef, type ElementType, type ReactNode } from 'react';
import { gsap } from '../../lib/gsap';
import { EASE, DUR, MQ } from '../../lib/motion';
import { useGsapMedia, useIsoLayoutEffect } from '../../hooks/useGsapMedia';

type RevealProps = {
  children: ReactNode;
  /** Elemen yang dibungkus. Default div. */
  as?: ElementType;
  /** Jeda tambahan dalam detik, untuk stagger manual antar kartu. */
  delay?: number;
  /** Jarak naik dalam piksel. */
  y?: number;
  className?: string;
  /** Berapa banyak piksel elemen harus masuk viewport sebelum memicu. */
  start?: string;
};

/**
 * Reveal berbasis ScrollTrigger.
 *
 * Perbedaan penting dari versi lama: elemen TIDAK diberi `opacity: 0` lewat
 * CSS. State awal ditulis GSAP lewat `gsap.from()` pada saat ScrollTrigger
 * dibuat. Kalau JavaScript gagal dimuat, teks tetap terbaca penuh — bukan
 * terkubur dan tidak bisa di-scroll.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  y = 32,
  className = '',
  start = 'top 85%',
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useGsapMedia(MQ.motion, () => {
    const el = ref.current;
    if (!el) return;

    gsap.from(el, {
      opacity: 0,
      y,
      duration: DUR.reveal,
      ease: EASE.reveal,
      delay,
      force3D: true,
      scrollTrigger: {
        trigger: el,
        start,
        once: true,
      },
    });
  });

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/**
 * Reveal untuk kelompok elemen sekaligus, dengan stagger.
 * Dipakai grid 4 kartu dan timeline 4 langkah.
 */
export function RevealGroup({
  children,
  selector,
  className = '',
  stagger = DUR.revealStagger,
  y = 32,
  start = 'top 82%',
}: {
  children: ReactNode;
  selector: string;
  className?: string;
  stagger?: number;
  y?: number;
  start?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useGsapMedia(MQ.motion, () => {
    const root = ref.current;
    if (!root) return;
    const items = root.querySelectorAll(selector);
    if (!items.length) return;

    gsap.from(items, {
      opacity: 0,
      y,
      duration: DUR.reveal,
      ease: EASE.reveal,
      stagger,
      force3D: true,
      scrollTrigger: { trigger: root, start, once: true },
    });
  });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * Memastikan elemen yang dianimasikan GSAP tidak tertinggal tak terlihat
 * bila animasi gagal berjalan (mis. WebGL gagal, atau GSAP belum load).
 * Dipanggil sekali setelah mount.
 */
export function useRevealSafety(ref: React.RefObject<HTMLElement | null>) {
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Kalau dalam 1.2s elemen masih di opacity 0 padahal tidak ada animasi
    // yang berjalan, lempar ke keadaan akhir.
    const t = window.setTimeout(() => {
      const opacity = Number(getComputedStyle(el).opacity);
      if (opacity < 0.05 && gsap.getTweensOf(el).length === 0) {
        gsap.set(el, { clearProps: 'all' });
      }
    }, 1200);
    return () => window.clearTimeout(t);
  }, [ref]);
}
