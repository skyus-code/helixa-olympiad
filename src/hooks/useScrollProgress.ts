import { useRef, type RefObject } from 'react';
import { useScroll, useTransform, type MotionValue } from 'motion/react';
import { useIsoLayoutEffect } from './useIsoLayoutEffect';

/**
 * Progress 0..1 yang berjalan mengikuti scroll jendela, berdasarkan posisi
 * dokumen elemen (bukan rect-nya saat ini).
 *
 * Kenapa tidak `useScroll({ target })`? Dua section memakai sticky stacking,
 * jadi begitu tertahan di `top: 0` rect elemen berhenti bergerak dan progress
 * berbasis rect langsung tersangkut. Posisi dokumen tetap stabil selama
 * layout, sehingga progress dihitung dari `window.scrollY` terhadap rentang
 * [top - lead*vh, top + span*vh]. Section yang tidak di-pin ikut memakainya
 * supaya semua progress di halaman dihitung dengan cara yang sama.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  { lead = 0.25, span = 0.85 }: { lead?: number; span?: number } = {},
): MotionValue<number> {
  const range = useRef({ start: 0, end: 1 });

  useIsoLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const el: HTMLElement = node;

    let raf = 0;
    let pinned = false;

    /*
     * Posisi dokumen diukur dari `rect.top + scrollY`, BUKAN dari `offsetTop`.
     *
     * `offsetTop` tempting tapi salah di sini: untuk elemen `position: sticky`
     * ia mengembalikan kotak yang SEDANG dipin (nilai scrollY saat itu), bukan
     * posisi aslinya di dokumen — persis yang membuat progress macet.
     * `getBoundingClientRect()` benar selama section belum ter-pin, dan itulah
     * syarat yang ditegakkan di bawah: pengukuran hanya sah saat tidak ada
     * section yang sedang tertahan.
     *
     * Kalau pengukuran ditolak karena ter-pin, job-nya diulang pada scroll
     * berikutnya — begitu section lepas dari pin, posisinya kembali valid.
     */
    function measure() {
      const rect = el.getBoundingClientRect();
      pinned = rect.top <= 0.5 && rect.bottom > 0;
      if (pinned) return;
      const vh = window.innerHeight || 1;
      const top = rect.top + window.scrollY;
      range.current = { start: top - vh * lead, end: top + vh * span };
    }

    /*
     * Pengukuran ditunda ke frame berikutnya, bukan langsung di layout effect.
     * Setiap `getBoundingClientRect()` memaksa layout sinkron, dan beberapa
     * komponen lain menulis kelas/style di layout effect yang sama — sehingga
     * satu pengukuran berarti satu layout penuh dari halaman yang baru saja
     * dirender. Ditunda, semua pembacaan terkumpul dalam satu frame: satu
     * layout, bukan satu per pemanggil.
     */
    function schedule() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    }

    function onScroll() {
      if (pinned) schedule();
    }

    schedule();

    /*
     * Posisi bisa bergeser setelah pengukuran pertama: font baru selesai
     * dimuat (swap mengubah tinggi semua teks), section di atas berubah tinggi
     * karena reveal, atau viewport berubah. Satu ResizeObserver pada
     * `body` menangkap pertambahan tinggi section mana pun, jadi satu
     * observer cukup untuk seluruh halaman.
     */
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    ro.observe(document.body);
    document.fonts?.ready.then(schedule).catch(() => {});
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', onScroll);
    };
  }, [lead, span]);

  const { scrollY } = useScroll();
  return useTransform(scrollY, (v) => {
    const { start, end } = range.current;
    if (end <= start) return 0;
    return Math.min(1, Math.max(0, (v - start) / (end - start)));
  });
}
