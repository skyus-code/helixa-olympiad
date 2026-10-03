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
 * tetap berarti, sticky tetap jalan, dan semua pembaca posisi scroll
 * (`useScrollProgress`, ScrollTrigger) tetap membaca angka yang benar. Kita
 * hanya menggeser posisi scroll itu lewat interpolasi, bukan lewat transform.
 *
 * Pola ini setara dengan Lenis, hanya dengan ticker GSAP sebagai clock-nya.
 *
 * ATURAN SATU-PENULIS
 * -------------------
 * Posisi scroll hanya boleh punya SATU penulis. Dua penulis = getaran, dan itu
 * penyebab halaman "bergetar ke atas bawah" seperti seret:
 *
 *   1. `wheel` harus NON-passive dan memanggil `preventDefault()`. Versi lama
 *      memasang listener secara `passive: true`, jadi browser tetap menjalankan
 *      scroll NATIF-nya: tiap putaran wheel, browser melompat `deltaY` seketika,
 *      sementara ticker menarik dari `current` yang masih di posisi lama. Dua
 *      gerak berlawanan di satu sumbu, dan besar getarannya bergantung pada
 *      timing frame.
 *   2. `scroll-behavior: smooth` di CSS harus MATI selama hook ini aktif (lihat
 *      `html[data-smooth-scroll='on']` di index.css). Kalau tidak, setiap
 *      `window.scrollTo` per-frame menjadi animasi browser sendiri yang
 *      dibatalkan lagi oleh tick berikutnya, 60x/detik.
 *
 * Yang TIDAK diambil alih: scrollbar, keyboard (spasi/panah/PageUp/PageDown),
 * find-in-page, dan scroll sentuh semuanya native. Listener `scroll` di bawah
 * memverifikasi ulang posisinya, jadi semua sumber itu tetap akurat.
 *
 * GERBANG
 * -------
 * Hanya mode 'rich'. Di 'simple' dan 'reduced' scroll dibiarkan native:
 *   - scroll sentuh: mengambil alih scroll sentuh merusak scroll momentum di
 *     iOS dan Android, dan momentum itu fitur, bukan efek;
 *   - reduced-motion: scroll halus adalah gerakan terus-menerus.
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

/**
 * Batas toleransi "ini echo dari kita sendiri", dalam piksel.
 *
 * `window.scrollTo` menerima angka pecahan, dan Chrome menyimpan offset scroll
 * dengan presisi 1/64 px, jadi selisih sekecil itu wajar terjadi. Angka 2
 * memberi ruang jauh di atas presisi itu tanpa menoleransi geseran yang
 * benar-benar datang dari sumber lain.
 */
const ECHO_TOLERANCE = 2;

/**
 * Batas jarak yang boleh ditempuh dalam SATU frame, sebagai fraksi tinggi
 * viewport.
 *
 * Lerp exponential selalu proportional terhadap sisa jarak, jadi saat target
 * jauh di depan - pengguna menggulir cepat, atau melompat lewat klik navbar -
 * satu frame bisa bergerak dua ratus piksel lebih. Diukurnya: lompatan
 * terbesar 233px, dan selisih antar-bingkai berturut-turut sampai 192px. Mata
 * membaca pola "kilat, diam, kilat" itu sebagai getaran, bukan gerakan halus.
 *
 * Di sini langkah per frame dibatasi. Efeknya: motion tetap mulus dan tidak
 * pernah meloncat, dan sisa catch-up dibagi ke frame-frame berikutnya.
 */
const MAX_STEP_FRAC = 0.35;

/**
 * Batas rasio frame yang dipakai untuk lerp. Lihat catatan panjang di `tick()`.
 *
 * 1.5 -> satu bingkai maksimal mengerjakan 1 - 0.9^1.5 = 14,6% sisa jarak.
 */
const MAX_RATIO = 1.5;

/**
 * Tinggi satu "baris" untuk wheel yang mengirim `deltaMode = 1` (sebagian
 * mouse wheel lama mengirim satuan baris, bukan piksel).
 */
const LINE_PX = 16;

/** Ubah delta wheel apa pun menjadi piksel. */
function pixelDelta(e: WheelEvent): number {
  if (e.deltaMode === 1) return e.deltaY * LINE_PX;
  if (e.deltaMode === 2) return e.deltaY * window.innerHeight;
  return e.deltaY;
}

