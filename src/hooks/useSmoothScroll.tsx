/**
 * Smooth scroll — Lenis disinkronkan ke ticker GSAP.
 *
 * Prinsip: Lenis diberi `autoRaf: false` sehingga TIDAK menjalankan rAF
 * sendiri. Satu-satunya loop yang hidup adalah `gsap.ticker`, dan di situ
 * Lenis ikut di-pump. Kalau masing-masing punya rAF sendiri, keduanya bisa
 * membaca waktu frame yang sedikit berbeda, dan ScrollTrigger akan selalu
 * "terlambat" satu frame dari posisi scroll yang tampil — hasil yang persis
 * ingin kita hindari: gerakan cepat dan bergetar (jittery).
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from '../lib/gsap';
import { MQ } from '../lib/motion';

type SmoothScrollValue = {
  /** Instance Lenis, atau null ketika reduced-motion / belum siap. */
  lenis: Lenis | null;
  /** Scroll mulus aktif? Kalau false, browser memakai scroll native. */
  active: boolean;
};

const SmoothScrollContext = createContext<SmoothScrollValue>({
  lenis: null,
  active: false,
});

export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SmoothScrollValue>({ lenis: null, active: false });

  useEffect(() => {
    // Reduced motion: jangan sentuh scroll sama sekali. Scroll native justru
    // lebih nyaman untuk pengguna yang Turn off of animasi, dan Lenis
    // memaksa browser mengambil alih gesture.
    if (!window.matchMedia(MQ.motion).matches) {
      setState({ lenis: null, active: false });
      return;
    }

    const lenis = new Lenis({
      // Dikendalikan manual oleh gsap.ticker (lihat catatan di atas).
      autoRaf: false,
      // Inersia halus: 0.075 terlalu "berat", 0.1 mulai terasa seperti delay.
      lerp: 0.1,
      // Anchor `#tentang` ikut dismooth — tanpa ini, klik navbar terasa
      // loncat lalu diam.
      anchors: true,
      // Jangan smooth di dalam elemen yang memang harus bisa di-scroll sendiri.
      prevent: (node) => node.hasAttribute('data-lenis-prevent'),
      // Ponsel: felt native lebih penting daripada inersia.
      smoothWheel: true,
      syncTouch: false,
      autoResize: true,
    });

    // ScrollTrigger harus tahu posisi scroll Lenis setiap frame.
    const onScroll = () => ScrollTrigger.update();
    lenis.on('scroll', onScroll);

    // Satu loop untuk semua: waktu dari GSAP -> Lenis, dan ScrollTrigger
    // membaca dari callback di atas.
    const tick = (time: number) => {
      // gsap.ticker memberi satuan detik; Lenis.raf meminta milidetik.
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);

    // Tanpa ini, GSAP "menyesuaikan" waktu saat tab sempat tersendat, dan
    // Lenis + ScrollTrigger akan saling menyimpang.
    gsap.ticker.lagSmoothing(0);

    ScrollTrigger.refresh();

    setState({ lenis, active: true });

    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.off('scroll', onScroll);
      lenis.destroy();
      setState({ lenis: null, active: false });
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return <SmoothScrollContext.Provider value={value}>{children}</SmoothScrollContext.Provider>;
}
