# Helixa Olympiad — Landing Page

Landing page satu halaman untuk **Helixa Olympiad**, olimpiade online Matematika & Biologi
untuk siswa SMA di Indonesia. Static site tanpa backend, dibangun dengan Vite + React +
TypeScript + Tailwind v4. Stack gerak resmi: paket **`motion`** (Motion for React) + CSS
native + IntersectionObserver, plus satu renderer Canvas 2D sendiri untuk objek 3D hero.
Tanpa GSAP / Lenis / ScrollTrigger / SplitText / three.js, tanpa WebGL, tanpa scroll-jacking.

Prinsip desain: **80% obsidian, 10% gading, 10% emas cair.** Kalau ragu, kurangi.

---

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output ke dist/
npm run preview  # cek hasil build
```

## Tiga skrip verifikasi

Ketiganya memakai Chrome DevTools Protocol lewat WebSocket bawaan Node — tanpa
Puppeteer/Playwright, jadi tidak menambah dependency. Semuanya mengukur **production
build**, bukan dev server, dan semuanya butuh server yang sudah jalan:

```bash
# terminal 1
npm run build && npm run preview -- --port 4200 --strictPort

# terminal 2
npm run check:responsive   # 11 viewport: overflow, teks terpotong, target sentuh
npm run check:verify       # cek statis + 14 bagian perilaku & animasi di browser
npm run check:lighthouse   # Lighthouse Mobile (butuh install terpisah, lihat catatan)
```

Keduanya menerima URL sebagai argumen pertama, default `http://localhost:4200/`:

```bash
node scripts/audit.mjs     http://localhost:4200/
node scripts/verify.mjs    http://localhost:4200/
node scripts/lighthouse.mjs http://localhost:4200/ lh.json
```

> **Penting:** headless Chrome default-nya `prefers-reduced-motion: reduce`. Kedua skrip
> memaksa `no-preference` supaya animasi benar-benar diuji, dan `verify.mjs` menguji
> mode reduced-motion secara terpisah (Bagian B12).
>
> **`lighthouse.mjs` punya install sendiri.** CLI `lighthouse` tidak bisa dipakai di
> mesin ini (`npx lighthouse` gagal dengan `ECOMPROMISED`; memanggil
> `lighthouse/cli/bin.js` langsung keluar kode 0 tanpa menulis laporan). Jadi skrip ini
> memanggil Node API dengan `chrome-launcher`, dan **`require`-nya menunjuk ke
> `node_modules` di luar repo** — kalau folder itu tidak ada, skrip gagal dengan pesan
> jelas. Angka Lighthouse di README diambil lewat skrip ini, bukan lewat CLI.

### Apa yang diukur `verify.mjs`

Bukan "apakah kelas CSS-nya ada", tapi apa yang benar-benar terjadi di browser. Tiap
fitur cari bukti numerik: transform yang berubah, tinggi yang beranimasi, atribut yang
berubah, interaksi yang benar-benar berfungsi.

1. **Stack kartu — HANYA 2 section** — `tentang` + `perdana` yang jadi kartu `position:
   sticky; top: 0`, z-index 20/30, radius 28px + bayangan; 5 section lain pakai garis rambut
   1px dalam flow normal; `scroll-margin-top` 88px. Pin butuh **1024px DAN 720px**
2. **Kinetic typography** — headline terpecah jadi baris (`motion.span` naik dari mask,
   sekali saat mount), teks utuh, kata "sains" bergradasi emas; ambient glow statis
3. **Scroll reveal** — semua grup/single reveal (IntersectionObserver) terpicu setelah
   scroll penuh, nol elemen tertinggal `opacity: 0`
4. **Garis progres** — satu elemen `scaleX`/`scaleY` tumbuh mengikuti scroll jendela
5. **Parallax** — ornamen DNA bergeser; HANYA ≥1024px + pointer fine; dibatasi 2 titik
6. **FAQ akordeon** — CSS `grid-template-rows`, `inert` pada panel tertutup, satu-buka,
   aria-expanded, dan tombolnya diklik lewat `elementFromPoint` (bukti tidak ada section
   ter-pin yang menutupinya)
7. **Navbar** — transparan di atas → blur + solid + border emas setelah scroll
8. **Kursor kustom** — cincin mengejar pointer (lerp rAF), dot menempel tepat, cincin
   berpusat; **hanya syarat pointer fine, tanpa batas lebar** — diuji hidup di 900px,
   bukan hanya di ≥1024px
9. **Magnet & spotlight** — tombol tertarik mendekat pointer dan kembali diam; `--mx/--my`
   spotlight diperbarui; keduanya mati di layar sentuh
10. **Mobile** — `pointer: coarse` nyata: canvas 3D tidak pernah dibuat (<768px), pin
    sticky dilepas (normal flow, overlap `-28px`), kursor/magnet/parallax mati, menu
     modal `dialog` + `aria-modal`, Esc menutup
11. **Reduced motion** — section kembali `relative`, kartu tanpa radius/bayangan, teks
    langsung terbaca, scroll native, parallax ditangguhkan, kursor mati, canvas 3D tidak
     dibuat
12. **Sweep lebar** — 320/375/768/1024/1440 tanpa scroll horizontal, FAQ tetap bisa diklik
13. **Konsol bersih** — nol exception, nol `console.error`

### Jebakan pengukuran yang sudah ditangani

