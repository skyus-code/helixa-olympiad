# Helixa Olympiad — Landing Page

Landing page satu halaman untuk **Helixa Olympiad**, olimpiade online Matematika & Biologi
untuk siswa SMA di Indonesia. Static site tanpa backend, dibangun dengan Vite + React +
TypeScript + Tailwind v4, didekorasi dengan GSAP, Lenis, serta Three.js.

Prinsip desain: **80% obsidian, 10% gading, 10% emas cair.** Kalau ragu, kurangi.

---

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output ke dist/
npm run preview  # cek hasil build
```

## Dua skrip verifikasi

Kedua skrip memakai Chrome DevTools Protocol lewat WebSocket bawaan Node — tanpa
Puppeteer/Playwright, jadi tidak menambah dependency. Keduanya mengukur **production
build**, bukan dev server, dan keduanya butuh server yang sudah jalan:

```bash
# terminal 1
npm run build && npm run preview -- --port 4200 --strictPort

# terminal 2
npm run check:responsive   # 11 viewport: overflow, teks terpotong, target sentuh
npm run check:verify       # 81 cek perilaku & animasi
```

Keduanya menerima URL sebagai argumen pertama, default `http://localhost:5173/`:

```bash
node scripts/audit.mjs  http://localhost:4200/
node scripts/verify.mjs http://localhost:4200/
```

> **Penting:** headless Chrome default-nya `prefers-reduced-motion: reduce`. Kedua skrip
> memaksa `no-preference` supaya animasi benar-benar diuji, dan `verify.mjs` menguji
> mode reduced-motion secara terpisah di Bagian 13.

### Apa yang diukur `verify.mjs`

Bukan "apakah kelas CSS-nya ada", tapi apa yang benar-benar terjadi di browser. Tiap
fitur cari bukti numerik: transform yang berubah, tinggi yang beranimasi, atribut yang
berubah, piksel yang benar-benar tergambar.

1. **Lenis smooth scroll** — kelas `lenis` / `lenis-smooth`, interpolasi, ScrollTrigger ikut
   posisi scroll Lenis
2. **Kinetic typography** — SplitText, `aria-label`, gradasi kata, dan bukti huruf benar-benar
   bergerak dari bawah (computed `y` puncak terukur > 5px saat tween)
3. **Scroll reveal** — 28 elemen, awalnya `opacity: 0` di bawah fold, semua ter-reveal
4. **FAQ** — `height: auto` GSAP, rekam tinggi per frame, `inert`, satu-buka
5. **WebGL** — canvas, konteks, fade-in, dan mesh benar-benar memberi piksel lewat selisih
   tangkapan layar
6. **Kursor kustom** — cincin 14px → 44px, mengikuti pointer
7. **Magnetic pull** — elemen tertarik dan kembali ke tempat
8. **Spotlight** — `--mx` / `--my` diperbarui, gradient di `::before`
9. **Garis progres** — `scaleX` tumbuh mengikuti scroll
10. **Parallax** — `translate` ornamen DNA berubah
11. **Navbar** — transparan di atas → `blur(24px)` + alpha 0.72 setelah scroll
12. **Mobile** — `pointer: coarse` nyata: kursor & magnet mati, Three.js mati, menu modal
13. **Reduced motion** — Lenis mati, SplitText tidak jalan, semua konten tetap terlihat
14. **Konsol bersih** — nol exception, nol `console.error`

### Empat jebakan pengukuran yang sudah ditangani

Semuanya ditemukan lewat kegagalan nyata:

1. **GSAP tidak selalu menulis `transform` sebagai `matrix`.** Untuk scale/translate terpisah
   ia menulis properti CSS `scale:` / `translate:` dan `transform: none`; untuk `yPercent`
   pada huruf ia menulis `transform: translate3d(Xpx, Ypx, 0px)` (bukan `matrix(...)`).
   Membaca `getComputedStyle(el).transform` saja selalu memberi matrix sehingga aman, tapi
   membaca **inline** `style.transform` salah menangkap dua bentuk pertama. `__xform` dan
   `yOf` di `verify.mjs` membaca computed, inline `translate:`, dan inline `translate3d`.
