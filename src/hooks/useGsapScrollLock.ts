/**
 * Scroll lock untuk section "Cara Ikut": halaman ditahan di section itu, dan
 * scroll vertikal diterjemahkan menjadi garis progres horizontal yang terisi
 * penuh ke kanan. Baru setelah garisnya penuh, scroll dilepas ke section
 * berikutnya.
 *
 * Kenapa ScrollTrigger, bukan preventDefault() manual
 * -------------------------------------------------
 * `useSmoothScroll` sudah menjadi SATU-PENULIS posisi scroll: dia memasang
 * listener `wheel` non-passive, memanggil `preventDefault()`, lalu menulis
 * `window.scrollTo` per frame. Handler wheel kedua di halaman yang sama berarti
 * dua penulis scroll pada satu sumbu - itu persis getarannya yang sudah kita
 * perbaiki.
 *
 * ScrollTrigger tidak menambah penulis baru: dia hanya membaca posisi scroll
 * yang sudah native. Karena itu dia bisa memberi dua hal yang mustahil diberi
 * hooks manual:
 *
 *   1. RUNWAY. `pin: true` membungkus target dengan `pin-spacer` yang
 *      tingginya sama dengan jarak scroll tambahan. Tanpa itu tidak ada jarak
 *      scroll yang bisa dipakai untuk mengisi garis - section akan langsung
 *      lepas begitu wheel pertama dipakai.
 *   2. PIN yang benar. `position: fixed` selama di-pin, dilepas tepat di
 *      `end`, dan dihitung ulang saat resize. Ditulis tangan, detail-detail
 *      ini mudah salah tepat di ambang batas.
 *
 * Kenapa `scrub: true` dan bukan angka desimal
 * --------------------------------------------
 * Ini bukan soal rasa, tapi soal syarat yang diminta: "setelah garisnya terisi
 * penuh baru bisa scroll ke bawah".
 *
 * Pin dilepas pada `end`, yaitu pada satu posisi scroll TENTU. Kalau progress
 * digerakkan `scrub: 0.4`, progress mengejar posisi scroll dengan peredaman, jadi
 * di detik pin dilepas progress belum tentu 1 - diukur, baru 0.77. Garis masih
 * setengah jalan saat section-nya sudah lepas, jadi syarat "penuh dulu baru boleh
 * lanjut" tidak terpenuhi.
 *
 * Dengan `scrub: true` progress = posisi scroll, tanpa peredaman sama sekali.
 * Posisi scroll sendiri sudah diinterpolasi `useSmoothScroll`, jadi kelancaran
 * tidak hilang - hanya sekarang keduanya melekat: progress mencapai tepat 1 pada
 * bingkai yang sama dengan pin dilepas. Syarat terpenuhi persis.
 *
 * PENTING: modul di-`import()` dinamis, sama seperti three.js. Impor statis
 * `gsap` plus `gsap/ScrollTrigger` akan menambah sekitar 100 kB ke bundle
 * utama yang dibayar semua pengunjung ponsel, yang tidak pernah memakai
 * fitur ini.
 *
 * HARGA YANG DIBAYAR: SATU rAF PERMANEN
 * -------------------------------------
 * `ScrollTrigger` menjalankan `requestAnimationFrame` sendiri selama halaman
 * hidup, dan tidak ada API publik untuk menghentikannya. Dua sumbernya, keduanya
 * tidak menggambar apa pun:
 *
 *   - Ticker internal yang dinyalakan oleh `ScrollTrigger.enable()`. Badannya
 *     hanya "kalau flag hidup, minta bingkai lagi".
 *   - Penjaga `scrollEnd`, yang selalu menyisakan satu `requestAnimationFrame`
 *     terjadwal sehingga bisa mendeteksi bahwa gerakan scroll sudah berhenti.
 *     Dipanggil sekitar 2x per detik meski halaman diam total.
 *
 * Jadi di mode 'rich' satu rAF per bingkai itu memang ada. Yang tidak ada -
 * dan itu yang diuji `scripts/verify.mjs` - adalah loop gambar milik kita:
 * canvas hero dan armillary tetap berhenti total saat section-nya jauh.
 * Di mode 'simple'/'reduced' tidak ada rAF tambahan sama sekali, karena GSAP
 * tidak pernah diunduh di sana.
 */
import { useEffect, type MutableRefObject, type RefObject } from 'react';

