import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

type RevealProps = {
  children: ReactNode;
  /** Jeda dalam milidetik untuk stagger di dalam grid. */
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'article' | 'section' | 'header' | 'footer';
};

/**
 * Scroll reveal: fade-in + naik 24px saat elemen masuk viewport.
 * Threshold 0.15, durasi 700ms, easing cubic-bezier(0.22, 1, 0.36, 1), sekali saja.
 * Bila `prefers-reduced-motion`, konten langsung tampil tanpa transisi.
 */
export function Reveal({ children, delay = 0, className = '', as = 'div' }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect(); // sekali saja
          }
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  const Tag = as;

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${className}`}
      data-visible={visible}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