2. **`Emulation.setEmulatedMedia` hanya bisa mengubah fitur `any-pointer` / `any-hover`**,
   bukan `pointer` / `hover` (fitur pointer utama). Membuat `pointer: coarse` yang sungguhan
   harus lewat `setTouchEmulationEnabled`.
3. **Backbuffer WebGL dikosongkan setelah compositing.** `drawImage(canvas)` di luar
   `requestAnimationFrame` menghasilkan bidang kosong. Bukti piksel diambil dari
   tangkapan layar — hasil compositing browser, bukan canvas.
4. **Headless merender WebGL lewat perangkat lunak**, jadi satu frame bisa memakan
   ratusan milidetik. `setTimeout(70)` praktis berarti 500ms dan animasi 0.5 detik sudah
   selesai sebelum sempat diamati. Karena itu animasi disampel **per frame**.

Ditambah tiga jebakan pada skripnya sendiri:

- Semua kode yang disuntikkan ke halaman ditulis dengan `String.raw`. Backslash di dalam
  template literal biasa dimakan parser (`\s` menjadi `s`, bukan regex whitespace), dan
  `\\(` ganda di regex telah menelan `matrix(...)` dua kali. Tuliskan escape sekali saja.
- Animasi yang hanya jalan sekali saat mount harus diukur dari **sebelum** dokumen
  dieksekusi (`Page.addScriptToEvaluateOnNewDocument`). Event `load` terlambat: React sudah
  mount dan timeline sudah berjalan jauh saat `load` menyala.
- **Thread utama yang membeku membuat GSAP mengejar jam dinding sekaligus**: tween 1,1 detik
  selesai di antara dua frame, tak ada rAF yang pernah menampilkan posisi antara (149 frame
  terekam semuanya y = 0). Rantai `MutationObserver` + `attributeOldValue` merekonstruksi
  jejak gaya dari nilai lama, apa pun nasib rAF. Untuk pengukuran huruf, WebGL diblokir dulu
  supaya halaman tidak membeku (jalur fallback didukung aplikasi; WebGL asli diuji terpisah).
- **`scrollTo` programatik melawan Lenis**: Lenis menelan event scroll native pertama yang
  menyusul gulir mulusnya, jadi `window.scrollTo(0, 0)` bisa tidak membangkitkan event scroll
  dan navbar tertahan gelap. Pengukuran navbar memakai halaman segar + `WheelEvent` sintetis
  seperti input manusia, bukan lompatan programatik.

---

## Struktur folder