1. **`Emulation.setEmulatedMedia` hanya bisa mengubah fitur `any-pointer` / `any-hover`**,
   bukan `pointer` / `hover` (fitur pointer utama). Membuat `pointer: coarse` yang sungguhan
   harus lewat `setTouchEmulationEnabled`.
2. **Headless Chrome default-nya `prefers-reduced-motion: reduce`.** Semua pengukuran
   animasi aktif memakai `Emulation.setEmulatedMedia` dengan `no-preference`; mode reduce
   diuji sebagai bagian tersendiri.
3. **Section sticky membuat pengukuran posisi bohong — dan `offsetTop` bukan jalan keluar.**
   Begitu section ter-pin `top: 0`, `getBoundingClientRect()` membeku di `0`, jadi
   `rect.top + scrollY` menulis `scrollY` sebagai "atas dokumen" dan progress macet.
   `offsetTop` terlihat seperti alternatif, tapi untuk elemen sticky ia justru
   mengembalikan kotak yang sedang dipin — nilai yang salahnya sama. Solusinya:
   `useScrollProgress` mengukur hanya saat section **tidak** ter-pin
   (`rect.top > 0.5 || rect.bottom <= 0`), dan pengukuran yang ditolak diulang pada
   scroll berikutnya saat pin sudah lepas. Semua pemicu lain (resize,
   `document.fonts.ready`, `ResizeObserver` pada `body`) memakai gerbang yang sama, jadi
   tidak ada jalur yang bisa menulis angka salah.
4. **Koreksi rect dengan delta scroll juga salah untuk section sticky.** Elemen di dalam
   section yang ter-pin berhenti bergerak relatif viewport, jadi
   `rect ± (scrollY − scrollY_saat_ukur)` justru melenceng tepat di section yang sedang
   ditonjolkan. `useMagnetic` dan `SpotlightCard` karena itu **menandai** rect basi di
   scroll/resize lalu mengukurnya lagi di frame berikutnya (saat benar-benar dipakai),
   bukan mengoreksinya.
4. **Gerakan dikunci preferensi di JS dan CSS sekaligus.** Gerbang `useMediaQuery` +
   `useReducedMotion` di komponen, dan blok `@media (prefers-reduced-motion: reduce)` di
   CSS. `getComputedStyle().transform` dibaca (computed, bukan inline) untuk transform
   yang ditulis CSS var (`translate3d(--magnet-x, ...)`), motion inline, maupun properti
   `translate:` — helper `__xform` menormalkan semuanya ke `{x, y, sx, sy}`.
5. **Jebakan pengukuran yang hampir lolos.** Beberapa test dulu lulus karena test-nya
   salah, bukan karena kodenya benar:
   - **Transisi navbar** diuji dengan `setTimeout` 700 ms. Pada lima percobaan berturut
     sampelnya 0,43–0,68 sementara nilai sebenarnya 0,72 — terjaring di tengah jalan
     karena mesin sedang load. Sekarang test menunggu sampai nilainya **dua kali sama**
     (bukan menebak durasi), jadi tidak bisa lulus kalau transisinya memang tak pernah
     tuntas.
   - **Daftar library terlarang** memakai substring polos `'three'`, yang ikut menangkap
     path `src/three/` milik renderer sendiri. Sekarang polanya berbentuk impor
     (`from 'three`, `THREE.`, `WebGLRenderingContext`), sehingga three.js tetap
     terdeteksi tapi path lokal tidak.
   - **Asersi FAQ** menuntut `top = 0` karena mobility-asumsi semua section sticky.
     Sekarang section flow normal, jadi yang diuji lebih ketat: tombolnya diklik
     (`elementFromPoint`) dan harus benar-benar yang menutup elemen teratas — itulah
     bukti tidak ada section ter-pin yang menutupinya.
6. **Regresi bisa hidup di dua tempat.** Kursor kustom hilang bukan karena satu baris
   JS: `MQ.motionFineWide` **dan** aturan CSS `cursor: none` sama-sama mengunci
   `min-width: 1024px`. Memperbaiki satu saja tidak akan terlihat. B8 sengaja menguji
   **900px** supaya dua kondisi itu tidak bisa kembali diam-diam.

---

## Struktur folder

