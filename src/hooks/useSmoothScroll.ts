/**
 * Smooth scroll berbasis GSAP.
 *
 * KENAPA BUKAN ScrollSmoother
 * --------------------------
 * ScrollSmoother (gratis sejak GSAP 3.13) membungkus konten di dalam wrapper
 * lalu memberi transform `translate3d` ke wrapper itu. Begitu konten berada di
 * dalam elemen yang di-transform, `position: sticky` DI DALAMNYA berhenti
 * bekerja: posisi sticky dihitung relatif terhadap ancestor scroll terdekat,
 * dan transform menjadikan wrapper itu containing block baru tanpa scroll
 * container.
 *
 * Situs ini bergantung penuh pada sticky: section Kenapa Helixa dan Edisi
 * Perdana di-pin `top: 0` lalu ditimpa section berikutnya seperti kartu.
 * Kalau sticky mati, dua efek overlap itu hilang total - persis fitur yang
 * baru saja diperbaiki dan diverifikasi.
 *
 * Alternatifnya ScrollSmoother bisa dipertahankan dengan memindahkan semua
 * sticky ke pinning GSAP (ScrollTrigger `pin`), tapi itu mengganti seluruh
 * sistem stacking CSS yang sudah bekerja dengan z-index yang sudah terverifikasi,
 * dengan risiko regresi yang jauh lebih besar daripada yang DIPERBAIKI dengan
 * smooth scroll.
 *
 * YANG DIPAKAI: `gsap.ticker` sebagai driver interpolasi, dengan
 * `window.scrollTo` yang menulis posisi scroll NATIF. Posisi scroll dokumen
 * tetap berarti, sticky tetap jalan, ScrollTrigger dan `useScrollProgress` tetap
 * membaca posisi yang benar. Kita hanya menggeser posisi scroll itu lewat
 * interpolasi, bukan lewat transform.
 *
 * Pola ini setara dengan Lenis, hanya dengan ticker GSAP sebagai clock-nya.
 *
 * GERBANG
 * -------
 * Hanya mode 'rich'. Di 'simple' dan 'reduced' scroll dibiarkan native:
 *   - scroll sentuh: mengambil alih scroll sentuh merusak scroll momentum di
 *     iOS dan Android, dan momentum itu fitur, bukan efek;
 *   - reduced-motion: scroll halus adalah gerakan terus-menerus.
 *
 * CATATAN AKSESIBILITAS: `wheel` dipasang PASSIVE, jadi browser tidak
 * diblokir dan scrollbar tetap berfungsi normal. Scroll keyboard, scrollbar,
 * dan find-in-page semuanya native; sinkronisasi di bawah yang membuat posisi
 * interpolasi kita kembali BENAR setelah salah satu dari itu terjadi.
 */
import { useEffect } from 'react';
import { useMotionMode } from '../hooks/useMotionMode';

/** Bentuk ticker GSAP yang dipakai hook ini. */
type Ticker = {
  add(fn: () => void): void;
  remove(fn: () => void): unknown;
  deltaRatio(): number;
};

/**
 * Faktor interpolasi per tick. Dipakai sebagai konstanta WAKTU, bukan faktor
 * per frame: tanpa itu, kecepatan scroll terasa berbeda di layar 60Hz dan
 * 120Hz. Dikonversi ke faktor per tick lewat `deltaRatio()` di bawah.
 */
const LERP = 0.1;

export function useSmoothScroll() {
  const mode = useMotionMode();
  const enabled = mode === 'rich';

  useEffect(() => {
    if (!enabled) return;

    let alive = true;
    let ticker: Ticker | null = null;
    let tickerFn: (() => void) | null = null;

    /** Posisi yang DIINGINkan dicapai (input wheel), belum sampai ke layar. */
    let target = window.scrollY;
    /** Posisi yang benar-benar terlihat, sedang dikejar oleh ticker. */
    let current = target;
    let running = false;
    let idleTimer = 0;
    let syncTimer = 0;

    /*
     * GSAP juga di-`import()` dinamis, dengan alasan yang sama seperti three.js:
     * smooth scroll hanya jalan di mode 'rich', jadi modulnya tidak boleh ikut
     * terunduh di HP. Impor statis akan menambah sekitar 70 kB ke bundle utama
     * yang dibayar oleh semua pengunjung ponsel yang tidak pernah memakai fitur
     * ini.
     *
     * Listener dipasang lebih dulu, lalu ticker diisi setelah import selesai.
     * `start()` tidak melakukan apa-apa kalau ticker belum siap; wheel yang
     * datang di selang itu hanya tercatat di `target` dan langsung dieksekusi
     * begitu ticker hidup (lihat cabang `if (running)` di dalam `.then`).
     */
    import('gsap')
      .then((mod) => {
        if (!alive) return;
        ticker = mod.gsap.ticker as unknown as Ticker;
        if (running && tickerFn) ticker.add(tickerFn);
      })
      .catch((err) => {
        // Tanpa GSAP, smooth scroll tidak jalan dan scroll tetap native. Itu
        // degradasi yang aman, bukan error yang harus dilaporkan ke user.
        console.warn('GSAP gagal dimuat, scroll tetap native:', err);
      });

    const maxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

    function onWheel(e: WheelEvent) {
      if (e.ctrlKey) return; // pinch-zoom, biarkan browser
      target = clamp(target + e.deltaY, 0, maxScroll());
      start();
      scheduleIdle();
    }

    /*
     * Scroll yang terjadi di luar wheel kita - scrollbar, keyboard, find in
     * page, atau scroll sentuh - membuat `target` meleset. Kalau tidak
     * disinkronkan, ticker akan "menarik" halaman kembali ke posisi lamanya dan
     * melawan pengguna. Selisih kecil diabaikan karena itu memang hasil
     * interpolasi kita yang sedang berjalan.
     */
    function onScroll() {
      clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => {
        if (Math.abs(window.scrollY - target) > 4) {
          target = window.scrollY;
          current = window.scrollY;
          stop();
        }
      }, 140);
    }

    /* Setelah wheel berhenti, cocokkan target ke posisi yang benar supaya tidak
       ada energi residual yang menarik halaman setelah pengguna berhenti. */
    function scheduleIdle() {
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        target = window.scrollY;
      }, 140);
    }

    function tick() {
      const diff = target - current;
      if (Math.abs(diff) < 0.12) {
        // Snap lalu berhenti: sisa di bawah ~0.1px tidak terlihat, tapi menulis
        // posisi scroll terus-menerus tetap memaksa browser menghitung ulang
        // posisi, jadi loop dihentikan saja.
        current = target;
        window.scrollTo(0, current);
        stop();
        return;
      }
      // Lerp frame-rate independent lewat deltaRatio GSAP.
      const ratio = Math.min(ticker?.deltaRatio() ?? 1, 8);
      current += diff * (1 - Math.pow(1 - LERP, ratio));
      window.scrollTo(0, current);
    }
    tickerFn = tick;

    function start() {
      if (running) return;
      running = true;
      ticker?.add(tick);
    }

    function stop() {
      if (!running) return;
      running = false;
      ticker?.remove(tick);
    }

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      alive = false;
      stop();
      clearTimeout(idleTimer);
      clearTimeout(syncTimer);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
      // Sinkronkan posisi supaya tidak ada interpolasi yatim setelah unmount.
      target = window.scrollY;
      current = window.scrollY;
    };
  }, [enabled]);
}