/**
 * Interpolasi scroll untuk halaman utama.
 *
 * `onRoute` bernilai false mematikan hook ini sepenuhnya - bukan hanya
 * stopping, tapi semua effect langsung dilewati. Dipakai halaman form: satu
 * halaman yang isinya satu form, dengan sedikit baris yang bisa di-scroll, tidak
 * ada manfaat dari interpolasi yang harus menyela setiap roda mouse, dan ticker
 * GSAP yang terus berjalan selama form diisi adalah biaya yang tidak dibayar
 * oleh apa pun yang terlihat.
 *
 * Catatan urutan: pemanggil harus memanggil hook ini SESUDAH hook yang menulis
 * posisi scroll saat pindah halaman (`useHashRoute`). Effect dijalankan sesuai
 * urutan deklarasi, jadi itu menjamin perpindahan halaman selesai menulis
 * posisi dulu, baru ticker ini membaca `window.scrollY` sebagai keadaan awal -
 * kalau terbalik, form yang baru terbuka mulai di posisi scroll halaman lama.
 */
export function useSmoothScroll(onRoute = true) {
  const mode = useMotionMode();
  const enabled = onRoute && mode === 'rich';

  useEffect(() => {
    if (!enabled) return;

    const root = document.documentElement;
    // Mematikan `scroll-behavior: smooth` milik CSS. Lihat catatan
    // "ATURAN SATU-PENULIS" di header file.
    root.dataset.smoothScroll = 'on';

    let alive = true;
    let ticker: Ticker | null = null;
    let tickerFn: (() => void) | null = null;

    /** Posisi yang DIINGINKAN dicapai (dari wheel atau anchor), belum tampil. */
    let target = window.scrollY;
    /** Posisi yang benar-benar terlihat, sedang dikejar oleh ticker. */
    let current = target;
    /**
     * Posisi terakhir yang kita tulis sendiri lewat `window.scrollTo`.
     *
     * Tanpa ini, `onScroll` tidak bisa membedakan scroll yang kita tulis
     * sendiri dari scroll dari sumber lain, dan itu sumber getarannya.
     */
    let lastWritten = window.scrollY;
    let running = false;

    const maxScroll = () => Math.max(0, root.scrollHeight - window.innerHeight);
    const clamp = (v: number) => Math.min(maxScroll(), Math.max(0, v));
    const write = () => {
      lastWritten = current;
      window.scrollTo(0, current);
    };

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
        /*
         * Tanpa GSAP, ticker tidak pernah hidup - dan `preventDefault()` di
         * `onWheel` akan membuat halaman tidak bisa digulir sama sekali.
         * Jadi semua listener dicabut dan scroll dikembalikan ke native.
         * Degradasi yang aman, bukan error yang harus dilaporkan ke user.
         */
        console.warn('GSAP gagal dimuat, scroll dikembalikan ke native:', err);
        teardown();
      });

    function onWheel(e: WheelEvent) {
      if (e.ctrlKey) return; // pinch-zoom, biarkan browser
      /*
       * Panel menu mobile menahan scroll dengan `overflow: hidden` di body.
       * Kalau wheel tetap dicerna di sana, `target` menumpuk padahal
       * `window.scrollTo` tidak punya efek apa pun, dan begitu kunci dibuka
       * halaman melompat jauh tanpa diminta. Baris ini membiarkan browser
       * menangani wheel seperti biasa - di halaman yang terkunci, tidak ada
       * yang perlu digulir.
       */
      if (document.body.style.overflow === 'hidden') return;
      // Pencegahan di sini satu-satunya. Setelah baris ini browser TIDAK lagi
      // menulis posisi scroll, jadi ticker menjadi satu-satunya penulis.
      e.preventDefault();
      target = clamp(target + pixelDelta(e));
      start();
    }

    /*
     * Scroll dari luar wheel kita - scrollbar, keyboard, find in page, atau
     * scroll sentuh - membuat `target` meleset. Kalau tidak disinkronkan,
     * ticker akan menarik halaman kembali ke posisi lama dan melawan pengguna.
     *
     * Bandingkan dengan `lastWritten`, bukan dengan `current`. Ini perbaikan
     * sumber getarannya:
     *
     *   - `current` SELALU bergerak, karena ticker menulis posisi tiap frame,
     *     sementara event `scroll` yang dikirim browser adalah hasil dari
     *     frame-frame itu dan bisa sudah beberapa frame ke depan.
     *   - Membandingkan `y` dengan `current` berarti membandingkan dua angka
     *     dari waktu BERBEDA. Selisih kecil yang tidak sengaja muncul dibaca
     *     sebagai "scroll dari luar", loop dimatikan, lalu `onWheel`
     *     menyalakannya lagi. Gerakan jadi terputus-putus: bingkai diam,
     *     bingkai melompat, berulang.
     *   - `lastWritten` adalah angka yang benar-benar kita serahkan ke browser,
     *     jadi posisi yang cocok dengannya pasti echo dari kita sendiri dan
     *     tidak boleh mengganggu loop.
     *
     * Tidak butuh timer. Versi lama menunggu 140ms sebelum memeriksa, dan
     * selama penundaan itu ticker masih menulis posisi: dua penulis aktif
     * bersamaan persis di detik yang paling perlu dijaga.
     */
    function onScroll() {
      const y = window.scrollY;
      if (Math.abs(y - lastWritten) <= ECHO_TOLERANCE) return;
      target = y;
      current = y;
      lastWritten = y;
      stop();
    }

    /*
     * Anchor link (navbar, tombol CTA) ditangani di sini karena
     * `scroll-behavior: smooth` sengaja dimatikan - tanpa penanganan ini, klik
     * navbar akan melompat seketika, bukan meluncur. Jeda terhadap navbar
     * tetap dipatuhi lewat `scroll-margin-top` yang dipasang tiap section,
     * dan nilainya dibaca apa adanya di sini supaya CSS tetap satu sumber
     * kebenaran.
     */
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const origin = e.target as Element | null;
      if (!origin || typeof origin.closest !== 'function') return;
      const anchor = origin.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('#') || href.length < 2) return;
      let id: string;
      try {
        id = decodeURIComponent(href.slice(1));
      } catch {
        return;
      }
      const section = document.getElementById(id);
      if (!section) return; // hash tanpa target: biarkan browser yang menangani

      e.preventDefault();
      const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
      target = clamp(window.scrollY + section.getBoundingClientRect().top - margin);
      start();
    }

    function tick() {
      /*
       * Tinggi dokumen bisa berubah kapan saja (font, gambar, reveal, resize),
       * jadi `target` di-clamp ulang tiap frame. Tanpa ini, resize saat sedang
       * beranimasi bisa menyuruh browser scroll ke posisi yang sudah tidak ada.
       */
      target = clamp(target);
      const diff = target - current;
      if (Math.abs(diff) < 0.1) {
        // Snap lalu berhenti: sisa di bawah ~0.1px tidak terlihat, tapi menulis
        // posisi scroll terus-menerus tetap memaksa browser menghitung ulang
        // posisi, jadi loop dihentikan saja.
        current = target;
        write();
        stop();
        return;
      }
      /*
       * Lerp frame-rate independent lewat deltaRatio GSAP, TAPI diklem rapat.
       *
       * `deltaRatio` adalah "berapa lama frame ini dibanding frame 60fps", jadi
       * nilainya melonjak saat satu bingkai jatuh: layout berat, paint lama,
       * atau tab yang baru aktif kembali. Batas lama 8 berarti
       * `1 - 0.9^8` = 57% dari sisa jarak dikerjakan dalam SATU bingkai.
       *
       * Secara matematika itu memang "benar": jarak 500px yang harus ditempuh
       * dalam 8 bingkai memang harus dikejar lebih cepat per bingkai. Tapi
       * mata membaca berbeda - satu bingkai loncat ratusan piksel, bingkai
       * berikutnya kembali kecil, dan pola "kilat, kecil, kilat" itu dibaca
       * sebagai getaran. Diukurnya: inilah lompatan 290px di tengah
       * gerakan yang seharusnya lancar.
       *
       * Klem di 1.5 berarti satu bingkai maksimal mengerjakan 14,6% sisa
       * jarak, berapa pun lama bingkainya. Kelancaran antar-bingkai tetap
       * terjaga, dan bingkai yang hilang hanya membuat gerakan sedikit lebih
       * lambat - bukan melompat.
       */
      const ratio = Math.min(ticker?.deltaRatio() ?? 1, MAX_RATIO);
      current += diff * (1 - Math.pow(1 - LERP, ratio));
      // Batas langkah per frame: lihat catatan MAX_STEP_FRAC di atas.
      const maxStep = window.innerHeight * MAX_STEP_FRAC;
      const moved = current - lastWritten;
      if (moved > maxStep) current = lastWritten + maxStep;
      else if (moved < -maxStep) current = lastWritten - maxStep;
      write();
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

    function teardown() {
      alive = false;
      stop();
      delete root.dataset.smoothScroll;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick);
      // Sinkronkan posisi supaya tidak ada interpolasi yatim setelah unmount.
      target = window.scrollY;
      current = window.scrollY;
      lastWritten = window.scrollY;
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick);

    return teardown;
  }, [enabled]);
}