```
Helixa Olympiad/
├─ index.html              # preload 2 woff2 lokal (tanpa Space Mono), viewport-fit=cover, meta, OG
├─ package.json
├─ vite.config.ts          # `base` dari env PUBLIC_BASE
├─ tsconfig.json / tsconfig.app.json / tsconfig.node.json
├─ .github/workflows/      # deploy.yml — build & deploy GitHub Pages
├─ public/favicon.svg      # ikon emas, SVG tulen
├─ public/fonts/           # Cormorant Garamond + Manrope variable woff2 (SIL OFL, latin, ~62 kB)
├─ scripts/
│  ├─ audit.mjs            # 11 viewport + deteksi overflow / teks terpotong / target sentuh
│  ├─ verify.mjs           # cek statis + 14 bagian perilaku & animasi (111 cek)
│  └─ lighthouse.mjs       # Lighthouse Mobile lewat Node API (install di luar repo)
└─ src/
   ├─ main.tsx
   ├─ App.tsx              # Navbar → main#top (8 section) → Footer → grain → cursor
   ├─ index.css            # design tokens, base, stacking, reveal, FAQ, blok reduced-motion
   ├─ content.ts           # SEMUA teks + REGISTER_URL + INSTAGRAM_URL
   ├─ vite-env.d.ts
   ├─ lib/
   │  └─ motion.ts         # MQ, EASE, DUR, PARALLAX, CURSOR
   ├─ three/
   │  └─ helixScene.ts     # renderer objek 3D hero — Canvas 2D, tanpa three.js
   ├─ hooks/
   │  ├─ useIsoLayoutEffect.ts  # useLayoutEffect aman-SSR
   │  ├─ useMediaQuery.ts       # abonemen MQ sebagai state React (gerbang satu-satunya)
   │  ├─ useScrollProgress.ts   # progress scroll JENDELA untuk section sticky
   │  └─ useMagnetic.ts         # registerHoverTarget + subscribeHoverState (CSS var)
   └─ components/
      ├─ CursorLayer.tsx   # cincin emas + dot, lerp rAF time-based, portal ke body
      ├─ Navbar.tsx
      ├─ Hero.tsx          # kinetic per baris + ambient parallax + <HeroCanvas/>
      ├─ HeroCanvas.tsx    # pembungkus tipis: gerbang MQ.motionScene + dynamic import
      ├─ WhyHelixa.tsx     # stack card (1 dari 2 section yang di-pin)
      ├─ PerdanaInfo.tsx   # stack card (2 dari 2 section yang di-pin)
      ├─ HowToJoin.tsx     # stack rule (garis rambut, tanpa overlap)
      ├─ JudgesPartners.tsx
      ├─ RulesTransparency.tsx
      ├─ Faq.tsx           # akordeon CSS grid-rows + inert; stack rule
      ├─ ClosingCta.tsx
      ├─ ornaments/
      │  ├─ DnaHelix.tsx
      │  ├─ MathSymbols.tsx
      │  └─ GrainOverlay.tsx
      └─ ui/
         ├─ Section.tsx    # stack-wrap + z + kartu
         ├─ Reveal.tsx     # Reveal / RevealGroup (IO, tanpa selector)
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

Nilai `REGISTER_URL` masih `"#"` (placeholder). `INSTAGRAM_URL` sudah diisi URL resmi
Helixa. Ganti `REGISTER_URL` dengan URL asli sebelum publish.

### Placeholder yang perlu diganti

Dicari dengan `grep -n "\[ISI" src/content.ts`:

| Placeholder | Letak |
|---|---|
| `[ISI TANGGAL]` ×3 | Pendaftaran, Pelaksanaan, Pengumuman di `PERDANA.details` |

### Aturan konten

Jangan menambahkan klaim, nama orang, tanggal, jumlah peserta, testimoni, atau frasa seperti
"resmi nasional", "terakreditasi", "bekerja sama dengan pemerintah/Kemendikdasmen".

Pernyataan independensi di `RULES` **wajib dipertahankan** — ada di tiga tempat
(`RULES.items`, satu item `FAQ`, dan `note` pada salah satu langkah). Helixa adalah
penyelenggara independen dan membandingkannya dengan OSN secara terbuka, bukan mengklaim
afiliasi.

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
| `--color-gold-bronze` | `#A17C1B` | Emas gelap, ujung gradasi |
| `--color-gold-line` | `rgba(212,175,55,0.16)` | Garis / border kartu |
| `--font-display` | Cormorant Garamond 500/600 | Heading saja |
| `--font-sans` | Manrope 400/500/600 | Isi & UI (tidak ada `--font-mono`) |
| `--ease-elegant` | `cubic-bezier(0.22,1,0.36,1)` | Reveal & panel |
| `--dur-hover` | `300ms` | Semua transisi hover |
| `--dur-reveal` | `700ms` | Reveal satu elemen & kelompok |
| `--dur-reveal-stagger` | `80ms` | Jarak antar anak reveal |

Gradasi emas (shimmer): `linear-gradient(135deg, #F6E7B4 0%, #D4AF37 50%, #A17C1B 100%)`,
didefinisikan sekali di `.text-gold-gradient` / `.bg-gold-gradient`.

### Layout

- Lebar konten maks **1120px**, padding horizontal 20px (ponsel) → 32px (≥768px).
  Didefinisikan sebagai `.shell` dengan `var(--shell-max, 1120px)` — bukan utility class,
  supaya tidak bentrok dengan cascade Tailwind.
- `overflow-x: clip` pada `html` dan `body`. Dipakai `clip`, bukan `hidden`: `hidden` pada
  `html` membuat `position: sticky` dan `scrollIntoView` ikut gagal di sebagian browser.
- Semua ukuran teks fluid berbasis `clamp()`; tidak ada tinggi tetap yang menahan teks.

---

## Ornamen — nol gambar raster, nol WebGL

Tidak ada satu pun gambar eksternal dan tidak ada WebGL. Ornamen berjas SVG/CSS, kecuali
satu: objek 3D hero, yang digambar sendiri di Canvas 2D (lihat di bawah).

| Komponen | Isi | Letak |
|---|---|---|
| `.hero-ambient` | Glow radial CSS murni, statis; parallax kecil saat scroll (≥1024px + pointer fine) | Latar hero |
| `HelixScene` | **Canvas 2D**: heliks DNA + cincin penanda + partikel + satelit orbit | Latar hero, ≥768px |
| `DnaHelix` | Dua untai sinusoidal berpelintir + anak tangga (SVG) | Section Kenapa Helixa |
| `MathSymbols` | Σ, π, ∫ — statis, bukan parallax | Latar Cara Ikut |
| `GrainOverlay` | `feTurbulence` data-URI | `fixed inset-0`, `pointer-events-none` |
| `.hero-scrim` | Gradien gelap **di atas** canvas, melindungi teks dari objek | Lapisan antara canvas & konten |

