import { useRef, type ReactNode } from 'react';
import { registerHoverTarget } from '../../hooks/useMagnetic';
import { useIsoLayoutEffect } from '../../hooks/useGsapMedia';

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
 * menyala; CSS juga menyembunyikkannya lewat `opacity: 0` sampai hover.
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

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mx', e.clientX - rect.left + 'px');
      el.style.setProperty('--my', e.clientY - rect.top + 'px');
    };

    el.addEventListener('pointermove', onMove, { passive: true });
    return () => el.removeEventListener('pointermove', onMove);
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