```
Helixa Olympiad/
├─ index.html              # font preconnect, viewport-fit=cover, meta, OG
├─ package.json
├─ vite.config.ts          # `base` dari env PUBLIC_BASE
├─ tsconfig.json / tsconfig.app.json / tsconfig.node.json
├─ .github/workflows/      # deploy.yml — build & deploy GitHub Pages
├─ public/favicon.svg      # ikon emas, SVG tulen
├─ scripts/
│  ├─ audit.mjs            # 11 viewport + deteksi overflow / teks terpotong / target sentuh
│  └─ verify.mjs           # 81 cek perilaku & animasi (14 bagian)
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ index.css            # design tokens, base, utilitas, blok reduced-motion
   ├─ content.ts           # SEMUA teks + REGISTER_URL + INSTAGRAM_URL
   ├─ vite-env.d.ts
   ├─ lib/
   │  ├─ gsap.ts           # registrasi plugin (ScrollTrigger, SplitText)
   │  └─ motion.ts         # MQ, EASE, DUR, PARALLAX, CURSOR
   ├─ hooks/
   │  ├─ useSmoothScroll.tsx  # Lenis + sinkronisasi gsap.ticker
   │  ├─ useGsapMedia.ts      # useIsoLayoutEffect + useGsapMedia (gerbang matchMedia)
   │  ├─ useKineticText.ts    # SplitText + mask + autoSplit
   │  └─ useMagnetic.ts       # registerHoverTarget + subscribeHoverState
   ├─ three/
   │  └─ helixScene.ts     # mesh heliks, tilting cursor, timing rAF manual
   └─ components/
      ├─ CursorLayer.tsx   # cincin emas tipis + titik
      ├─ HeroCanvas.tsx    # canvas WebGL, lazy, gated ready && inView
      ├─ Navbar.tsx
      ├─ Hero.tsx
      ├─ WhyHelixa.tsx
      ├─ PerdanaInfo.tsx
      ├─ HowToJoin.tsx
      ├─ JudgesPartners.tsx
      ├─ RulesTransparency.tsx
      ├─ Faq.tsx
      ├─ ClosingCta.tsx
      ├─ ornaments/
      │  ├─ DnaHelix.tsx
      │  ├─ MathSymbols.tsx
      │  └─ GrainOverlay.tsx
      └─ ui/
         ├─ Section.tsx
         ├─ Reveal.tsx
         ├─ Eyebrow.tsx
         ├─ SpotlightCard.tsx
         └─ Buttons.tsx
```

---

## Mengedit konten

**Semua teks ada di `src/content.ts`.** Tidak perlu menyentuh komponen.

| Yang diubah | Di mana |
|---|---|
| Link pendaftaran | `REGISTER_URL` |
| Link Instagram | `INSTAGRAM_URL` |
| Navbar, hero, seluruh section | `SITE`, `NAV_LINKS`, `NAV_CTA`, `HERO`, `WHY`, `PERDANA`, `HOW_TO_JOIN`, `JUDGES`, `RULES`, `FAQ`, `CLOSING`, `FOOTER` |

Nilai `REGISTER_URL` dan `INSTAGRAM_URL` masih `"#"` (placeholder). Ganti dengan URL asli
sebelum publish.

### Placeholder yang perlu diganti

Dicari dengan `grep -n "\[ISI" src/content.ts`:

| Placeholder | Letak |
|---|---|
| `[ISI TANGGAL]` ×3 | Pendaftaran, Pelaksanaan, Pengumuman di `PERDANA.details` |
| `[ISI JIKA ADA]` | Baris opsional di `JUDGES` |

Semua placeholder tampil dengan **border putus-putus emas** supaya mudah terlihat di
halaman maupun di panel teks.

### Aturan konten

Jangan menambahkan klaim, nama orang, tanggal, jumlah peserta, testimoni, atau frasa seperti
"resmi nasional", "terakreditasi", "bekerja sama dengan pemerintah/Kemendikdasmen".

Pernyataan independensi di `RULES` **wajib dipertahankan** — ada di tiga tempat
(`RULES.items`, satu item `FAQ`, dan `note` pada salah satu langkah). Helixa adalah
penyelenggara independen dan membandingkannya dengan OSN secara terbuka, bukan mengklaim
afiatifasi.

---

## Design tokens

Didefinisikan di blok `@theme` pada `src/index.css`.

| Token | Nilai | Pakai untuk |
|---|---|---|
| `--color-ink` | `#0A0A0B` | Background utama (~80%) |
| `--color-surface` | `#121214` | Kartu |
| `--color-bone` | `#F4EFE4` | Teks utama (gading) |
| `--color-bone-dim` | `#8E8E93` | Teks sekunder |
| `--color-gold-bright` | `#F6E7B4` | Emas terang |
| `--color-gold` | `#D4AF37` | Emas utama, aksen (~10%) |
| `--color-gold-bronze` | `#996515` | Emas gelap, ujung gradasi |
| `--color-gold-line` | `rgba(212,175,55,0.16)` | Garis / border kartu |
| `--font-display` | Cormorant Garamond 500/600 | Heading saja |
| `--font-sans` | Manrope 400/500/600 | Isi & UI |
| `--font-mono` | Space Mono 400 | Data, label angka |
| `--ease-elegant` | `cubic-bezier(0.22,1,0.36,1)` | Reveal & panel |