### Objek 3D hero — Canvas 2D, bukan three.js

`src/three/helixScene.ts` (nama folder warisan dari implementasi three.js lama; paketnya
sendiri tidak pernah dipakai lagi) menggambar sendiri heliks DNA, cincin penanda, partikel
naik, dan satu satelit yang mengorbit. Cara kerjanya:

- **Perspektif + depth-sort di JS.** Tiap titik diproyeksikan sendiri (`project()`), lalu
  dirender berurutan dari belakang ke depan; compositing `lighter` untuk titik bercahaya.
- **Sprite di-prerender sekali.** Tiga gradient radial 48×48 dibangun di awal, lalu tiap
  frame cukup `drawImage`. Menyusun string rgba di dalam loop adalah bottleneck yang sudah
  dihindari, bukan placeholder.
- **Tanpa WebGL, tanpa shader, tanpa dependency.** three.js menambah ~150 kB gzip + kompilasi
  shader saat load, dan bisa ditolak GPU blocklist. Renderer ini 3.85 kB / 1.92 kB gzip
  dan tidak pernah gagal kompilasi.
- **Berhenti total saat keluar viewport.** `IntersectionObserver` membatalkan rAF-nya,
  bukan hanya berhenti menggambar — inilah penghematan nyata, bukan yang berbasis TBT.
- **DPR dibatasi 2.** Baterai di laptop retina tidak perlu diratakan ke lebih banyak piksel.

Gerbangnya `MQ.motionScene` = `no-preference` **dan `min-width: 768px`**. Di bawah itu, atau
saat reduced-motion, scene tidak pernah dibuat — yang tampil `.hero-ambient` + `.hero-scrim`
CSS. Lebar saja tanpa syarat pointer: mouse tidak harus ada supaya DNA tetap berputar.

Objek digeser ke kanan pada ≥1280px (`cx = 0.72 w`) supaya headline rata-kiri tidak
berebut ruang; di bawah itu posisinya tengah dan redup (`master = 0.55`). Breakpoint ini
**wajib sama** dengan `@media (min-width: 1280px)` di `.hero-scrim` — kalau tidak cocok, teks
tertutup objek atau objek menggantung di ruang kosong.

---

## Sistem gerak — 8 jenis

Semua gerak lewat paket `motion` **atau** CSS native. Gerbangnya satu-satunya:
`MQ` di `src/lib/motion.ts`, dibaca JS lewat `useMediaQuery` dan CSS lewat `@media`
yang sama persis.

| Query | Arti |
|---|---|
| `MQ.motion` | Gerak diizinkan (bukan reduced-motion) |
| `MQ.motionFine` | + pointer presisi. **Satu-satunya tempat magnet & kursor kustom boleh hidup** |
| `MQ.motionFineWide` | + layar ≥1024px. **Satu-satunya tempat parallax boleh hidup** |
| `MQ.motionScene` | + layar ≥768px. **Satu-satunya tempat scene 3D hero boleh hidup** |

> **Kursor kustom tidak lagi memakai `MQ.motionFineWide`.** Dulu ia dikunci ke
> `min-width: 1024px`, dan itu regresi: kursor hilang di jendela 1023px ke bawah —
> justru di tempat penanda presisi paling dibutuhkan. Syarat lebar tidak ada
> hubungannya dengan pointer, jadi sudah dicabut dari JS **dan** dari aturan CSS
> `cursor: none`. `verify.mjs` B8 sekarang mengujinya di **900px** supaya regresi
> yang sama tidak bisa kembali diam-diam.

1. **Entrance hero (sekali)** — 3 baris headline naik dari mask (`motion.span`,
   `y: 110% → 0`, `DUR.kinetic 1.0s`, delay 0.1/0.28/0.34) + chrome (eyebrow/subteks/CTA)
   fade+up (delay 0.55/0.72/0.84). Tidak ada loop.
2. **Stack kartu — 2 section saja** — `tentang` lalu `perdana`, kartu `position: sticky;
   top: 0; min-height: 100svh; overflow: hidden`, z-index 20/30, radius atas 28px +
   bayangan `0 -24px 60px -24px rgba(0,0,0,0.55)`. Penggulir membuat `perdana` menutupi
   `tentang` — murni CSS, tanpa listener. Enam section lain **tidak** punya efek overlap:
   lima di antaranya pakai garis rambut 1px dalam flow normal, Hero tanpa radius. Batas
   ini pilihan desain: section yang menumpuk terlalu banyak membuat halaman terasa
   berantakan dan setiap gulir kehilangan konteks.
3. **Reveal saat scroll (IO)** — `.reveal-group`/`.reveal` disembunyikan di bawah fold dan
   diberi kelas `is-in-view` oleh IntersectionObserver; fade+up 24px, stagger 80ms per anak
   (CSS). Kelas hanya dipasang JS saat `MQ.motion` cocok; tanpa JS semuanya langsung terlihat.
4. **Garis pembatas** — maska horizontal `scaleX: 0 → 1` (bukan scroll-linked) + garis
   progres Cara Ikut `scaleX`/`scaleY` yang mengikuti scroll jendela
   (`useScrollProgress`).
