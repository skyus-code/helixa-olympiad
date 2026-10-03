/**
 * Routing halaman tanpa router.
 *
 * Kenapa tidak pakai react-router: situs ini static SPA tanpa rewrite server.
 * Path asli seperti `/pendaftaran` akan 404 begitu halaman itu di-refresh atau
 * dibuka dari bookmark, dan menambahkan router berarti menambah dependency ke
 * bundle utama yang dibayar semua pengunjung, termasuk ponsel yang tidak pernah
 * menyentuh halaman form.
 *
 * Yang dipakai cukup satu pertanyaan: hash sekarang menunjuk halaman mana.
 * Semua tautan section yang sudah ada (`#tentang`, `#aturan`, `#faq`) tetap
 * bekerja persis seperti sebelumnya, karena keduanya membaca hash yang sama.
 *
 * SYARAT YANG WAJIB DIPERHATIKAN: HASH ROUTE TIDAK BOLEH SAMA DENGAN ID SECTION
 * ----------------------------------------------------------------------------
 * Aturan ini bukan preferensi gaya. `./useSmoothScroll` memasang listener click
 * yang mencari `document.getElementById(href)`; kalau hash itu milik section
 * landing, hook itu `preventDefault()` lalu menganimasikan scroll ke sana, dan
 * `hashchange` TIDAK PERNAH terjadi - jadi route tidak berganti sama sekali.
 *
 * Gejalanya sangat menyesatkan karena kelihatannya seperti navigasi yang gagal:
 * halaman justru tergulir ke section tujuan, tombol terasa dipanggang, dan
 * URL tetap seperti semula. Bug ini ditemukan pada percobaan pertama: hash
 * `#daftar` bentrok dengan `<Section id="daftar">` di ClosingCta, sehingga klik
 * tombol Daftar hanya menggulir halaman.
 *
 * Pemeriksaannya statis dan ada di `scripts/verify-daftar.mjs`, bukan di sini:
 * daftar id section landing tidak bisa diketahui dari file ini tanpa mengimpor
 * semua komponen, dan pemeriksaan yang perlu mengimpor segalanya hampir selalu
 * berakhir jadi pemeriksaan yang tidak pernah dijalankan.
 */
import { useEffect, useState } from 'react';
import { REGISTRATION } from '../content';

/** Nama route di dalam aplikasi. Tidak sama dengan hash di URL. */
export type RouteName = 'landing' | 'daftar';

/**
 * Peta hash -> route.
 *
 * Sengaja hanya satu entri. Menambah halaman kedua nanti cukup satu baris,
 * tapi sampai itu terjadi tidak ada kerangka router yang lebih besar dari ini
 * yang perlu dirawat.
 *
 * Nilainya harus berbeda dari setiap `id` section di landing page. Syarat dan
 * bukti kasus yang terjadi ada di header file.
 */
const ROUTES: Record<string, RouteName> = {
  pendaftaran: 'daftar',
};

