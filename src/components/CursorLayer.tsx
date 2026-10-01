/**
 * Kursor kustom: DOT MEMIMPIN, RING MENGEJAR.
 *
 * Dua elemen CSS terpisah, bukan karakter atau emoji (emoji forbidden di brief
 * ini, dan emoji juga tidak punya ukuran yang bisa dikendalikan):
 *
 *   dot   - lingkaran padat 6px, emas terang #F6E7B4. Transform-nya ditulis
 *           LANGSUNG di handler pointermove, tanpa delay, tanpa interpolasi.
 *           Ini titik kebenaran; semua yang lain mengikutinya.
 *   ring  - lingkaran berongga 28px, border emas #D4AF37. Target-nya SELALU
 *           posisi dot SAAT INI, bukan posisi mouse mentah. Karena targetnya
 *           selalu bergerak dan jaraknya tidak pernah nol dalam beberapa
 *           frame, begitu mouse berhenti cincin tetap menyusul sampai
 *           menyatu. Itulah yang membuat efeknya terbaca sebagai "mengejar",
 *           bukan menempel.
 *
 * Kenapa lerp eksponensial di rAF dan bukan `motion`'s useSpring:
 * `useSpring` menulis nilainya lewat render cycle React. Untuk nilai yang
 * harus berubah pada frekuensi pointermove yang bisa jauh di atas 60 Hz,
 * menulis transform lewat spring akan menyerialkan update melalui React.
 * Lerp di dalam satu rAF menambah satu write transform per frame saja,
 * berapa pun LEGAL event mouse yang datang. Ping di sini adalah critical
 * path; interaksi tidak boleh antre di balik render.
 *
 * Lerp eksponensial (bukan `rx += (tx - rx) * 0.2`) dipilih karena
 * konstantanya adalah KONSTAN WAKTU: `DUR.cursorTau` detik, apa pun
 * framerate-nya. Kalau faktor per-frame tetap, cincin bergerak 2x lebih cepat
 * di layar 120 Hz dan tertinggal di layar 30 Hz - keduanya terasa salah.
 *
 * Tiga lapis keamanan (kursor kustom adalah fitur yang paling mudah merusak
 * situs kalau salah):
 *
 *  1. HANYA di pointer presisi (`hover: hover` + `pointer: fine`). Di layar
 *     sentuh tidak ada kursor untuk disembunyikan; memaksa `cursor: none` di
 *     sana membuat pengguna kehilangan penanda sentuh sama sekali.
 *  2. HANYA saat reduced-motion tidak aktif. Cincin yang mengejar kursor adalah
 *     gerakan terus-menerus.
 *  3. Dirender lewat portal ke <body> dengan `position: fixed`, `pointer-events:
 *     none`, dan z-index maksimum, sehingga tidak pernah jadi blocker klik,
 *     tidak ikut ter-scroll, dan tidak bisa tertutup section mana pun.
 *
 * PENTING soal z-index: semua section memakai z-index 10-80 dan
 * `.hero-scrim` memakai angka lebih tinggi lagi. Elemen `position: fixed`
 * tanpa z-index tergambar DI BAWAH semua elemen ber-z-index positif, artinya
 * kursor "ada" tapi tidak terlihat - dan karena `cursor: none` aktif bersamaan,
 * pengguna kehilangan penandanya seluruhnya. z-index eksplisit menutup celah
 * itu, dan ini sempat menjadi bug nyata di revisi sebelumnya.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DUR, MQ } from '../lib/motion';
import { subscribeHoverState } from '../hooks/useMagnetic';

/**
 * Gerbang render kursor: pointer presisi DAN reduced-motion tidak aktif.
 *
 * Sengaja dihitung langsung (bukan via `useRef`) supaya render pertama sudah
 * tahu jawabannya. Kalau dimulai dari `false` lalu dikoreksi di effect, ada
 * satu frame di mana `cursor: none` sudah aktif di CSS tapi elemen kursor belum
 * ada - persis kondisi "kursor hilang total" yang harus dihindari.
 */
function useCursorActive(): boolean {
  const compute = () =>
    typeof window !== 'undefined' &&
    window.matchMedia(MQ.motionFine).matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [active, setActive] = useState(compute);

  useEffect(() => {
    const fine = window.matchMedia(MQ.motionFine);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setActive(fine.matches && !reduce.matches);
    update();
    fine.addEventListener('change', update);
    reduce.addEventListener('change', update);
    return () => {
      fine.removeEventListener('change', update);
      reduce.removeEventListener('change', update);
    };
  }, []);

  return active;
}