5. **Parallax — HANYA 2 titik**, keduanya ≥1024px + pointer fine + no-reduced-motion:
   ambient hero (rentang scrollY `[0, 1200]`) dan DNA di Kenapa Helixa.
6. **Hover elegan** — spotlight kartu, `border`/`background` tombol dan daftar aturan
   berpindah lembut (`transition`, `--ease-elegant`); semuanya di dalam
   `@media (hover: hover) and (pointer: fine)`.
7. **Kursor kustom** — dot menempel tepat di pointer; cincin mengejar dengan lerp rAF
   time-based (`1 − exp(−dt/τ)`, τ = 0.16s). Posisi lewat CSS var + `translate3d` langsung,
   ukuran cincin via transisi CSS (pusat tetap). Didaftarkan ke `<body>`,
   `pointer-events: none`, `cursor: none` hanya saat aktif.
8. **Navbar** — transparan di atas → blur + solid + border emas setelah scroll (listener
   rAF). Menu mobile = panel CSS + `role="dialog"`, body terkunci, Esc menutup.

### Overlap antar-section — maksimal 2

Efek tumpang-tindih dipakai **tepat dua kali**, langsung di bawah Hero: `tentang` lalu
`perdana`. Enam section sisanya tidak punya efek apa pun — lima pakai garis rambut 1px.

Syarat pin **dua-duanya** dan keduanya wajib:

```
@media (min-width: 1024px) and (min-height: 720px)
```

Lebar saja tidak cukup, dan tinggi saja tidak cukup. Diuji, bukan ditebak: pada 768–900px
lebar, isi `perdana` 763px (teks membungkus lebih sering) sehingga pin di sana **memotong
isi** — ekor section tidak pernah terjangkau. Di bawah ambang mana pun, kedua section
kembali flow normal dengan radius/bayangan/overlap 28px.

Padding adaptif untuk section yang ter-pin diletakkan di `@layer utilities`, bukan
`components`: utility Tailwind selalu mengalahkan komponen, jadi aturan yang sama di
`components` tidak akan pernah berlaku.

| Kondisi | Hasil |
|---|---|
| ≥1024px **dan** ≥720px | `tentang` & `perdana` `position: sticky; top: 0`, radius 28px + bayangan; `perdana` menutupi `tentang` |
| Di luar itu | Flow normal; kedua kartu dapat radius/bayangan/overlap 28px tanpa pin |
| `prefers-reduced-motion: reduce` | Keduanya `position: relative`, tanpa radius/bayangan/overlap |

> `Section.tsx` punya prop `stack` (`card` / `rule`) untuk memetakan ke modifier
> `.stack-wrap--*`. Default-nya tanpa efek — jadi section baru tidak diam-diam mewarisi
> overlap.

### Alignment per section

| Section | Alignment |
|---|---|
| Hero | Asimetris kiri (konten `max-w-2xl`) |
| Kenapa Helixa | Header **tengah** (max ~40ch), grid kartu kiri |
| Perdana | Kiri + garis vertikal emas 2px full-height kiri (`.accent-rule-l`) |
| Cara Ikut | Header **tengah** (max ~40ch) + langkah grid |
| Juri & Mitra | Kiri |
| Aturan & Transparansi | Header **kanan** (`.section-head--right`, ~38ch) + daftar kiri |
| FAQ | Kiri (dua kolom ≥1024px) |
| CTA Penutup | Tengah |

### Kinetic typography

Headline dipecah jadi tiga elemen utuh — `headlineLead` / `headlineAccent` / `headlineTail`
(di `content.ts`) — lalu tiap elemen dibungkus `.kinetic-line` (mask `overflow: hidden`
dengan `padding-bottom` kompensasi) dan baris dalamnya naik `y: 110% → 0` sekali saat
mount. Kata yang bergradasi emas ("sains") dibiarkan utuh, bukan dipecah per huruf, supaya
gradasi tidak restart. Reduced-motion: teks langsung utuh, tanpa wrapper animasi.

### Kursor kustom

`CursorLayer` memakai dua state: dot (instan, `translate3d` ditulis langsung di frame
`pointermove`) dan cincin (lerp rAF `1 − exp(−dt/τ)` — tidak tergantung framerate seperti
tween berbasis delta tetap). `html[data-cursor-visible]` / `data-cursor-hover` /
`data-cursor-pressed` jadi satu-satunya sumber state CSS (ukuran cincin lewat transisi CSS;
margin negatif ikut menyesuaikan agar pusat cincin tetap di pointer). Portal ke
`document.body`, `pointer-events: none`, aktif hanya saat `MQ.motionFine`.

### Magnetic pull

`useMagnetic` mendaftarkan target ke pool (dipakai kursor untuk menjalankan `data-cursor-
hover`) dan menulis CSS var `--magnet-x/--magnet-y`; transform diterapkan CSS di `.magnetic`
dengan transisi lembut (`--ease-elegant`). Tarikan dibatasi proporsional ukuran + pagar
10px. Elemen kembali ke tempat begitu pointer menjauh. Aktif hanya saat `MQ.motionFine`
(tanpa gerakan di layar sentuh).

### Parallax — mengapa `useScrollProgress`, bukan `useScroll({ target })`

Begitu section di-pin `top: 0`, rect elemen relatif viewport **membeku** — `useScroll`
dengan target mengukur posisi itu dan progress tersangkut. Karena itu `useScrollProgress`
menghitung progress dari `window.scrollY` terhadap rentang
`[topDokumen − lead·vh, topDokumen + span·vh]`.

