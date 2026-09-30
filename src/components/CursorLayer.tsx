/**
 * Kursor kustom: cincin emas tipis yang mengikuti pointer, membesar saat
 * berada di atas elemen interaktif.
 *
 * Tiga lapis keamanan (kursor kustom adalah fitur yang paling mudah merusak
 * situs kalau salah):
 *
 *  1. HANYA di pointer presisi DAN layar lebar (>=1024px). Di layar sentuh
 *     tidak ada kursor untuk disembunyikan; memaksa `cursor: none` di sana
 *     membuat pengguna kehilangan penanda sentuh sama sekali.
 *  2. HANYA saat reduced-motion tidak aktif. Cincin yang mengejar kursor
 *     adalah gerakan terus-menerus.
 *  3. Dirender lewat portal ke <body> dengan `position: fixed` dan
 *     `pointer-events: none`, sehingga tidak pernah menjadi blocker klik
 *     maupun ikut ter-scroll bersama dokumen.
 *
 * Tanpa GSAP: dot diletakkan tepat di pointer lewat transform langsung;
 * cincin mengejar pointer lewat lerp eksponensial di rAF (frame-rate
 * independent, faktor dihitung dari delta waktu). Ukuran cincin & margin
 * negatif bertransisi CSS, jadi pusat cincin tetap di pointer saat membesar.
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'motion/react';
import { DUR, MQ } from '../lib/motion';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { subscribeHoverState } from '../hooks/useMagnetic';

export function CursorLayer() {
  const fineWide = useMediaQuery(MQ.motionFineWide);
  const reduce = useReducedMotion();
  // Gerbang dirender, bukan hanya dicek di dalam effect: layer yang tidak
  // aktif tidak boleh ada sama sekali di DOM. Selain hemat kerja, ini
  // menutup celah nyata — cincin yang menganggur di titik (0,0) memakai margin
  // negatif agar berpusat di pointer, jadi kotakunya bergeser keluar viewport.
  const active = fineWide && !reduce;

  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    const html = document.documentElement;
    if (!dot || !ring) return;

    const fineWide = window.matchMedia(MQ.motionFineWide);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    let raf = 0;
    let running = false;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let rx = tx;
    let ry = ty;
    let last = 0;
    // Titik juga mulai di tengah viewport, bukan di pojok (0,0) — sebelum
    // pointer pertama bergerak, kotak 6px-nya akan menempel tepi kiri atas.
    dot.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;

    // Lerp eksponensial dengan konstanta waktu DUR.cursorTau.
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const k = 1 - Math.exp(-dt / DUR.cursorTau);
      rx += (tx - rx) * k;
      ry += (ty - ry) * k;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    const off = () => {
      if (!running) return;
      running = false;
      html.removeAttribute('data-custom-cursor');
      html.setAttribute('data-cursor-visible', 'false');
      cancelAnimationFrame(raf);
    };

    const on = () => {
      if (running) return;
      if (!fineWide.matches || reduce.matches) return;
      running = true;
      html.setAttribute('data-custom-cursor', 'on');
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      tx = e.clientX;
      ty = e.clientY;
      if (running) html.setAttribute('data-cursor-visible', 'true');
    };

    // Saat pointer meninggalkan jendela, sembunyikan kedua lapisan.
    const onDocLeave = () => html.setAttribute('data-cursor-visible', 'false');
    const onDocEnter = () => {
      if (running) html.setAttribute('data-cursor-visible', 'true');
    };

    const unsubHover = subscribeHoverState((active) => {
      html.toggleAttribute('data-cursor-hover', active);
    });

    const onDown = () => html.setAttribute('data-cursor-pressed', 'true');
    const onUp = () => html.removeAttribute('data-cursor-pressed');

    const fineWideChanged = () => {
      if (fineWide.matches && !reduce.matches) on();
      else off();
    };
    const reduceChanged = () => {
      if (reduce.matches) {
        off();
        // Cadangan: kursor sistem kembali walau atribut lama masih menempel.
        html.removeAttribute('data-custom-cursor');
      } else {
        on();
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseleave', onDocLeave);
    document.addEventListener('mouseenter', onDocEnter);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    fineWide.addEventListener('change', fineWideChanged);
    reduce.addEventListener('change', reduceChanged);
    on();

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseleave', onDocLeave);
      document.removeEventListener('mouseenter', onDocEnter);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      fineWide.removeEventListener('change', fineWideChanged);
      reduce.removeEventListener('change', reduceChanged);
      unsubHover();
      html.removeAttribute('data-custom-cursor');
      html.removeAttribute('data-cursor-visible');
      html.removeAttribute('data-cursor-hover');
      html.removeAttribute('data-cursor-pressed');
      cancelAnimationFrame(raf);
    };
  }, [active]);

  if (!active) return null;

  return createPortal(
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true">
        <div className="cursor-ring__core" />
      </div>
    </>,
    document.body,
  );
}