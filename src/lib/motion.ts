/**
 * Konstanta gerak — angka dan timing untuk animasi.
 *
 * Dipisah dari `content.ts` dengan sengaja: file itu hanya berisi teks yang
 * bisa diedit pemilik situs, file ini berisi perilaku. Mengganti jarum warna
 * atau tanggal tidak boleh ikut mengubah timing animasi, dan sebaliknya.
 *
 * Stack animasi resmi proyek: paket `motion` (Motion for React) + CSS native
 * + IntersectionObserver. Tidak ada GSAP, Lenis, atau ScrollTrigger di sini.
 */

/* ---------------------------------------------------------------------------
   MEDIA QUERY — satu-satunya gerbang seluruh animasi
   ---------------------------------------------------------------------------
   Prinsipnya: setiap animasi harus berhenti saat query-nya tidak cocok.
   `useMediaQuery` di hooks/useMediaQuery.ts mengaboninya; CSS native memakai
   @media yang sama persis. Tidak ada state yang menggantung.
   ------------------------------------------------------------------------ */

export const MQ = {
  /** Gerak diizinkan (bukan reduced-motion). */
  motion: '(prefers-reduced-motion: no-preference)',
  /** Gerak + pointer presisi: magnet cerita & kursor kustom. */
  motionFine:
    '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)',
  /** Gerak + pointer presisi + layar lebar: parallax mouse yang mahal. */
  motionFineWide:
    '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) and (min-width: 1024px)',
  /**
   * Gerbang scene 3D hero. Lebar saja, tanpa syarat pointer: scene berjalan
   * dari animasinya sendiri, dan pointer hanya memiringkan sedikit — mouse
   * tidak perlu ada supaya DNA tetap berputar.
   * Batas 768px supaya tidak membebani baterai ponsel.
   */
  motionScene: '(prefers-reduced-motion: no-preference) and (min-width: 768px)',
  /**
   * Mode 'rich': hanya di sini kita boleh mengaktifkan WebGL (three.js),
   * kursor kustom dengan chase, parallax mouse. Tidak ada coarse/touch.
   * Ini berbeda dari motionScene karena membatasi pointer secara ketat.
   */
  rich:
    '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) and (min-width: 1024px)',
} as const;

/* ---------------------------------------------------------------------------
   EASE & DURASI
   ------------------------------------------------------------------------ */

/**
 * Kurva easing dipakai paket `motion` (array cubic-bezier).
 * Pola yang sama dipakai CSS lewat `--ease-elegant`.
 */
export const EASE = {
  /** Kinetic typography — hentakan tegas. */
  kinetic: [0.19, 1, 0.22, 1] as const,
  /** Reveal blok konten: cepat keluar, panjang mengendap. */
  reveal: [0.22, 1, 0.36, 1] as const,
  /** Kursor & magnet: mengikuti pointer tanpa terburu-buru. */
  follow: [0.22, 1, 0.36, 1] as const,
} as const;

export const DUR = {
  kinetic: 1.0,
  /** Entrance chrome hero (eyebrow/subteks/CTA). Reveal saat scroll & stagger
   *  punya Tokens sendiri di index.css (`--dur-reveal`, `--dur-reveal-stagger`)
   *  karena animasinya murni CSS, bukan MotionValue. */
  reveal: 0.9,
  /** Konstanta waktu lerp cincin kursor (detik). Nilai kecil = ngejar lebih kencang. */
  cursorTau: 0.16,
} as const;

/* ---------------------------------------------------------------------------
   GERAK BERBASIS SCROLL
   ------------------------------------------------------------------------ */

/** Parallax: `y` dihitung dari jarak scroll, bukan offset absolut. */
export const PARALLAX = {
  /** Ambient glow hero - bergerak paling lambat, memberi kedalaman. */
  heroBackdrop: { speed: 0.22, y: 90 },
  /** Ornamen DNA di section "Kenapa Helixa". */
  dna: { speed: 0.16, y: 70 },

  /**
   * Tiga simbol matematika di section "Cara Ikut".
   *
   * `speed` controlling besaran perbandingan antar simbol: makin besar, makin
   * cepat, dan itu yang membuat ketiganya terbaca sebagai lapisan berbeda
   * (depth) dan bukan tiga gambar yang bergerak serempak.
   *
   * `travel` adalah jarak total piksel yang ditempuh selagi section melewati
   * viewport, bukan offset absolut. Phi dan f(x) juga punya `x` sehingga
   * bergerak menyamping, bukan hanya vertikal.
   */
  mathSigma: { speed: 0.15, travel: 45 },
  mathPhi: { speed: 0.25, travel: 75, x: 28 },
  mathFunction: { speed: 0.35, travel: 105 },
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
  magneticRadius: 30,
  /** Proporsi tarikan magnet terhadap jarak. 1 = mengikuti penuh. */
  magneticStrength: 0.2,
  /** Batas pergeseran magnet dalam piksel (per sumbu), lihat useMagnetic. */
  magneticMax: 5,
} as const;