/**
 * Pembungkus `gsap.matchMedia()` — satu-satunya pintu masuk animasi.
 *
 * Kenapa tidak memanggil `gsap.matchMedia()` langsung di tiap komponen?
 *
 * 1. Membersihkan diri sendiri. Setiap komponen cukup mendaftarkan query dan
 *    callback; `revert()` dipanggil GSAP otomatis saat query tidak cocok lagi
 *    (resize, user mengubah setelan aksesibilitas, atau komponen di-unmount).
 *    Animasi yang lupa dibersihkan adalah sumber utama memory leak dan elemen
 *    yang tertinggal dalam keadaan `opacity: 0`.
 * 2. Menghapus satu pertanyaan yang sering muncul: "haruskah saya cek
 *    reduced-motion sendiri di setiap file?".
 *
 * Semua animasi WAJIB didaftarkan lewat hook ini, bukan lewat `gsap.to(...)`
 * telanjang di level modul.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from '../lib/gsap';

/** `useLayoutEffect` yang tidak memunculkan warning saat render di server. */
export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type MediaSetup = () => void | (() => void);

/**
 * Jalankan `setup` di dalam `gsap.matchMedia()` untuk sebuah query.
 *
 * @example
 * useGsapMedia('[data-reveal]', () => {
 *   gsap.from('[data-reveal]', { opacity: 0, y: 32, scrollTrigger: { trigger: el } });
 * });
 */
export function useGsapMedia(query: string, setup: MediaSetup, deps: unknown[] = []) {
  // Callback disimpan di ref supaya perubahan identitas fungsi tidak
  // membuat effect berjalan ulang terus-menerus.
  const setupRef = useRef(setup);
  setupRef.current = setup;

  useIsoLayoutEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(query, () => {
      const cleanup = setupRef.current();
      return typeof cleanup === 'function' ? cleanup : undefined;
    });

    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ...deps]);
}

/**
 * Selesai kan animasi yang sedang berjalan pada sekumpulan elemen.
 * Dipakai komponen yang butuh memaksa elemen ke keadaan akhir saat
 * reduced-motion aktif, supaya tidak ada yang tertinggal setengah jalan.
 */
export function settleToEnd(target: string | Element | null) {
  if (!target) return;
  gsap.set(target, { clearProps: 'all' });
}