/** Hash tanpa tanda `#`, sudah di-decode. String mentah kalau gagal decode. */
function currentHashId(): string {
  if (typeof window === 'undefined') return '';
  const raw = window.location.hash.replace(/^#/, '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Apa yang sedang ditampilkan, plus hash yang membawanya ke sana.
 *
 * Hash disimpan terpisah dari route karena keduanya tidak lagi sama: tautan
 * "lompat ke field yang salah" di halaman form memakai hash seperti
 * `#daftar-nama`, dan itu harus MENGGESER halaman form, bukan mengganti
 * halaman form dengan landing page. Kalau route dihitung ulang dari hash
 * setiap kali, satu klik ke ringkasan error akan membuang semua isian user.
 */
interface View {
  route: RouteName;
  hash: string;
}

function initialView(): View {
  const hash = currentHashId();
  return { route: ROUTES[hash] ?? 'landing', hash };
}

let landingTitle: string | null = null;

/**
 * Efek samping perpindahan halaman: judul dokumen dan posisi scroll.
 *
 * Ini effect yang HAFAS untuk berada di hook, bukan satu blok `if` di dalam
 * komponen: begitu tampilan berubah, dua hal di dunia luar harus ikut berubah -
 * dan pengembalian "benar kalau layar showing halaman yang benar" hanya bisa
 * dibuktikan dari sini, bukan dari UI.
 *
 * Kedudukan pemanggilan hook ini di `App.tsx` juga bukan gaya penulisan:
 * efek berjalan sesuai urutan deklarasi, dan efek inilah yang menulis posisi
 * scroll. Kalau dipanggil setelah `useSmoothScroll`, hook kedua akan membaca
 * `window.scrollY` lama sebagai keadaan awal ticker-nya.
 */
export function useHashRoute(): RouteName {
  /*
   * Dibaca saat render pertama, bukan selalu 'landing'. Kalau mulai dari
   * 'landing' lalu dikoreksi di effect, pengunjung yang membuka `#pendaftaran`
   * akan melihat landing page berkedip dulu selama satu frame.
   */
  const [view, setView] = useState<View>(initialView);

  useEffect(() => {
    const onHash = () => {
      const hash = currentHashId();
      const asRoute = ROUTES[hash];
      if (asRoute) {
        setView({ route: asRoute, hash });
        return;
      }
      /*
       * Hash yang bukan route berarti dua kemungkinan, dan keduanya harus
       * dibedakan dengan cara yang tidak perlu daftar id:
       *
       *   1. Anchor internal halaman yang sedang tampil (`#daftar-nama` dari
       *      ringkasan error). Elemennya ADA di DOM sekarang, jadi ini geser
       *      halaman yang sama - route tidak boleh berubah.
       *   2. Pindah halaman lewat anchor landing (`#tentang`, `#aturan`) dari
       *      halaman form. Section landing TIDAK ada di DOM sekarang - lagi
       *      karena halaman form menggantikannya, bukan disembunyikan di
       *      belakang - jadi ini benar-benar permintaan pindah halaman.
       *
       * Menguji keberadaan elemen lebih murah dan lebih tahan banting daripada
       * menyimpan daftar id landing: menambah section baru tidak boleh
       * membuat daftar itu basi.
       */
      if (hash && document.getElementById(hash)) {
        setView((v) => (v.route === 'daftar' ? { route: v.route, hash } : v));
        return;
      }
      setView({ route: 'landing', hash });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const { route, hash } = view;

  useEffect(() => {
    if (landingTitle === null) landingTitle = document.title;
    document.title = route === 'daftar' ? REGISTRATION.pageTitle : landingTitle;

    /*
     * POSISI SCROLL
     * ------------
     * Ditulis langsung, bukan lewat smooth scroll, karena perpindahan halaman
     * harus terasa seperti pindah halaman: posisi lama tidak mungkin terbawa.
     *
     * `scroll-behavior` CSS dimatikan sementara di sini. Kalau dibiarkan
     * `smooth`, `window.scrollTo` jadi animasi milik browser dan halaman
     * meluncur dari posisi section terakhir - yang justru terlihat seperti
     * bug, karena user menekan tombol dan halaman bergerak jauh sebelum konten
     * berganti.
     *
     * Restore dilakukan di frame yang sama, jadi atribut `data-smooth-scroll`
     * milik useSmoothScroll tetap pegang kendali begitu halaman utama tampil
     * lagi.
     */
    /*
     * Hash yang bernama route TIDAK pernah jadi target scroll: `#pendaftaran`
     * adalah perintah "tampilkan halaman form", bukan "geser ke elemen itu".
     * Membawanya ke `getElementById` akan menggulir ke section yang kebetulan
     * nama itu memakai punya - atau ke apa pun yang memakai nama itu di
     * kemudian hari.
     */
    const anchorId = ROUTES[hash] ? '' : hash;

    const write = () => {
      const root = document.documentElement;
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      const target = anchorId ? document.getElementById(anchorId) : null;
      let top = 0;
      if (target) {
        const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
        top = Math.max(0, Math.round(target.getBoundingClientRect().top + window.scrollY - margin));
      }
      window.scrollTo(0, top);
      root.style.scrollBehavior = previous;
      return top;
    };

    let expected = write();

    /*
     * PENEGAKAN ULANG POSISI
     * ----------------------
     * Posisi yang ditulis di atas benar PADA SAAT ITU, tapi belum tentu benar
     * beberapa detik kemudian - dan itu bukan tebakan, itu terukur:
     *
     *   atas `#aturan` di 3970px, tinggi dokumen 6496px -> `#aturan` tepat di
     *   88px dari atas viewport (scrollMarginTop), yaitu persis yang diminta.
     *   2,7 detik kemudian tinggi dokumen 8296px dan posisi `#aturan` 5770px:
     *   +1800px tepat di atas section, padahal tidak ada yang digulir.
     *
     * 1800px itu bukan tebakan juga: section "Cara Ikut" memakai ScrollTrigger
     * `pin` + `pinSpacing` dengan runway 2 layar (900 x 2). `pin-spacer` itu baru
     * ada setelah modul GSAP selesai di-`import()`, yaitu beberapa rangkai
     * SETELAH commit yang sedang diproses di sini. Jadi effect ini selalu
     * menulis posisi relatif terhadap layout yang belum selesai.
     *
     * Yang dilakukan di sini: tegaskan ulang posisinya setiap kali tubuh dokumen
     * berubah ukuran, selama halaman belum digulir oleh alasan lain.
     *
     * Yang TIDAK dilakukan: berhenti setelah pertama kali posisinya cocok. Itu
     * jebakan yang nyata di sini - perubahan tinggi dokumen yang pertama hanya
     * +80px di section BAWAH `#aturan`, jadi posisi yang dihitung tetap 3882 dan
     * penegasnya menyimpulkan "sudah cocok" lalu menutup pengamat; 400ms
     * kemudian runway 1800px muncul dan tidak ada yang memperbaikinya. Yang
     * dilakukan: biarkan pengamat tetap hidup sampai batas waktu.
     *
     * Dua kondisi yang benar-benar menghentikan pengamat, dan keduanya perlu -
     * kalau tidak, orang yang sedang menggulir akan ikut terseret:
     *   1. Posisi bergerak jauh dari yang kita tulis (ada penulis lain).
     *   2. Batas waktu tercapai, supaya pengamat ini tidak bisa menggantung.
     *
     * Batas waktunya longgar (4 detik) karena urutan yang diamati memang
     * panjang: modul GSAP, lalu refresh ScrollTrigger, lalu pin.
     */
    let settled = !anchorId;
    const stop = () => {
      settled = true;
      observer.disconnect();
      window.clearTimeout(deadline);
    };
    const observer = new ResizeObserver(() => {
      if (settled) return;
      if (Math.abs(window.scrollY - expected) > 4) {
        stop();
        return;
      }
      expected = write();
    });
    const deadline = window.setTimeout(stop, 4000);

    observer.observe(document.body);

    return stop;
  }, [route, hash]);

  return route;
}