export interface UseScrollLockTimelineOptions {
  sectionRef: RefObject<HTMLElement | null>;
  /** Garis progres; diisi lewat scaleX 0 -> 1. */
  fillRef: RefObject<HTMLElement | null>;
  /** Node langkah; dinyalakan berurutan saat garis terisi. */
  stepRefs: MutableRefObject<Array<HTMLElement | null>>;
  /** Hanya mode 'rich'. Selain itu: tanpa pin, tanpa lock, garis penuh. */
  enabled: boolean;
}

/**
 * Berapa banyak tinggi viewport yang dipakai sebagai runway, yaitu berapa
 * lama section ini menahan halaman sebelum dilepas.
 *
 * 2 berarti dua layar penuh: sekitar 4-6 detik dengan trackpad, cukup lama
 * untuk membaca tiap langkah tanpa bosan. Angka ini keputusan ritme, bukan
 * hasil pengukuran.
 */
const RUNWAY_SCREENS = 2;

/**
 * Redaman scrub. `true` = progress melekat pada posisi scroll, tanpa peredaman.
 * Angka desimal bikin progress tertinggal dari pin, dan itu merusak syarat
 * "penuh dulu baru boleh lanjut". Penjelasan lengkap di header file.
 */
const SCRUB = true;

export function useScrollLockTimeline({
  sectionRef,
  fillRef,
  stepRefs,
  enabled,
}: UseScrollLockTimelineOptions) {
  useEffect(() => {
    if (!enabled) return;
    const section = sectionRef.current;
    const fill = fillRef.current;
    if (!section || !fill) return;

    let disposed = false;
    let revert: (() => void) | null = null;

    const paint = (p: number) => {
      fill.style.transform = `scaleX(${p})`;
      const total = stepRefs.current.length;
      const reached = p * total;
      stepRefs.current.forEach((el, i) => {
        if (!el) return;
        const done = i < reached;
        el.classList.toggle('is-done', done);
        el.classList.toggle('is-current', !done && i === Math.floor(reached));
      });
    };

    /*
     * Tanpa JS sama sekali (reduced-motion, mode simple, JS gagal), garis HARUS
     * tampil penuh, dan itu memang keadaan default-nya: `fill` tidak punya
     * `transform` inline, jadi scaleX-nya 1.
     *
     * Karena itu di mode rich kita harus menulis scaleX(0) secara eksplisit
     * sebelum GSAP tiba - kalau tidak, garis berkedip penuh selama satu frame
     * lalu menyusut, persis kedipan yang dikeluhkan sebagai "kadang muncul".
     */
    paint(0);

    import('gsap')
      .then((gsapMod) => Promise.all([gsapMod, import('gsap/ScrollTrigger')]))
      .then(([gsapMod, stMod]) => {
        if (disposed) return;
        const gsap = gsapMod.gsap;
        const ScrollTrigger = stMod.ScrollTrigger;
        gsap.registerPlugin(ScrollTrigger);

        const state = { p: 0 };

        const ctx = gsap.context(() => {
          gsap.to(state, {
            p: 1,
            ease: 'none',
            onUpdate: () => paint(state.p),
            scrollTrigger: {
              trigger: section,
              // Mulai saat section mencapai puncak viewport.
              start: 'top top',
              // Runway: ruang scroll yang dipakai untuk mengisi garis.
              // Fungsi, bukan string, supaya dihitung ulang saat resize.
              end: () => '+=' + Math.round(window.innerHeight * RUNWAY_SCREENS),
              pin: true,
              pinSpacing: true,
              scrub: SCRUB,
              invalidateOnRefresh: true,
              // Menutup celah satu frame saat section akan mulai di-pin.
              anticipatePin: 1,
            },
          });
        }, section);

        revert = () => ctx.revert();
      })
      .catch((err) => {
        // Tanpa GSAP, section tetap utuh dan bisa dibaca. Garis ditampilkan
        // penuh supaya tidak ada langkah yang terlihat terkunci selamanya.
        console.warn('GSAP gagal dimuat, lock Cara Ikut dilewati:', err);
        paint(1);
      });

    return () => {
      disposed = true;
      revert?.();
      fill.style.transform = '';
      stepRefs.current.forEach((el) => {
        el?.classList.remove('is-done', 'is-current');
      });
    };
  }, [enabled, sectionRef, fillRef, stepRefs]);
}
