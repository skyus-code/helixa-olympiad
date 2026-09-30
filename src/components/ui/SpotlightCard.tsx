import { useRef, type ReactNode } from 'react';
import { registerHoverTarget } from '../../hooks/useMagnetic';
import { useIsoLayoutEffect } from '../../hooks/useIsoLayoutEffect';

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'article';
  /** Radians spotlight dalam piksel. */
  radius?: number;
};

/**
 * Kartu dengan spotlight emas yang mengikuti kursor.
 *
 * Koordinat kursor ditulis ke dua custom property, `--mx` dan `--my`, lalu
 * dipakai gradient di CSS. Custom property dipilih supaya tidak ada
 * re-render React per pointermove: hanya style pada satu elemen yang berubah,
 * dan painter browser cukup menggambar ulang gradient.
 *
 * Di layar sentuh tidak ada pointermove, sehingga spotlight tidak pernah
 * menyala; CSS juga menyembunyikannya lewat `opacity: 0` sampai hover.
 */
export function SpotlightCard({
  children,
  className = '',
  as: Tag = 'div',
  radius = 260,
}: SpotlightCardProps) {
  const ref = useRef<HTMLElement | null>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    /*
     * Rect diukur lazy lalu ditandai basi saat scroll/resize — bukan dikoreksi
     * dengan delta scroll. Kartu berada di dalam section `position: sticky`
     * yang berhenti bergerak ketika ter-pin, jadi koreksi delta akan membuat
     * cached rect melenceng tepat di section yang sedang aktif.
     *
     * Mengukur ulang pada setiap `pointermove` juga dihindari: itu satu layout
     * sinkron per event pointer, padahal spotlight menulis `--mx/--my` tepat
     * sesudahnya — jadi halaman dipaksa layout ulang hanya karena kursor
     * bergerak di atas kartu. Pengukuran ulang dijadwalkan per frame.
     */
    let rect: DOMRect | null = null;
    let stale = true;
    let raf = 0;
    const measure = () => {
      rect = el.getBoundingClientRect();
      stale = false;
    };
    const invalidate = () => {
      stale = true;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    const onMove = (e: PointerEvent) => {
      if (!rect || stale) measure();
      if (!rect) return;
      el.style.setProperty('--mx', e.clientX - rect.left + 'px');
      el.style.setProperty('--my', e.clientY - rect.top + 'px');
    };

    el.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', invalidate, { passive: true });
    window.addEventListener('resize', invalidate, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', invalidate);
      window.removeEventListener('resize', invalidate);
    };
  }, []);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return registerHoverTarget(el);
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={'spotlight-card rounded-2xl border border-gold-line bg-surface ' + className}
      data-spotlight-card=""
      style={{ ['--spotlight-radius' as string]: radius + 'px' }}
    >
      {children}
    </Tag>
  );
}
