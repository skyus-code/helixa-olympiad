import { LazyMotion, domAnimation } from 'motion/react';

/**
 * Pembungkus `LazyMotion` agar bundel hanya memuat fitur animasi DOM dasar
 * (bukan keseluruhan runtime motion). Menghemat ~60% ukuran JS.
 *
 * Karena alasan itu semua komponen memakai `m.*` (bukan `motion.*`).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
