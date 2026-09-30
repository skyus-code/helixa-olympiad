/**
 * Konstanta gerak — angka dan timing untuk animasi.
 *
 * Dipisah dari `content.ts` dengan sengaja: file itu hanya berisi teks yang
 * bisa diedit pemilik situs, file ini berisi perilaku. Mengganti jarum warna
 * atau tanggal tidak boleh ikut mengubah timing animasi, dan sebaliknya.
 */

/* ---------------------------------------------------------------------------
   MEDIA QUERY — satu-satunya gerbang seluruh animasi
   ---------------------------------------------------------------------------
   Setiap animasi di aplikasi ini didaftarkan di dalam `gsap.matchMedia()`.
   Prinsipnya: ketika sebuah query tidak cocok, GSAP otomatis memanggil
   `revert()` pada semua yang didaftarkan di dalamnya — termasuk mengembalikan
   DOM SplitText ke teks asli dan menghapus transform yang dipasang. Tidak ada
   state yang menggantung.
   ------------------------------------------------------------------------ */

export const MQ = {
  /** Gerak diizinkan (bukan reduced-motion). */
  motion: '(prefers-reduced-motion: no-preference)',
  /** Gerak + layar cukup lebar. Ambang 768px: di bawah ini WebGL dimatikan. */
  motionWide: '(prefers-reduced-motion: no-preference) and (min-width: 768px)',
  /** Gerak + pointer presisi. Satu-satunya tempat kursor & magnet hidup. */
  motionFinePointer:
    '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)',
  /** Gerak + pointer presisi + layar lebar: parallax mouse yang mahal. */
  motionFineWide:
    '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) and (min-width: 1024px)',
} as const;

/* ---------------------------------------------------------------------------
   EASE & DURASI
   ------------------------------------------------------------------------ */

/** Reveal standar: cepat keluar, panjang mengendap. */
export const EASE = {
  /** Kinetic typography per huruf — hentakan yang tegas. */
  kinetic: 'power4.out',
  /** Reveal blok konten. */
  reveal: 'power3.out',
  /** Kursor & magnet: mengikuti pointer tanpa terburu-buru. */
  follow: 'power3.out',
  /** Accordion: buka-tutup dengan inersia lembut. */
  accordion: 'power2.inOut',
} as const;

export const DUR = {
  kinetic: 1.0,
  kineticStagger: 0.02,
  reveal: 0.9,
  revealStagger: 0.08,
  cursorFollow: 0.45,
  magnetic: 0.5,
  accordion: 0.5,
  hover: 0.3,
} as const;

/* ---------------------------------------------------------------------------
   GERAK BERBASIS SCROLL
   ------------------------------------------------------------------------ */

/** Parallax: `y` dihitung dari jarak scroll, bukan offset absolut. */
export const PARALLAX = {
  /** Hero — helix bergerak paling lambat, memberi kedalaman. */
  heroBackdrop: { speed: 0.22, y: 90 },
  /** Ornamen DNA di section Kenapa. */
  dna: { speed: 0.16, y: 70 },
  /** Simbol matematika — paling cepat, hampir lepas dari dokumen. */
  symbols: { speed: 0.3, y: 120 },
  /** Garis progres timeline Cara Ikut. */
  timeline: { speed: 1 },
} as const;

/* ---------------------------------------------------------------------------
   KURSOR
   ------------------------------------------------------------------------ */

export const CURSOR = {
  /** Radius cincin saat idle / saat magnet bekerja. */
  sizeIdle: 14,
  sizeActive: 44,
  /**
   * Jarak-pointer dianggap "dekat" untuk memicu magnet (px).
   *
   * Nilai ini sengaja dijaga ketat. Kalau terlalu lebar, tombol yang
   * berdekatan ikut tertarik saat kursor lewat di antara keduanya dan terasa
   * seperti saling menabrak.
   */
  magneticRadius: 90,
  /** Proporsi tarikan magnet terhadap jarak. 1 = mengikuti penuh. */
  magneticStrength: 0.2,
  /** Batas pergeseran magnet dalam piksel (per sumbu), lihat useMagnetic. */
  magneticMax: 10,
} as const;