Gradasi emas (shimmer): `linear-gradient(135deg, #F6E7B4 0%, #D4AF37 50%, #996515 100%)`,
didefinisikan sekali di `.text-gold-gradient` / `.bg-gold-gradient`.

### Layout

- Lebar konten maks **1120px**, padding horizontal 20px (ponsel) → 32px (≥768px).
  Didefinisikan sebagai `.shell` dengan `var(--shell-max, 1120px)` — bukan utility class,
  supaya tidak bentrok dengan cascade Tailwind.
- `overflow-x: clip` pada `html` dan `body`. Dipakai `clip`, bukan `hidden`: `hidden` pada
  `html` membuat `position: sticky` dan `scrollIntoView` ikut gagal di sebagian browser.
- Semua ukuran teks fluid berbasis `clamp()`; tidak ada tinggi tetap yang menahan teks.

---

## Ornamen — nol gambar raster

Tidak ada satu pun gambar eksternal. Semua ornamen SVG, CSS, atau Canvas 3D.

| Komponen | Isi | Letak |
|---|---|---|
| `helixScene` | Mesh heliks Three.js (partikel + garis), tilting mengikuti kursor, parallax saat scroll | Latar hero, ≥768px saja |
| `HeroCanvas` | Ambient glow radial CSS | Selalu ada; menggantikan WebGL di mobile & reduced-motion |
| `DnaHelix` | Dua untai sinusoidal berpelintir + anak tangga | Section Kenapa Helixa |
| `MathSymbols` | Σ, π, ∫, φ | Latar section Kenapa, parallax |
| `GrainOverlay` | `feTurbulence` data-URI | `fixed inset-0`, `pointer-events-none` |

### Kenapa Three.js murni, bukan React Three Fiber

Yang dibutuhkan di sini hanya satu canvas statis tanpa state React. R3F menambah
reconciler, drei, dan sekitar 90 kB gzip tanpa keuntungan apa pun, sementara Three.js murni
membuat bundel tetap ramping.

`helixScene` di-`import()` secara dinamis, jadi jadi **chunk async sendiri** dan bundle utama
tidak menunggu three.js: teks hero tampil lebih dulu (LCP cepat) dan mesh muncul menyusul
dengan fade-in. Kalau WebGL ditolak (GPU blocklist, driver, context lost), situs jatuh ke
ambient glow CSS tanpa kehilangan apa pun.

---

## Sistem gerak

### `gsap.matchMedia()` sebagai satu-satunya gerbang

Setiap animasi didaftarkan di dalam `gsap.matchMedia()`. Kalau sebuah query tidak cocok,
GSAP otomatis memanggil `revert()` pada semua yang didaftarkan — termasuk mengembalikan
DOM SplitText ke teks asli dan menghapus transform yang dipasang. Tidak ada state menggantung,
tidak ada listener yang bocor.

| Query | Arti |
|---|---|
| `MQ.motion` | Gerak diizinkan (bukan reduced-motion) |
| `MQ.motionWide` | + layar ≥768px. **Satu-satunya tempat Three.js boleh hidup** |
| `MQ.motionFinePointer` | + pointer presisi. **Satu-satunya tempat kursor & magnet boleh hidup** |
| `MQ.motionFineWide` | + layar ≥1024px. Parallax mouse yang mahal |

### Lenis ↔ ScrollTrigger

Lenis dibuat dengan `autoRaf: false` dan **dipompa oleh `gsap.ticker`** dengan
`lagSmoothing(0)`, lalu ScrollTrigger diberi tahu posisi scroll Lenis setiap frame. Kalau
Lenis menjalankan rAF-nya sendiri, akan ada dua loop yang saling menimpa dan scroll trigger
akan terlambat satu frame.

