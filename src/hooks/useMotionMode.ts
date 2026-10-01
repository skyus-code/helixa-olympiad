/**
 * Mode gerak global - satu-satunya gerbang fitur mahal di situs ini.
 *
 * TIGA mode, bukan dua, dan urutannya penting karena tidak simetris.
 *
 *   'simple'   Perangkat atau preferensi tidak layak untuk WebGL.
 *              Gerak ringan boleh: fade, kinetic teks, scroll link.
 *              Yang DILARANG: kursor kustom, three.js, parallax mouse.
 *              Ornamen DnaHelix SVG dipakai sebagai fallback ringan.
 *
 *   'rich'     Semua kondisi terpenuhi: gerak diizinkan + pointer presisi +
 *              layar lebar. Hanya mode ini yang memuat three.js, kursor
 *              kustom, dan parallax mouse.
 *
 *   'reduced'  User minta reduced-motion, DAN perangkatnya memang mampu
 *              WebGL. Partikel DNA dan giroskop tetap dirender sebagai satu
 *              frame statis: terlihat, tapi diam. Tanpa kursor kustom,
 *              tanpa parallax, tanpa putaran.
 *
 * Kenapa perlu mode 'simple' terpisah dari 'reduced'
 * --------------------------------------------------
 * Dua konsumen fitur paling penting di revisi ini - hero partikel DNA dan
 * giroskop Aturan - masing-masing punya fallback wajib. Kalau gerbangnya hanya
 * `!reduce`, maka HP besar yang tidak memakai reduced-motion akan tetap menarik
 * dan menjalankan three.js, padahal itu persis perangkat yang paling boros
 * baterainya. Mode 'simple' memisahkan "user minta tidak ada gerak" dari
 * "perangkat ini memang tidak deserve WebGL", supaya keduanya punya jawaban
 * fallback yang berbeda.
 *
 * URUTAN PENENTUAN: perangkat dulu, baru preferensi gerak.
 *
 * Ini bukan pilihan gaya. Ini satu-satunya urutan yang membuat dua aturan dari
 * brief berlaku BERSAMAAN:
 *
 *   a) reduced-motion = satu frame statis, partikel tetap terlihat.
 *   b) mode 'simple' (HP/tablet) = three.js sama sekali tidak boleh terunduh.
 *
 * Aturan (a) dan (b) bertabrakan tepat pada satu kasus: ponsel yang juga
 * punya reduced-motion aktif. Kalau reduced-motion dicek lebih dulu, kasus itu
 * berakhir di mode 'reduced', yang berarti three.js ikut terunduh di ponsel -
 * melanggar (b) sekaligus melanggar syarat uji wajib "cek Network tab di
 * mobile". Kalau perangkat dicek lebih dulu, ponsel itu berakhir di 'simple'
 * dan (b) terpenuhi; gerak tetap mati di sana karena setiap komponen juga
 * membaca `useReducedMotion()` secara terpisah.
 *
 * Ringkasnya: (b) adalah aturan tentang JARINGAN dan DAYA BATERAI, jadi
 * menang atas (a) yang hanya mengatur KONTEN STATIS.
 *
 * Konsekuensi yang disengaja: di mode 'simple' partikel three.js tidak muncul,
 * bahkan ketika reduced-motion aktif. Yang tampil di sana adalah DnaHelix SVG
 * yang diam. Secara visual itu mendekati "satu frame statis" yang diminta,
 * tanpa biaya unduhan WebGL di ponsel.
 *
 * PENTING untuk bundle: mode 'simple' tidak boleh menarik three.js. Karena
 * three.js hanya diimpor lewat `import()` dinamis di dalam modul yang
 *-gerbang-nya mode 'rich', chunk itu tidak pernah terunduh di HP - bukan
 * sekadar tidak dieksekusi.
 */
import { useEffect, useState } from 'react';
import { MQ } from '../lib/motion';

export type MotionMode = 'reduced' | 'simple' | 'rich';

/**
 * Di luar React (mis. util yang dipanggil sekali) kita butuh nilai yang sama.
 *
 * Default 'simple' adalah pilihan yang paling aman: mode itu tidak pernah
 * mengaktifkan WebGL, tidak pernah membiarkan custom cursor, dan tidak pernah
 * menjalankan parallax. Ini penting untuk jalur SSR atau apa pun yang berjalan
 * sebelum hydration selesai.
 */
export function readMotionMode(): MotionMode {
  if (typeof window === 'undefined') return 'simple';
  // Perangkat dicek lebih dulu. Lihat catatan panjang di header file.
  if (!window.matchMedia(MQ.rich).matches) return 'simple';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'rich';
}

/**
 * Mode gerak sebagai state React, ber-abon ke perubahan query.
 *
 * State awal diambil dari `readMotionMode()` saat render pertama, bukan selalu
 * 'simple'. Kalau mulai dari 'simple' lalu dikoreksi di effect, perangkat yang
 * sebenarnya 'rich' akan berkedip: fallback SVG muncul sejenak, lalu WebGL
 * menggantikannya. Itu kedipan yang avoidable.
 */
export function useMotionMode(): MotionMode {
  const [mode, setMode] = useState<MotionMode>(readMotionMode);

  useEffect(() => {
    const queries = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia(MQ.rich),
    ];
    const update = () => setMode(readMotionMode());
    update();

    const offs = queries.map((q) => {
      if (typeof q.addEventListener === 'function') {
        q.addEventListener('change', update);
        return () => q.removeEventListener('change', update);
      }
      // Fallback Safari lama.
      const legacy = q as unknown as { addListener: (fn: () => void) => void };
      legacy.addListener(update);
      return () =>
        (q as unknown as { removeListener: (fn: () => void) => void }).removeListener(update);
    });

    return () => offs.forEach((off) => off());
  }, []);

  return mode;
}

/** Pintasan: bolehkah WebGL / three.js hidup? */
export function useRichMode(): boolean {
  return useMotionMode() === 'rich';
}

/** Pintasan: bolehkah kursor kustom hidup? */
export function useCursorMode(): boolean {
  return useMotionMode() === 'rich';
}