export function CursorLayer() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const active = useCursorActive();

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    const html = document.documentElement;
    if (!dot || !ring) return;

    const fine = window.matchMedia(MQ.motionFine);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    let raf = 0;
    let running = false;
    // Titik dan cincin mulai di tengah viewport, bukan di pojok (0,0): sebelum
    // pointer pertama bergerak, kotak 6px-nya akan menempel tepi kiri atas.
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let rx = tx;
    let ry = ty;
    let last = 0;

    // Dot: transform langsung di handler, di luar rAF. Tidak ada interpolasi.
    dot.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;

    // Ring juga perlu posisi awal yang tertulis sekarang. Loop interpolasi
    // sengaja tidak dinyalakan sampai pointermove pertama, jadi tanpa baris ini
    // cincin akan duduk di posisi CSS default (left:0 + margin -14 = -14px,
    // pojok kiri atas) sampai gerakan pertama - dan `audit.mjs` akan menandainya
    // sebagai elemen yang keluar viewport.
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;

    // Ring: satu-satunya penulis per frame, LERP menuju posisi dot SAAT INI.
    //
    // Loop ini BERHENTI sendiri begitu cincin menyatu dengan dot, dan dinyalakan
    // lagi oleh pointermove berikutnya. Versi sebelumnya selalu menjadwalkan
    // frame berikutnya tanpa syarat, jadi begitu pointer dipakai sekali, rAF
    // menyala terus sampai halaman ditutup - termasuk saat user sedang membaca
    // dan mouse-nya diam. Itu loop ketiga yang berjalan permanen di mode rich,
    // padahal governance repo ini hanya mengizinkan dua (partikel hero dan
    // giroskop Aturan), dan kursor bukan salah satunya.
    //
    // Pola ini aman: ketika cincin sudah di dalam 0.05px dari target, tidak ada
    // apa pun yang perlu dianimasikan. Pointer berikutnya memanggil onMove, yang
    // menyalakan loop lagi.
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      // Lerp eksponensial frame-rate independent, konstanta waktu
      // DUR.cursorTau detik, yang diset ~0.4s sesuai permintaan.
      const k = 1 - Math.exp(-dt / DUR.cursorTau);
      rx += (tx - rx) * k;
      ry += (ty - ry) * k;

      if (Math.abs(tx - rx) < 0.05 && Math.abs(ty - ry) < 0.05) {
        // Snap akhir lalu berhenti. Menulis transform yang identik dengan
        // sebelumnya memaksa browser menghitung ulang compositing tanpa
        // mengubah apa pun yang terlihat, jadi di sini kita berhenti saja.
        rx = tx;
        ry = ty;
        ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
        return;
      }
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    /** Nyalakan loop interpolasi kalau belum ada frame yang terjadwal. */
    const ensureTicking = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const off = () => {
      if (!running) return;
      running = false;
      html.removeAttribute('data-custom-cursor');
      html.setAttribute('data-cursor-visible', 'false');
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const on = () => {
      if (running) return;
      if (!fine.matches || reduce.matches) return;
      running = true;
      html.setAttribute('data-custom-cursor', 'on');
      // Loop sengaja TIDAK dinyalakan di sini: cincin baru dibuat tepat di
      // target, jadi tidak ada yang perlu dianimasikan. Yang pertama kali
      // menggerakkan kursor adalah pointermove pertama.
    };

    const onMove = (e: PointerEvent) => {
      // Dot: posisi diset langsung di handler, tanpa delay dan tanpa rAF.
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      // Cincin hanya menyimpan TARGET; pergerakan tetap di tick.
      tx = e.clientX;
      ty = e.clientY;
      // Each mover memicu interpolasi, baik mode aktif maupun belum (misal
      // pointer bergerak sebelum media query fine-pointer selesai dievaluasi).
      if (running) {
        html.setAttribute('data-cursor-visible', 'true');
        ensureTicking();
      }
    };

    // Saat pointer meninggalkan jendela, sembunyikan kedua lapisan.
    const onDocLeave = () => html.setAttribute('data-cursor-visible', 'false');
    const onDocEnter = () => {
      if (running) html.setAttribute('data-cursor-visible', 'true');
    };

    const unsubHover = subscribeHoverState((isHovering) => {
      html.toggleAttribute('data-cursor-hover', isHovering);
    });

    const onDown = () => html.setAttribute('data-cursor-pressed', 'true');
    const onUp = () => html.removeAttribute('data-cursor-pressed');

    const fineChanged = () => {
      if (fine.matches && !reduce.matches) on();
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
    fine.addEventListener('change', fineChanged);
    reduce.addEventListener('change', reduceChanged);
    on();

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseleave', onDocLeave);
      document.removeEventListener('mouseenter', onDocEnter);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      fine.removeEventListener('change', fineChanged);
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