`anchors: true` membuat tautan anchor ikut mulus. Saat menu mobile terbuka, Lenis
`stop()` dan scroll body dikunci; `Esc` melepas keduanya.

### Kinetic typography

GSAP `SplitText` dengan `type: 'lines,words,chars'` dan `mask: 'lines'`, sehingga tiap baris
punya wrapper ber-`overflow: hidden` sendiri — huruf benar-benar **naik dari dalam mask**,
bukan sekadar fade. `yPercent: 110 → 0`, `stagger: 0.02`, `ease: power4.out`, `duration: 1.0`.
`autoSplit: true` menghitung ulang baris saat ukuran layar berubah.

Kata yang bergradasi emas **tidak** ikut dipecah per huruf — gradasi akan restart di tiap
huruf. Jadi kata itu dibiarkan utuh sebagai elemen tersendiri.

`aria: 'auto'` membuat GSAP menambah `aria-label` berisi teks utuh, supaya screen reader
membaca kalimat normal, bukan huruf demi huruf.

### Kursor kustom

Cincin emas tipis + titik. Ukuran 14px diam → 44px saat ada target hover. Perpindahan pakai
`gsap.quickTo`, jadi tidak ada re-render React per frame. Didaftarkan ke `<body>` dengan
`position: fixed` + `pointer-events: none`, sehingga tidak pernah jadi blocker klik.

Element `<html>` diberi `data-custom-cursor="on"` hanya di perangkat pointer presisi, dan
`cursor: none` hanya diaktifkan di bawah `@media (hover: hover) and (pointer: fine)`. Kalau JS
gagal, pengguna mouse tidak kehilangan penanda.

### Magnetic pull

Elemen yang jaraknya dalam 110px dari pointer tertarik sebesar 32% dari jarak itu, lalu kembali
ke tempat begitu pointer menjauh. `getBoundingClientRect()` di-cache dan hanya diukur ulang
saat resize atau scroll.

### FAQ

`<button>` native dengan `aria-expanded` + `aria-controls`. Tinggi buka-tutup dianimasikan
GSAP ke `height: 'auto'` dalam **satu layout effect** yang di-key pada `openIndex` — ribbon
`useIsoLayoutEffect` kedua akan menulis `height: 'auto'` setelah tween dimulai dan
membunuhnya. Panel tertutup diberi `inert` agar kontennya tidak terbaca screen reader, dan
CSS membiarkan jawaban pertama terbuka sebagai fallback tanpa JS.

### `prefers-reduced-motion`

- Semua animasi GSAP tidak terdaftar (gerbang `MQ.motion`), termasuk SplitText — jadi teks
  tetap utuh dan tidak ada elemen tertinggal `opacity: 0`.
- Blok `@media (prefers-reduced-motion: reduce)` di `index.css` memaksa
  `transition-duration` / `animation-duration` jadi `0.01ms` dan `scroll-behavior: auto`.
- Lenis dan kursor kustom tidak pernah dipasang.

---

## Timing

Semua angka ada di satu tempat, `src/lib/motion.ts`. Dipisah dari `content.ts` dengan
sengaja: mengganti tanggal tidak boleh ikut mengubah timing animasi, dan sebaliknya.

| | Nilai |
|---|---|
| Kinetic | `1.0s`, stagger `0.02`, `power4.out` |
| Reveal | `0.9s`, stagger `0.08`, `power3.out` |
| Kursor | `0.45s`, `power3.out` |
| Magnet | `0.5s`, `power3.out` |
| Accordion | `0.5s`, `power2.inOut` |
| Hover | `0.3s` |
| Parallax | hero `0.22/90px`, DNA `0.16/70px`, simbol `0.3/120px` |

---

## Responsif