`topDokumen` sendiri hanya boleh diukur saat section **tidak** ter-pin, dan hook
menolak pengukuran saat ter-pin (lihat jebakan #3). reduced-motion: parallax dipatok 0.

### FAQ

`<button>` native dengan `aria-expanded` + `aria-controls`. Tinggi buka-tutup pakai trik
CSS `grid-template-rows: 0fr → 1fr` — `auto` bukan nilai yang bisa diinterpolasi, jadi panel
luar membungkus inner ber-`overflow: hidden` dan peralihan `0fr → 1fr` menganimasikan tinggi
tanpa mengukur JS. Panel tertutup diberi `inert`; `is-open` di `.faq-item` jadi satu-satunya
state JS (layout effect). Fail-safe: tanpa JS, `.faq-list:not([data-js])` membiarkan jawaban
pertama terbuka.

### `prefers-reduced-motion`

- Seluruh gerbang `MQ.*` gagal → tidak ada animasi yang didaftarkan JS; teks langsung
  terbaca, parallax ditangguhkan, kursor/magnet mati.
- Blok `@media (prefers-reduced-motion: reduce)` di `index.css` memaksa
  `transition-duration` / `animation-duration` jadi `0.01ms`, `scroll-behavior: auto`, kartu
  kembali `position: relative` tanpa radius/bayangan/overlap.
- `useReducedMotion()` dari `motion/react` dipakai komponen yang beranimasi saat mount
  (Hero) supaya tidak ada frame awal tersembunyi.

---

## Timing

Setiap durasi punya tepat satu sumber. Dipisah dari `content.ts` dengan sengaja:
mengganti tanggal tidak boleh ikut mengubah timing animasi, dan sebaliknya.

- **Milik JS** → `src/lib/motion.ts` (`DUR`, `EASE`).
- **Milik CSS** → token di blok `@theme` `src/index.css` (`--dur-hover`,
  `--dur-reveal`, `--dur-reveal-stagger`). Animasi reveal saat scroll, magnet,
  akordeon, dan ukuran kursor semuanya transisi CSS, jadi tidak perlu angka yang
  sama ditulis dua kali.

| | Nilai | Sumber |
|---|---|---|
| Kinetic (baris headline) | `1.0s`, delay 0.1/0.28/0.34 | `DUR.kinetic` |
| Entrance chrome hero | `0.9s`, delay 0.55/0.72/0.84 | `DUR.reveal` |
| Reveal saat scroll | `700ms` + stagger `80ms`/anak | `--dur-reveal`, `--dur-reveal-stagger` |
| Cursor lerp | τ `0.16s` (time-based, `1 − e^(−dt/τ)`) | `DUR.cursorTau` |
| Ukuran cincin cursor | `350ms` (CSS, transisi) | CSS `.cursor-ring` |
| Magnet | `450ms` (CSS, transisi) | CSS `.magnetic` |
| Akordeon FAQ | `500ms` (CSS, `grid-template-rows`) | CSS `.faq-panel` |
| Hover (tombol/kartu/tautan) | `300ms` | `--dur-hover` |
| Navbar scroll-state | `500ms` (Tailwind `duration-500`) | `Navbar.tsx` |
| Parallax | hero ambient `0.22 × 90px` (range scroll 1200), DNA `0.16 × 70px` | `PARALLAX` |

---

## Responsif

Mobile-first, dibuka dengan `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280.

| Breakpoint | Yang berubah |
|---|---|
| <768px | Canvas 3D tidak pernah dibuat; kursor kustom & magnet mati |
| ≥768px | Scene 3D hero boleh hidup (`MQ.motionScene`) |
| ≥1024px | Parallax (hero ambient + DNA) & kursor kustom aktif (pointer fine) |
| ≥1024px **dan** ≥720px | `tentang` + `perdana` di-pin sebagai kartu bertumpuk |
| ≥1280px | Objek 3D hero bergeser ke kanan (`cx = 0.72 w`) + scrim jadi gradien linear |
| `orientation: landscape` + `max-height: 500px` | Hero tidak lagi memaksa tinggi layar, petunjuk scroll disembunyikan |

Detail penting:

- **`svh`, bukan `vh`** — section tidak melompat saat address bar HP naik-turun.
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
| `index.html` | 1.95 kB | 0.88 kB |
| `assets/index-*.css` | 36.92 kB | 8.30 kB |
| `assets/index-*.js` (bundle utama) | 395.68 kB | 125.56 kB |
| `assets/helixScene-*.js` (chunk async, scene 3D) | 3.85 kB | 1.92 kB |
| `fonts/cormorant-garamond-latin-var.woff2` | 37.6 kB | — (sudah kompres) |
| `fonts/manrope-latin-var.woff2` | 24.8 kB | — (sudah kompres) |

Ada **satu** chunk async: `helixScene`, di-`import()` dinamis dari `HeroCanvas`. Alasannya
LCP, bukan ukuran: teks hero selesai digambar lebih dulu, scene menyusul dengan fade-in.
Di bawah 768px atau saat reduced-motion, chunk itu tidak pernah diminta sama sekali.
Kedua font latin variable di-host sendiri (total ~62 kB) dan di-`preload`, jadi tidak ada
permintaan ke pihak ketiga sama sekali saat halaman dimuat.

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

**`verify.mjs` — 111 cek lulus / 0 gagal** terhadap build yang sama. Ringkasan bagian:

| Bagian | Yang dibuktikan |
|---|---|
| A1–A2 | Statis: tanpa gsap/lenis/three di package.json & src; `--color-gold-bronze: #a17c1b`; tanpa `--font-mono`/Space Mono/`.lenis`; tanpa animasi infinite; stack punya syarat mati di luar layar cukup besar **dan** dimatikan total di reduced-motion |
| B1 | 8 section, z-index 10→80; **maksimal 2** yang di-pin (`tentang` + `perdana`), sisanya garis rambut; isi section ter-pin muat di viewport; `scroll-margin-top` 88px |
| B2 | Headline terpecah 3 baris, teks utuh, "sains" gradien, ambient statis; **canvas 3D benar-benar menggambar** (lit-pixel > 400, maxAlpha > 120, opacity > 0.95, centroid > 0.62 × vw) + scrim ada |
| B3 | Semua reveal terpicu, nol elemen tertinggal opacity 0 |
| B4 | Garis progres `scaleX` tumbuh mengikuti scroll |
| B5 | Parallax DNA bergeser (≥1024px + fine) |
| B6 | FAQ: item pertama terbuka, `inert` tepat, buka-tutup bergantian, tombol diklik & **tidak tertutup** section ter-pin |
| B7 | Navbar transparan → blur + solid + border emas |
| B8 | Cincin mengejar pointer, dot menempel, cincin berpusat; **hidup di 900px** (regresi batas-lebar), sementara parallax tetap mati di 900px |
| B9 | Magnet mendekat & kembali; `--mx/--my` spotlight; keduanya `hover:fine` saja |
| B10 | Menu tersembunyi di desktop; tanpa scroll horizontal 1440px |
| B11 | Mobile: canvas 3D tidak dibuat, hanya 2 section overlap `-28px`, kursor/magnet mati, menu `dialog`, Esc menutup |
| B12 | Reduced motion: canvas 3D tidak dibuat, ambient tetap ada, relative, tanpa radius/bayangan, teks langsung terbaca |
| B13 | Sweep 320/375/768/1024/1440: tanpa scroll horizontal, FAQ klikable |
| B14 | **0 exception, 0 `console.error`** |

### Lighthouse (Mobile, headless Chrome)

| Kategori | Skor |
|---|---|
| Performance | **61** (median 3 run; lihat catatan di bawah) |
| Accessibility | 96 |
| Best practices | 100 |
| SEO | 91 |

Tiga kategori selain Performance **stabil persis** di setiap run. Performance tidak —
ia berfluktuasi 59–65 pada tiga run berturut, dan pernah turun ke 44 ketika beban CPU
host menyentuh 100%.

Rincian performance (median 3 run) — **empat dari lima metrik sudah sehat, satu tidak**:

| Metrik | Nilai | Skor | Bobot |
|---|---|---|---|
| FCP | 1.9 s | 86 | 10 |
| LCP | 2.7 s | 85 | 25 |
| CLS | 0 | 100 | 25 |
| Speed Index | 6.3 s | 42 | 10 |
| **TBT** | **2350 ms** | **5** | **30** |

**TBT adalah satu-satunya penahan, dan ini batas arsitektur, bukan bug.** Seluruh TBT
berasal dari satu long task: mount React 19 + `motion`. Diukur tanpa throttling, satu
muat halaman ini butuh ~180–340 ms `ScriptDuration` untuk 362 node DOM; Lighthouse
mensimulasikan CPU 4× lebih lambat, jadi task yang sama muncul sebagai ~1–1.4 s.
Untuk skor TBT ≥ 90 (≈ ≤ 200 ms) pekerjaan JS riil harus turun ke bawah ~50 ms, dan
itu tidak mungkin dicapai oleh mount React + `motion` tanpa mengganti arsitekturnya.

**Biaya objek 3D: nol, dan ini dibuktikan langsung.** Dulu sementara ada gerbang
`load` di `HeroCanvas` dengan alasan "menghemat TBT". Alasannya dibatalkan karena
pengukurannya salah: TBT untuk build yang **identik** berfluktuasi 1300–3720 ms di
mesin ini, jadi selisih segitu tidak membuktikan apa pun. Yang benar diukur langsung —
satu frame scene:

| Skenario | Biaya 1 frame |
|---|---|
| 1024×720 @ DPR 1 | 4.4 ms |
| 1440×900 @ DPR 1 | 4.5 ms |
| 1440×900 @ DPR 2 (canvas 2880×1800) | 4.9 ms |

Itu ~27% dari anggaran frame 60 fps, dan mustahil menjadi long task (ambang 50 ms) yang
dihitung TBT. Gerbang `load` lalu dicabut — ia tidak menghemat apa pun, hanya
memperlambat objek yang justru diminta untuk tampil. Penghematan yang dipakai
ganti: rAF **dibatalkan** saat hero keluar viewport (`IntersectionObserver`), bukan
hanya berhenti menggambar.

**Angka 67 → 61 terjadi setelah objek 3D kembali, tapi TBT bukan penyebabnya.** Selisih
itu tidak diklaim sebagai "biaya scene" — ia konsekuensi yang lain: Speed Index turun
72 → 42 karena hero kini punya canvas yang harus dilukis setelah LCP tercapai. Yang
bisa dipertanggungjawabkan hanyalah biaya frame yang terukur di tabel di atas.

**Yang benar-benar memperbaiki angka (50 → 67, sebelum objek 3D kembali):**

| Perubahan | Efek |
|---|---|
| Font di-host sendiri (2 woff2, ~62 kB, preload) — hilang DNS + TCP + TLS + round-trip ke Google Fonts | 50 → 66 |
| Satu `IntersectionObserver` bersama untuk semua reveal (bukan satu per elemen) | mengurai init |
| `.grain` tanpa `mix-blend-mode` — overlay fixed setinggi viewport/full lebar memaksa pembacaan backdrop tiap repaint | mengurai paint |
| Pembacaan geometri di-batch ke `requestAnimationFrame`; rect magnet & spotlight diukur lazy lalu ditandai basi | DCL 741 → 442 ms, FCP 1160 → 844 ms |

**Yang dicoba lalu dikembalikan:**

`content-visibility: auto` + `contain-intrinsic-size` sempat dipasang pada `.stack-wrap`
(TBT turun ke ~1210 ms). Ia dicabut karena **merusak kebenaran posisi dokumen**: saat
section dirender secara lazy, `getBoundingClientRect().top + scrollY` untuk section yang sama
bergerak dari 900 → 6399 → 5499 px dalam satu sesi scroll, sehingga parallax DNA dan magnet
ikut salah. Trade-off metric-versus-kebenaran itu tidak diambil.

**Jalur menuju ≥90 (tidak diambil — di luar cakupan sistem gerak yang diminta):**

1. **Prerender / SSG** lalu hydrate. FCP dan LCP pindah dari JS ke HTML; TBT tetap
   tinggi karena pekerjaan hydrate masih ada.
2. **Lazy-mount section di bawah fold** (`dynamic import` + mount setelah FCP). Memotong
   task awal, tetapi total blocking work tetap sama kecuali dipecah jadi task < 50 ms.
3. **Ganti React** dengan render statis — opsi ini mengorbankan sistem gerak yang
   justru diwajibkan.

> **Catatan tentang pengukuran — baca sebelum membandingkan angka.**
>
> Semua angka diambil di mesin yang bebannya **100%** (19 proses Chrome milik pengguna
> menyala bersamaan). Noise-nya besar dan nyata:
>
> | Yang diukur | Rentang untuk build identik |
> |---|---|
> | TBT | 1300 – 3720 ms |
> | Performance | 44 – 68 |
>
> Karena itu tabel di atas memakai **median 3 run berturut**, bukan satu angka. Dan karena
> noise sebesar itu, **selisih TBT tidak boleh dipakai untuk menyimpulkan biaya fitur.**
> Biaya scene 3D justru diukur langsung per-frame, bukan dari selisih TBT — lihat tabel
> biaya frame di atas. Menutup tab browser sebelum mengukur akan menaikkan skor;
> TBT tetap didominasi oleh mount React + `motion`.

---

## Catatan asumsi

1. **Tailwind v4** dengan plugin `@tailwindcss/vite` — token ditulis di blok `@theme`, tidak
   ada `tailwind.config.js`. Karena itu nilai spacing dinamis (`py-18`, `py-24`, `py-30`)
   tersedia tanpa konfigurasi tambahan: `18 × 0.25rem = 72px`, `24 × = 96px`, `30 × = 120px`.
   Auto-detection sumber dikecualikan di `@source not` untuk `dist/`, `screenshots/`,
   `README.md`, dan `scripts/` — tanpa itu, prosa dokumentasi ikut menyuntik utilitas
   tak terpakai ke CSS produksi dan hash bundle berubah setiap kali dokumentasi disunting
   (terbukti: satu penyuntingan README menggeser CSS 0.43 kB).
2. **`motion` v13** dipakai via `motion/react` (`motion`, `useScroll`, `useTransform`,
   `useReducedMotion`). Build Vite SPA, bukan SSR.
3. **Scroll native** — `html { scroll-behavior: smooth }` untuk tautan anchor; tidak ada
   smooth-scroll pihak ketiga. Reduced-motion memaksa `auto`.
4. **Font di-host sendiri** — `public/fonts/` berisi dua *variable* woff2 latin (Cormorant
   Garamond 500–600, Manrope 400–600; total ~62 kB, lisensi SIL OFL), di-`@font-face` di
   `index.css` dan di-`preload` dari `index.html` lewat `%BASE_URL%` sehingga ikut benar
   di GitHub Pages. Google Fonts dihapus total: satu domain lebih sedikit, satu handshaking
   TLS lebih sedikit, dan nol permintaan ke pihak ketiga. Space Mono ikut dihapus (lihat token
   `--font-mono`). Kalau nanti butuh subset lain, tambahkan file woff2 + `<link>` preload-nya.
5. **`REGISTER_URL` = `"#"`** sengaja dibiarkan sebagai placeholder agar tidak ada tautan
   palsu yang terpublish. **`INSTAGRAM_URL`** sudah diisi URL resmi Helixa
   (`https://www.instagram.com/helixa.olim/`) dan terbuka di tab baru; kedua tombol/link
   Instagram (CTA penutup & footer) memakai konstanta ini.
6. **Tidak ada klaim kemitraan** dengan pemerintah atau instansi mana pun, sesuai batasan
   konten. Pernyataan independensi dipertahankan.
7. **Skrip verifikasi butuh Chrome** di `C:\Program Files\Google\Chrome\Application\chrome.exe`
   dan server yang sudah berjalan. Keduanya akan gagal dengan pesan jelas, bukan diam-diam
   melewati cek.
