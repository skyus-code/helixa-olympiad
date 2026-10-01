/**
 * Tiga simbol matematika sebagai latar section "Cara Ikut".
 *
 * Setiap simbol punya kecepatan parallax SENDIRI, dan itu inti efeknya:
 * kalau ketiganya bergerak dengan faktor sama, yang terlihat hanya "tiga
 * gambar yang bergerak serempak" - terbaca sebagai satu layer, bukan tiga.
 * Dengan faktor berbeda, saat digulir ketiganya saling menyilang dan mata
 * membaca kedalaman.
 *
 *   Sigma  0.15 - paling belakang, nyaris tidak bergerak
 *   Phi    0.25 - tengah, plus geser horizontal
 *   f(x)   0.35 - paling depan, paling cepat
 *
 * Kenapa pakai motion/react `useScroll` + `useTransform`:
 * motion adalah stack animasi resmi proyek ini, jadi parallax ini memakai
 * mechanism yang sama dengan titik parallax lain. Scroll progress dihitung dari
 * posisi section terhadap viewport, sama seperti `useScrollProgress` yang
 * dipakai garis progres langkah di section ini.
 *
 * PENTING: ini murni berbasis posisi scroll. Tidak ada rotasi atau animasi
 * yang berjalan sendiri waktu, jadi tidak masuk kategori infinite-loop yang
 * dilarang.
 */
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { PARALLAX } from '../../lib/motion';

export function MathSymbols({
  className = '',
  parallax = false,
}: {
  className?: string;
  /**
   * Nyalakan parallax scroll. Hanya mode 'rich' yang menyalakannya; di mode
   * lain simbol tetap dirender, hanya diam di posisi netral.
   */
  parallax?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();

  // Progres section sendiri terhadap viewport: 0 saat section mulai masuk dari
  // bawah, 1 saat sudah keluar di atas. Basis ini yang membuat semua paralaks
  // berbagi satu clock, sehingga tidak ada yang mulai atau berhenti duluan.
  const { scrollYProgress } = useScroll({
    target: rootRef,
    offset: ['start end', 'end start'],
  });

  const sigmaY = useTransform(scrollYProgress, [0, 1], [PARALLAX.mathSigma.travel, -PARALLAX.mathSigma.travel]);
  const phiY = useTransform(scrollYProgress, [0, 1], [PARALLAX.mathPhi.travel, -PARALLAX.mathPhi.travel]);
  const phiX = useTransform(scrollYProgress, [0, 1], [-PARALLAX.mathPhi.x, PARALLAX.mathPhi.x]);
  const fnY = useTransform(
    scrollYProgress,
    [0, 1],
    [PARALLAX.mathFunction.travel, -PARALLAX.mathFunction.travel],
  );

  // Hooks di atas harus dipanggil tanpa syarat, jadi penampilannya yang
  // dipilih, bukan transform-nya. Nilai 0 berarti "diam di posisi netral".
  const live = parallax && !reduce;
  const sigma = live ? sigmaY : 0;
  const phiStyle = live ? { x: phiX, y: phiY } : undefined;
  const fn = live ? fnY : 0;

  return (
    <div ref={rootRef} aria-hidden="true" className={className}>
      <motion.span
        className="math-symbol absolute font-display leading-none text-bone"
        style={{ left: '8%', top: '22%', fontSize: 128, rotate: -6, y: sigma }}
      >
        {'\u03A3'}
      </motion.span>

      <motion.span
        className="math-symbol absolute font-display leading-none text-bone"
        style={{ left: '72%', top: '58%', fontSize: 112, rotate: 5, ...phiStyle }}
      >
        {'\u03C6'}
      </motion.span>

      <motion.span
        className="math-symbol absolute font-display leading-none text-bone"
        style={{ left: '18%', top: '86%', fontSize: 96, rotate: -3, y: fn }}
      >
        f(x)
      </motion.span>
    </div>
  );
}