Mobile-first, dibuka dengan `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280.

| Breakpoint | Yang berubah |
|---|---|
| <768px | Three.js mati → ambient glow CSS. Kursor kustom & magnet mati |
| ≥768px | WebGL helix aktif |
| ≥1024px | Parallax mouse pada ornamen DNA, layout 2 kolom |
| `orientation: landscape` + `max-height: 500px` | Hero tidak lagi memaksa tinggi layar, petunjuk scroll disembunyikan |

Detail penting:

- **`svh`, bukan `vh`** — hero tidak melompat saat address bar HP naik-turun.
- **Safe area iPhone** — `viewport-fit=cover`; navbar memakai `env(safe-area-inset-top)`, panel
  menu dan footer memakai `env(safe-area-inset-bottom)`.
- **Target sentuh ≥ 44px** — tombol `min-h-11`, hamburger 44×44, judul FAQ 56px.
- **Hover vs sentuh** — semua efek hover dibungkus `@media (hover: hover) and (pointer: fine)`;
  di perangkat sentuh dipakai `:active` ringan.
- **Zoom 200%** — tidak ada tinggi tetap yang menahan teks.

### Menu mobile

`role="dialog"` `aria-modal`, `aria-expanded` + `aria-controls` pada tombol, focus trap
sederhana (siklus Tab/Shift+Tab di dalam panel), fokus awal ke elemen pertama, `Esc` menutup,
klik link menutup, scroll body dikunci termasuk kompensasi scrollbar agar tidak layout shift,
fokus dikembalikan ke tombol pemicu saat ditutup.

---

## Ukuran build

| File | Ukuran | gzip |
|---|---|---|
| `index.html` | 1.71 kB | 0.77 kB |
| `assets/index-*.css` | 33.48 kB | 7.47 kB |
| `assets/index-*.js` (bundle utama) | 405.15 kB | 135.00 kB |
| `assets/helixScene-*.js` (chunk async) | 519.87 kB | 130.57 kB |

Bundle utama tidak pernah menunggu three.js — chunk scene diload terpisah.

---

## Deploy

```bash
npm run build   # -> dist/
```

`dist/` adalah static site murni, tanpa adapter server. Hanya anchor (`#tentang` dll) dan
tombol eksternal, jadi tidak perlu aturan rewrite.

- **GitHub Pages** — lewat `.github/workflows/deploy.yml`. Tiap push ke `main` build & deploy.
  URL: <https://skyus-code.github.io/helixa-olympiad/>
- **Vercel / Netlify / Cloudflare Pages** — build `npm run build`, output `dist`

### Base path

Karena GitHub Pages menyajikan *project page* dari `/<nama-repo>/`, semua asset harus mengikuti
base tersebut. `vite.config.ts` membacanya dari env:

| Konteks | `PUBLIC_BASE` | Hasil |
|---|---|---|
| `npm run dev` / `npm run preview` | (kosong) | `base: '/'` |
| CI (GitHub Actions) | `configure-pages`, jatuh ke `/helixa-olympiad` | `base: '/helixa-olympiad/'` |

`index.html` otomatis ter-prefix — termasuk `favicon.svg`. Kalau nanti dipindah ke domain
sendiri, cukup kosongkan `PUBLIC_BASE` di workflow; `base` kembali ke `/` tanpa perlu ubah kode.

> `vite preview` membakar nilai `base` saat start. Kalau `base` berubah, restart preview
> sebelum memverifikasi lagi.

### Aktivasi GitHub Pages (perlu sekali, manual)

CI tidak bisa mengaktifkan Pages sendiri. `GITHUB_TOKEN` bawaan Actions **tidak** berwenang
membuat situs Pages baru — GitHub membalas `Resource not accessible by integration`. Satu
langkah manual, sekali saja:

1. Buka <https://github.com/skyus-code/helixa-olympiad/settings/pages>
2. **Source** → pilih **GitHub Actions** → Save

Setelah itu tiap push ke `main` deploy otomatis. Sampai langkah itu dilakukan, job `build`
tetap hijau dan artifact tetap ter-upload — hanya job `deploy` yang gagal, jadi tidak ada
build yang terbuang.

