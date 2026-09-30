/**
 * Reveal saat scroll — pengganti ScrollTrigger berbasis IntersectionObserver.
 *
 * Satu-satunya pekerjaan JS: menandai elemen dengan kelas ketikan elemen
 * memasuki viewport. Animasi itu sendiri (fade + naik 24px) ditulis di CSS.
 * Kelas hanya dipasang kalau `prefers-reduced-motion: no-preference` cocok,
 * jadi pengguna reduced-motion (dan pengunjung tanpa JS) melihat konten
 * langsung, tanpa state tersembunyi.
 *
 * `RevealGroup`: container yang anak-anaknya muncul berurutan (stagger 80ms,
 * diatur CSS lewat nth-child). Karena itu anak container HARUS satu level:
 * untuk daftar, pakai `as="ol"`/`as="ul"` dan jadikan item sebagai anak.
 */
import { useRef, type ElementType, type ReactNode } from 'react';
import { MQ } from '../../lib/motion';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useIsoLayoutEffect } from '../../hooks/useIsoLayoutEffect';

/*
 * Satu IntersectionObserver dipakai bersama untuk semua elemen reveal.
 * Versi sebelumnya membuat satu observer per elemen; dengan ~20 elemen itu
 * berarti 20 observer yang masing-masing punya daftar target sendiri dan
 * dipanggil pada setiap layout — biaya yang tidak terlihat di kode tapi
 *measurable di main thread saat load.
 */
let shared: IntersectionObserver | null = null;

function observer() {
  if (shared) return shared;
  shared = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).classList.add('is-in-view');
        shared?.unobserve(e.target);
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -12% 0px' },
  );
  return shared;
}

function watch(el: HTMLElement) {
  observer().observe(el);
}

function unwatch(el: HTMLElement) {
  shared?.unobserve(el);
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** `y` = fade + naik 24px. `x` = garis yang membesar horizontal (scaleX). */
  variant?: 'y' | 'x';
  delay?: number;
  as?: ElementType;
};

export function Reveal({
  children,
  className = '',
  variant = 'y',
  delay = 0,
  as: Tag = 'div',
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const motionOk = useMediaQuery(MQ.motion);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('reveal', 'reveal-x', 'is-in-view');
    if (!motionOk) return;
    el.classList.add(variant === 'x' ? 'reveal-x' : 'reveal');
    if (!('IntersectionObserver' in window)) {
      el.classList.add('is-in-view');
      return;
    }
    watch(el);
    return () => unwatch(el);
  }, [motionOk, variant]);

  return (
    <Tag
      ref={ref as never}
      className={className}
      style={delay > 0 ? { transitionDelay: delay + 's' } : undefined}
    >
      {children}
    </Tag>
  );
}

type RevealGroupProps = {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ol' | 'ul';
  /** Atribut HTML ekstra, mis. `data-js` untuk penanda akordeon FAQ. */
  htmlAttrs?: Record<string, string>;
};

export function RevealGroup({
  children,
  className = '',
  as: Tag = 'div',
  htmlAttrs,
}: RevealGroupProps) {
  const ref = useRef<HTMLElement | null>(null);
  const motionOk = useMediaQuery(MQ.motion);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('reveal-group', 'is-in-view');
    if (!motionOk) return;
    el.classList.add('reveal-group');
    if (!('IntersectionObserver' in window)) {
      el.classList.add('is-in-view');
      return;
    }
    watch(el);
    return () => unwatch(el);
  }, [motionOk]);

  return (
    <Tag ref={ref as never} className={className} {...htmlAttrs}>
      {children}
    </Tag>
  );
}