Untuk mencoba lagi tanpa push baru: tab **Actions** → workflow *Deploy to GitHub Pages* →
**Run workflow**.

---

## Hasil verifikasi

Semua diukur terhadap **production build** (`npm run build` → `npm run preview`).

**`audit.mjs` — 11/11 viewport bersih**, nol scroll horizontal di semua lebar:

320 · 375 · 430 · 768 · 1024 · 1280 · 1440 · 1920 · landscape 844×390 · 740×360 · 1024×768

Screenshot full-page tiap lebar ada di `screenshots/` (di-git-ignore).

**`verify.mjs` — 81/81 cek lulus** terhadap build yang sama. Ringkasan bagian:

| Bagian | Yang dibuktikan |
|---|---|
| 1 | Lenis menempel, meng-interpolasi (sampel per frame menangkap posisi antara), `lenis-smooth` aktif saat menggulir, ScrollTrigger sinkron |
| 2 | SplitText 21 node, `aria-label` utuh, huruf bergerak dari bawah (computed `y` puncak terukur > 5px saat tween) |
| 3 | 28 elemen reveal, awalnya `opacity: 0` di bawah fold, 0 tersisa tersembunyi |
| 4 | 7 tinggi berbeda dan monoton saat accordion (bukan lompat), `inert` tepat |
| 5 | Canvas 1440×900, `opacity: 0.996`, mesh menambah **~48 kB** piksel PNG |
| 6 | Cincin 44px saat ada target, mengikuti pointer (700,400) → (300,250) |
| 7 | Magnet (0,0) → (9.6,0), kembali tepat ke (0.00, 0.00) |
| 8 | `--mx` 210px, `--my` 30px, gradient radial di `::before` |
| 9 | `scaleX` 0.00 → 1.00 mengikuti scroll |
| 10 | `translate` 0px → 70px |
| 11 | Halaman segar transparan di atas (alpha 0) → setelah `WheelEvent` gulir: `blur(24px)` + alpha 0.72 + border emas |
| 12 | `pointer: coarse` nyata; kursor/magnet/WebGL mati, menu `dialog` + `aria-modal`, Lenis `stop()` |
| 13 | Reduced motion: Lenis & kursor mati, SplitText 0 div, semua konten terlihat |
| 14 | **0 exception, 0 `console.error`** |

---

## Catatan asumsi

1. **Tailwind v4** dengan plugin `@tailwindcss/vite` — token ditulis di blok `@theme`, tidak
   ada `tailwind.config.js`. Karena itu nilai spacing dinamis (`py-18`, `py-24`, `py-30`)
   tersedia tanpa konfigurasi tambahan: `18 × 0.25rem = 72px`, `24 × = 96px`, `30 × = 120px`.
2. **GSAP 3.15** — `ScrollTrigger` dan `SplitText` kini gratis di paket inti, jadi tidak ada
   Lisensi club yang dibutuhkan.
3. **Lenis 1.3** (`lenis`), bukan paket lama `@studio-freight/lenis` yang sudah deprecated.
4. **Font dimuat dari Google Fonts** dengan `preconnect` + `display=swap`. Kalau situs perlu
   fully offline-first, ganti ke `@fontsource`.
5. **`REGISTER_URL` / `INSTAGRAM_URL` = `"#"`** sengaja dibiarkan sebagai placeholder agar
   tidak ada tautan palsu yang terpublish.
6. **Tidak ada klaim kemitraan** dengan pemerintah atau instansi mana pun, sesuai batasan
   konten. Pernyataan independensi dipertahankan.
7. **Skrip verifikasi butuh Chrome** di `C:\Program Files\Google\Chrome\Application\chrome.exe`
   dan server yang sudah berjalan. Keduanya akan gagal dengan pesan jelas, bukan diam-diam
   melewati cek.
