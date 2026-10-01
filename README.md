# Helixa Olympiad — Landing Page

Landing page satu halaman untuk **Helixa Olympiad**, olimpiade online Matematika & Biologi
untuk siswa SMA di Indonesia. Static site tanpa backend, dibangun dengan Vite + React +
TypeScript + Tailwind v4.

Stack gerak resmi: paket **`motion`** (Motion for React) + CSS native + IntersectionObserver,
ditambah **three.js** untuk dua objek 3D (pusaran partikel DNA di hero, armillary di Aturan) dan
**GSAP** hanya untuk clock smooth scroll. Semua tambahan itu di balik satu gerbang:
`useMotionMode()`.

> Tanpa Lenis / ScrollTrigger / SplitText. Tanpa `ScrollSmoother` — alasannya ada di bagian
> [Smooth scroll](#smooth-scroll-bukan-scrollsmoother).

Prinsip desain: **80% obsidian, 10% gading, 10% emas cair.** Kalau ragu, kurangi.

---

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output ke dist/
npm run preview  # cek hasil build
```

## Empat skrip verifikasi

Semuanya memakai Chrome DevTools Protocol lewat WebSocket bawaan Node — tanpa
Puppeteer/Playwright, jadi tidak menambah dependency. Semuanya mengukur **production
build**, bukan dev server, dan semuanya butuh server yang sudah jalan:

```bash
# terminal 1
npm run build && npm run preview -- --port 4200 --strictPort

# terminal 2
npm run check:responsive   # 11 viewport: overflow, teks terpotong, target sentuh
npm run check:verify       # cek statis + 16 bagian perilaku, animasi & performa
npm run check:webgl-off    # WebGL dimatikan: hero jatuh ke SVG helix
npm run check:lighthouse   # Lighthouse Mobile (butuh install terpisah, lihat catatan)
```

Semuanya menerima URL sebagai argumen pertama, default `http://localhost:4200/`:

```bash
node scripts/audit.mjs            http://localhost:4200/
node scripts/verify.mjs           http://localhost:4200/
node scripts/verify-webgl-off.mjs http://localhost:4200/
node scripts/lighthouse.mjs       http://localhost:4200/ lh.json
```

`verify-webgl-off.mjs` dipisah dari `verify.mjs` karena mematikan WebGL butuh flag saat
Chrome **start** (`--disable-3d-apis`, setara "Disable WebGL" di DevTools > Rendering), dan
flag tidak bisa diubah pada browser yang sudah jalan. `verify.mjs` memakai satu instance
Chrome untuk semua bloknya, jadi kondisi itu tidak bisa diuji dari dalamnya.

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
5. **Parallax** — tiga simbol matematika (Σ, φ, f(x)) bergeser dengan laju berbeda; HANYA
   ≥1024px + pointer fine; murni berbasis posisi scroll, bukan rotasi otomatis
6. **FAQ akordeon** — CSS `grid-template-rows`, `inert` pada panel tertutup, satu-buka,
   aria-expanded, dan tombolnya diklik lewat `elementFromPoint` (bukti tidak ada section
   ter-pin yang menutupinya)
7. **Navbar** — transparan di atas → blur + solid + border emas setelah scroll
8. **Kursor kustom** — dot 7px `#F6E7B4` memimpin (transform langsung di `pointermove`,
   tanpa rAF), cincin 28px `#D4AF37` mengejar dengan lerp eksponensial τ ≈ 0.4s. Saat
   hover, cincin membesar ~1.8x dan terisi tipis. **Hanya mode `rich`** (≥1024px + pointer
   fine), dan loop interpolasinya berhenti sendiri begitu cincin menyatu
9. **Magnet & spotlight** — tombol tertarik mendekat pointer dan kembali diam; `--mx/--my`
   spotlight diperbarui; keduanya mati di layar sentuh
10. **Mobile** — `pointer: coarse` nyata: **rekaman jaringan** membuktikan hanya 1 file `.js`
    yang diunduh (bundle utama), tanpa chunk three.js maupun GSAP; canvas 3D tidak pernah
    dibuat, pin sticky dilepas (normal flow, overlap `-28px`), kursor/magnet/parallax mati,
    menu modal `dialog` + `aria-modal`, Esc menutup
11. **Reduced motion** — section kembali `relative`, kartu tanpa radius/bayangan, teks
    langsung terbaca, scroll native, kursor mati, canvas 3D tidak dibuat, dan **nol animasi
    CSS berjalan di seluruh halaman** (`document.getAnimations()`)
12. **Sweep lebar** — 320/375/768/1024/1440 tanpa scroll horizontal, FAQ tetap bisa diklik
13. **Bukti partikel** — framebuffer WebGL dibaca lewat `drawImage` + `getImageData` di dalam
    halaman; motif harus berada di ≥70% lebar layar (tidak menindih headline)
14. **Konsol bersih** — nol exception, nol `console.error`
15. **Performa** — FPS partikel hero dan giroskop Aturan diukur lewat penghitung rAF yang
    tidak menghitung dirinya sendiri; render loop harus **nol** callback saat semua section
    3D jauh dari viewport, dan hidup lagi setelah kembali ke atas. Juga diperiksa bahwa
    kedua canvas 3D tidak pernah hidup bersamaan (jaraknya 3071px)
16. **Kursor berhenti** — di posisi scroll tanpa loop lain, interpolasi cincin harus aktif
    saat pointer bergerak dan **nol** setelah menyatu

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
6. **`Page.captureScreenshot` tidak menyertakan layer WebGL di Chrome headless.**
   Percobaan A/B dengan menyembunyikan canvas lewat CSS menghasilkan **selisih nol piksel**
   setiap kali, padahal framebuffer-nya jelas berisi partikel. A/B seperti itu hanya bisa
   menghasilkan dua jawaban yang salah: "kosong" untuk scene yang berjalan, atau "ada isi"
   untuk scene yang mati. Karena itu bukti partikel sekarang dibaca **in-page** —
   `drawImage` ke canvas 2D lalu `getImageData` — yang membaca framebuffer sungguhan tanpa
   perantara compositor. Syaratnya renderer memakai `preserveDrawingBuffer: true`.
7. **Tunggu scene siap, jangan tunggu angka detik.** Chunk three.js 515 kB dan diunduh
   lewat dynamic import, jadi waktu inisialisasi sangat bergantung pada beban mesin. Probe
   dengan timeout tetap pernah mengukur canvas yang masih 300×150 (ukuran default HTML,
   artinya `setSize` belum sempat dipanggil) dan melaporkan "nol piksel" yang sebenarnya
   hanya artefak pengaturan waktu. Semua probe kini mem-poll kondisi siap:
   canvas sudah ter-size **dan** fade-in selesai.
8. **Gerbang mode device-first mengubah apa arti "viewport mobile".** `readMotionMode()`
   memeriksa perangkat dulu, baru preferensi gerak. Jadi menguji mode `rich` di viewport
   sempit dengan pointer fine akan mendapat `'simple'`, bukan `'rich'` — dan pemeriksaan
   WebGL akan gagal bukan karena kodenya salah, tapi karena gerbangnya memang bekerja.
   `Emulation.setTouchEmulationEnabled({enabled: false})` wajib selain itu, kalau tidak
   `pointer` terbaca coarse dan `CursorLayer` merender null.
9. **Penghitung rAF harus tidak menghitung dirinya sendiri, dan tidak boleh dipasang dua
   kali.** Loop pengukuran memakai referensi rAF yang dibungkus lebih dulu, supaya
   "nol frame" benar-benar berarti tidak ada yang menggambar — kalau tidak, angka nol selalu
   bisa dicapai oleh alat pengukur. Memasang wrapper kedua di blok yang sama tanpa reload
   membuat wrapper lama memanggil dirinya sendiri (karena ia membaca
   `window.__nativeRaf` secara dinamis) dan langsung memicu stack overflow. Karena itu B16
   sengaja memakai wrapper B15 apa adanya.

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
│  ├─ audit.mjs                # 11 viewport + deteksi overflow / teks terpotong / target sentuh
│  ├─ verify.mjs               # cek statis + B1-B16 perilaku, animasi & performa (131 cek)
│  ├─ verify-webgl-off.mjs     # WebGL dimatikan: hero jatuh ke SVG helix (7 cek)
│  └─ lighthouse.mjs           # Lighthouse Mobile lewat Node API (install di luar repo)
└─ src/
   ├─ main.tsx
   ├─ App.tsx              # Navbar → main#top (8 section) → Footer → grain → cursor
   ├─ index.css            # design tokens, base, stacking, reveal, FAQ, kursor, blok reduced-motion
   ├─ content.ts           # SEMUA teks + REGISTER_URL + INSTAGRAM_URL
   ├─ vite-env.d.ts
   ├─ lib/
   │  └─ motion.ts         # MQ (termasuk MQ.rich), EASE, DUR, PARALLAX, CURSOR
   ├─ three/
   │  ├─ dnaParticles.ts   # 560 partikel emas → heliks DNA (three.js) — rich saja
   │  └─ gyroscope.ts      # 4 cincin TorusGeometry wireframe (three.js) — rich saja
   ├─ hooks/
   │  ├─ useIsoLayoutEffect.ts  # useLayoutEffect aman-SSR
   │  ├─ useMediaQuery.ts       # abonemen MQ sebagai state React
   │  ├─ useMotionMode.ts       # gerbang 'reduced' | 'rich' | 'simple' — device-first
   │  ├─ useSmoothScroll.ts     # smooth scroll GSAP (gsap.ticker + window.scrollTo)
   │  ├─ useScrollProgress.ts   # progress scroll JENDELA untuk section sticky
   │  └─ useMagnetic.ts         # registerHoverTarget + subscribeHoverState (CSS var)
   └─ components/
      ├─ CursorLayer.tsx   # dot memimpin + cincin mengejar; berhenti saat menyatu
      ├─ Navbar.tsx
      ├─ Hero.tsx          # kinetic per baris + ambient + gerbang partikel/SVG
      ├─ HeroParticles.tsx # pembungkus: gerbang mode rich + dynamic import + fallback
      ├─ GyroCanvas.tsx    # mount saat dekat viewport, dispose saat jauh
      ├─ WhyHelixa.tsx     # stack card (1 dari 2 section yang di-pin)
      ├─ PerdanaInfo.tsx   # stack card (2 dari 2 section yang di-pin)
      ├─ HowToJoin.tsx     # stack rule + parallax 3 simbol matematika
      ├─ JudgesPartners.tsx
      ├─ RulesTransparency.tsx  # dekorasi <GyroCanvas/>
      ├─ Faq.tsx           # akordeon CSS grid-rows + inert; stack rule
      ├─ ClosingCta.tsx
      ├─ ornaments/
      │  ├─ DnaHelix.tsx      # fallback SVG heliks DNA
      │  ├─ MathSymbols.tsx   # Σ, φ, f(x) dengan parallax per-simbol
      │  └─ GrainOverlay.tsx
      └─ ui/
         ├─ Section.tsx    # stack-wrap + z + kartu (+ prop `decor`)
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

## Ornamen — nol gambar raster, WebGL hanya di dua tempat

Tidak ada satu pun gambar eksternal. Ornamen berjas SVG/CSS, kecuali **dua** yang memakai
WebGL — dan keduanya hanya di mode `rich`:

| Komponen | Isi | Letak | Gate |
|---|---|---|---|
| `.hero-ambient` | Glow radial CSS murni, statis | Latar hero | selalu |
| `HeroParticles` | **WebGL (three.js)**: 560 partikel emas membentuk heliks DNA | Latar hero | `rich` saja |
| `DnaHelix` | Dua untai sinusoidal berpelintir + anak tangga (SVG) | Section Kenapa Helixa | selalu |
| `GyroCanvas` | **WebGL (three.js)**: 4 cincin `TorusGeometry` wireframe (armillary) | Dekorasi sisi Aturan | `rich` saja |
| `MathSymbols` | Σ, φ, f(x) — **parallax per-simbol** | Latar Cara Ikut | `rich` saja |
| `GrainOverlay` | `feTurbulence` data-URI | `fixed inset-0`, `pointer-events-none` | selalu |
| `.hero-scrim` | Gradien gelap **di atas** canvas, melindungi teks dari objek | Antara canvas & konten | selalu |

### Gerbang `useMotionMode()` — satu-satunya pintu masuk

Semua fitur baru di halaman ini melewati satu hook. Ia mengembalikan tiga mode:

| Mode | Kapan | Isinya |
|---|---|---|
| `rich` | pointer fine **dan** lebar ≥1024px, tanpa reduced-motion | Semua: kursor, dua WebGL, parallax, smooth scroll |
| `simple` | HP / tablet / pointer coarse | **Persis seperti sebelum revisi ini.** Tidak ada three.js, tidak ada GSAP, tidak ada kursor, tidak ada parallax |
| `reduced` | `prefers-reduced-motion: reduce` di perangkat yang memenuhi syarat di atas | Konten langsung terbaca, nol animasi |

`readMotionMode()` memeriksa **perangkat dulu, baru preferensi gerak** — urutan itu disengaja.
HP yang juga meminta reduced-motion tetap dapat `'simple'`, sehingga chunk three.js dan GSAP
tidak pernah terunduh di perangkat mana pun yang kecil. Konsekuensinya: di HP dengan
reduced-motion, partikel three.js memang tidak muncul sama sekali (yang tampil `DnaHelix` SVG
yang diam). Itu pilihan yang diambil agar syarat "three.js tidak terunduh di mobile" tetap
benar di tingkat jaringan, bukan sekadar "tidak dieksekusi".

### Partikel hero — `src/three/dnaParticles.ts`

- **560 partikel**, dua untai (`θ` dan `θ+π`), radius konsisten, jitter acak di x/y/z supaya
  terbaca sebagai serbuk, bukan garis padat.
- Emas `#D4AF37` / `#F6E7B4`, opacity 0.78, additive blending, size attenuation, DPR maks 2.
- Rotasi kontinu Y 0.05 rad/detik; tilt ke mouse maks ±0.3 rad Y dan ±0.15 rad X, lerp
  0.05/frame. Ini **pengecualian infinite-loop resmi #1**.
- Motif duduk di **87% lebar layar** (`MOTIF_CENTER_X`), sama dengan kotak fallback SVG
  `DnaHelix` (`right: 4%`) supaya transisi rich → simple tidak terasa melompat. Nilainya
  dihitung dari geometri kamera, jadi posisinya sama di aspect rasio berapa pun.
- Berhenti **total** saat hero keluar `rootMargin: -20%`, dan saat tab disembunyikan.
- Fallback wajib: pembuatan WebGL dibungkus `try/catch`; kalau ditolak, Hero merender
  `DnaHelix` SVG, tidak pernah kosong.

### Armillary Aturan — `src/three/gyroscope.ts`

- 4 cincin `TorusGeometry` wireframe (radius 1.0 / 0.86 / 0.72 / 0.58), kecepatan berlawanan
  arah, opacity garis 0.55, `MeshBasicMaterial` tanpa lighting.
- **Pengecualian infinite-loop resmi #2.**
- Satu `IntersectionObserver` `rootMargin: 20%`: context dialokasikan saat section mendekati
  viewport dan **dilepas penuh** saat menjauh — bukan sekadar dijeda, supaya tidak memegang
  context WebGL nganggur sepanjang halaman di-scroll.

> **Dua pengecualian itu saja.** Tidak ada loop permanen ketiga. Loop yang tidak perlu
> (interpolasi cincin kursor) berhenti sendiri begitu menyatu, bukan berputar selama halaman
> terbuka.

---

## Sistem gerak

Semua gerak lewat paket `motion`, CSS native, `three.js` (dua tempat), atau GSAP (satu
tempat). Gerbangnya satu-satunya: `useMotionMode()` di `src/hooks/useMotionMode.ts`.

| Query | Arti |
|---|---|
| `MQ.rich` | pointer fine **dan** layar ≥1024px. **Satu-satunya tempat kursor, dua WebGL, parallax, dan smooth scroll boleh hidup** |
| `MQ.motion` | Gerak diizinkan (bukan reduced-motion) — masih dipakai `Reveal` dan hover |

`readMotionMode()` memeriksa **perangkat dulu, baru preferensi gerak**, lalu memetakan:
`MQ.rich` cocok → `'rich'` (kecuali reduced-motion → `'reduced'`); kalau tidak → `'simple'`.
Urutan itu yang membuat dua syarat user berlaku sekaligus: HP dengan reduced-motion tetap
`'simple'`, sehingga three.js tidak terunduh. Efeknya, di HP reduced-motion tidak ada
partikel sama sekali — yang tampil `DnaHelix` SVG diam.

1. **Entrance hero (sekali)** — 3 baris headline naik dari mask (`motion.span`,
   `y: 110% → 0`, `DUR.kinetic 1.0s`, delay 0.1/0.28/0.34) + chrome (eyebrow/subteks/CTA)
   fade+up (delay 0.55/0.72/0.84). Tidak ada loop.
2. **Stack kartu — 2 section saja** — `tentang` lalu `perdana`, kartu `position: sticky;
   top: 0; min-height: 100svh; overflow: hidden`, z-index 20/30, radius atas 28px +
   bayangan `0 -24px 60px -24px rgba(0,0,0,0.55)`. Penggulir membuat `perdana` menutupi
   `tentang` — murni CSS, tanpa listener. Enam section lain **tidak** punya efek overlap:
   lima di antaranya pakai garis rambut 1px dalam flow normal, Hero tanpa radius.
3. **Reveal saat scroll (IO)** — `.reveal-group`/`.reveal` disembunyikan di bawah fold dan
   diberi kelas `is-in-view` oleh IntersectionObserver; fade+up 24px, stagger 80ms per anak
   (CSS). Kelas hanya dipasang JS saat `MQ.motion` cocok; tanpa JS semuanya langsung terlihat.
4. **Garis pembatas** — maska horizontal `scaleX: 0 → 1` (bukan scroll-linked) + garis
   progres Cara Ikut `scaleX`/`scaleY` yang mengikuti scroll jendela
   (`useScrollProgress`).
5. **Parallax — tiga simbol matematika** (Σ, φ, f(x)) di Cara Ikut, laju 0.15/0.25/0.35
   plus pergeseran horizontal untuk φ. Mekanismenya `useScroll` + `useTransform` dari
   `motion`, sama dengan parallax ambient hero (rentang scrollY `[0, 1200]`). Murni
   posisi scroll, bukan rotasi otomatis. HANYA `rich`.
6. **Hover elegan** — spotlight kartu, `border`/`background` tombol dan daftar aturan
   berpindah lembut (`transition`, `--ease-elegant`); semuanya di dalam
   `@media (hover: hover) and (pointer: fine)`.
7. **Kursor kustom** — dot `#F6E7B4` 7px **memimpin**: `transform` diset langsung di
   `pointermove`, tanpa delay dan tanpa rAF. Cincin `#D4AF37` 28px **mengejar** dengan
   lerp eksponensial (`1 − exp(−dt/τ)`, τ = 0.4s) di dalam rAF. Persis seperti filosofi
   lerp yang sama dipakai tilt partikel. Loop cincin **berhenti sendiri** begitu menyatu
   (jarak < 0.05px) dan dinyalakan lagi oleh `pointermove` berikutnya — jadi tidak ada loop
   permanen yang tidak diizinkan governance. Hover: cincin ~1.8x + terisi tipis.
8. **Navbar** — transparan di atas → blur + solid + border emas setelah scroll (listener
   rAF dengan throttle waktu + `STALE_MS` yang pulih sendiri). Menu mobile = panel CSS +
   `role="dialog"`, body terkunci, Esc menutup.
9. **Smooth scroll (GSAP)** — lihat bagian di bawah.
10. **Dua WebGL** — partikel DNA di hero dan armillary di Aturan; lihat
    [Ornamen](#ornamen--nol-gambar-raster-webgl-hanya-di-dua-tempat).

### Smooth scroll — bukan `ScrollSmoother`

`useSmoothScroll()` memakai **`gsap.ticker`** sebagai clock, lalu menulis posisi scroll
dengan `window.scrollTo`. Itu sengaja, dan bukan `ScrollSmoother` yang akan lebih mudah.

`ScrollSmoother` (gratis sejak GSAP 3.13) membungkus konten dalam wrapper lalu memberi
`transform: translate3d` ke wrapper itu. Begitu konten berada di dalam elemen yang
di-transform, `position: sticky` **di dalamnya berhenti bekerja** — posisi sticky dihitung
relatif terhadap ancestor scroll terdekat, dan transform menjadikan wrapper itu containing
block baru tanpa scroll container. Seluruh sistem overlap section di halaman ini bergantung
pada sticky, jadi `ScrollSmoother` akan mematikan fitur yang justru sedang diperbaiki.

Alternatifnya adalah memindahkan semua sticky ke `ScrollTrigger` `pin`, tapi itu mengganti
seluruh sistem stacking CSS yang sudah bekerja dan terverifikasi dengan risiko regresi yang
jauh lebih besar daripada manfaat smooth scroll-nya.

GSAP sendiri di-`import()` **dinamis** dengan penampung `ticker` nullable. Impor statis
menambah ~70 kB ke bundle utama yang dibayar semua pengunjung ponsel; setelah dipisah,
bundle utama 400.61 kB dan chunk GSAP berdiri sendiri 70.43 kB. Pengaturan yang dipasang:
`wheel` PASSIVE dengan guard `e.ctrlKey` (zoom browser tidak diambil alih), interpolasi
berhenti saat `|scrollY − target|` di bawah 0.12px, dan scroll native tetap jadi acuan
sehingga `useScrollProgress` serta ScrollTrigger tetap membaca posisi yang benar.

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

`CursorLayer` memakai dua state yang sengaja dipisah:

- **Dot** (7px, `#F6E7B4`): posisinya diset langsung di handler `pointermove` lewat
  `translate3d`, tanpa delay dan tanpa rAF. Dot memimpin.
- **Cincin** (28px, border `#D4AF37`): hanya menyimpan *target*, lalu mengejar dengan lerp
  eksponensial `1 − exp(−dt/τ)` (τ = 0.4s) — tidak tergantung framerate seperti tween berbasis
  delta tetap.

Ketika cincin sudah di dalam 0.05px dari dot, loop-nya **berhenti** (`return` tanpa
menjadwalkan frame berikutnya); `pointermove` berikutnya menyalakannya lagi. Versi pertama
selalu menjadwalkan frame tanpa syarat, dan itu berarti rAF menyala terus selama halaman
terbuka meskipun mouse diam — loop permanen ketiga yang tidak diizinkan governance. `B16`
menguji keduanya: loop aktif saat pointer bergerak, dan **nol** setelah menyatu.

`html[data-cursor-visible]` / `data-cursor-hover` / `data-cursor-pressed` jadi satu-satunya
sumber state CSS (ukuran cincin lewat transisi CSS; margin negatif ikut menyesuaikan agar
pusat cincin tetap di pointer). Portal ke `document.body`, `pointer-events: none`, aktif
hanya di mode `rich`.

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
| Cursor lerp (cincin mengejar dot) | τ `0.4s` (time-based, `1 − e^(−dt/τ)`) | `DUR.cursorTau` |
| Ukuran cincin cursor | `350ms` (CSS, transisi) | CSS `.cursor-ring` |
| Magnet | `450ms` (CSS, transisi) | CSS `.magnetic` |
| Akordeon FAQ | `500ms` (CSS, `grid-template-rows`) | CSS `.faq-panel` |
| Hover (tombol/kartu/tautan) | `300ms` | `--dur-hover` |
| Navbar scroll-state | `500ms` (Tailwind `duration-500`) | `Navbar.tsx` |
| Parallax | hero ambient `0.22 × 90px` (range scroll 1200), DNA `0.16 × 70px` | `PARALLAX` |
| Parallax simbol matematika | Σ `0.15`, φ `0.25` (+ geser horizontal), f(x) `0.35` | `PARALLAX.mathSigma/mathPhi/mathFunction` |
| Partikel DNA hero | rotasi Y `0.05 rad/detik`, tilt lerp `0.05`/frame | `SPIN`, `TILT_*` di `dnaParticles.ts` |

---

## Responsif

Mobile-first, dibuka dengan `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280.

| Breakpoint | Yang berubah |
|---|---|
| <1024px, atau pointer coarse | Mode `simple`: tanpa three.js, tanpa GSAP, tanpa kursor, tanpa parallax, tanpa magnet |
| ≥1024px + pointer fine | Mode `rich`: semua fitur aktif |
| ≥1024px **dan** ≥720px | `tentang` + `perdana` di-pin sebagai kartu bertumpuk |
| ≥1280px | Motif DNA bergeser ke kolom kanan (pusat di 87% lebar) + scrim jadi gradien linear |
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

| File | Ukuran | gzip | Dimuat di HP? |
|---|---|---|---|
| `index.html` | 1.95 kB | 0.88 kB | ya |
| `assets/index-*.css` | 37.42 kB | 8.38 kB | ya |
| `assets/index-*.js` (bundle utama) | 400.71 kB | 126.55 kB | ya |
| `assets/three.module-*.js` | 515.66 kB | 128.16 kB | **tidak** |
| `assets/index-*.js` (chunk GSAP) | 70.43 kB | 27.57 kB | **tidak** |
| `assets/dnaParticles-*.js` | 2.74 kB | 1.45 kB | **tidak** |
| `assets/gyroscope-*.js` | 1.87 kB | 0.98 kB | **tidak** |
| `fonts/cormorant-garamond-latin-var.woff2` | 37.64 kB | — (sudah kompres) | ya |
| `fonts/manrope-latin-var.woff2` | 24.84 kB | — (sudah kompres) | ya |

Ada **empat** chunk async, semuanya `import()` dinamis dan semuanya hanya diminta di mode
`rich`: `three.module` (dipakai bersama oleh kedua scene), `dnaParticles`, `gyroscope`, dan
GSAP. Di HP, total `.js` yang diminta browser adalah **satu file**: `index-*.js`. Itu
dibuktikan oleh rekaman jaringan di `verify.mjs` B11, bukan dibaca dari DOM — DOM hanya bisa
menunjukkan canvas tidak ada, yang tetap benar/skena kalau three.js ikut terpasang di bundle
utama. Total transfer HP ±196 KiB; three.js saja 128 KiB gzip, jadi mustahil ikut masuk.

GSAP diimpor dinamis dengan sengaja. Impor statis akan menambah ~70 kB ke bundle utama yang
dibayar semua pengunjung ponsel; setelah dipisah, bundle utama 400.71 kB dan chunk GSAP
berdiri sendiri 70.43 kB.

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

**`verify.mjs` — 131 cek lulus / 0 gagal** terhadap build yang sama. Ringkasan bagian:

| Bagian | Yang dibuktikan |
|---|---|
| A1–A2 | Statis: three.js & GSAP hanya diimpor di dalam `src/three/`; `--color-gold-bronze: #a17c1b`; tanpa `--font-mono`/Space Mono/`.lenis`; tanpa animasi infinite; stack punya syarat mati di luar layar cukup besar **dan** dimatikan total di reduced-motion |
| B1 | 8 section, z-index 10→80; **maksimal 2** yang di-pin (`tentang` + `perdana`), sisanya garis rambut; isi section ter-pin muat di viewport; `scroll-margin-top` 88px |
| B2 | Headline terpecah 3 baris, teks utuh, "sains" gradien, ambient statis; **partikel benar-benar menggambar** — framebuffer dibaca in-page (lit > 2000, maxLuma > 100) dan pusat motif di **87.7%** lebar layar, jauh dari headline yang berakhir di 864/1440px |
| B3 | Semua reveal terpicu, nol elemen tertinggal opacity 0 |
| B4 | Garis progres `scaleX` tumbuh mengikuti scroll |
| B5 | Parallax tiga simbol matematika (Σ, φ, f(x)) bergeser (≥1024px + fine) |
| B6 | FAQ: item pertama terbuka, `inert` tepat, buka-tutup bergantian, tombol diklik & **tidak tertutup** section ter-pin |
| B7 | Navbar transparan → blur + solid + border emas |
| B8 | Dot memimpin (langsung di `pointermove`), cincin mengejar, cincin berpusat; hover membesar |
| B9 | Magnet mendekat & kembali; `--mx/--my` spotlight; keduanya `hover:fine` saja |
| B10 | Menu tersembunyi di desktop; tanpa scroll horizontal 1440px |
| B11 | Mobile: **rekam jaringan** → hanya 1 file `.js` (bundle utama), nol chunk three.js & GSAP; canvas 3D tidak dibuat; hanya 2 section overlap `-28px`; kursor/magnet mati; menu `dialog`, Esc menutup |
| B12 | Reduced motion: canvas 3D tidak dibuat, ambient tetap ada, relative, tanpa radius/bayangan, teks langsung terbaca, dan **0 animasi CSS berjalan di seluruh halaman** (`document.getAnimations()`) |
| B13 | Sweep 320/375/768/1024/1440: tanpa scroll horizontal, FAQ klikable |
| B14 | **0 exception, 0 `console.error`** |
| B15 | FPS hero **60.3**, FPS giroskop **60.0**; kedua canvas tidak pernah hidup bersamaan (jarak 3071px); **render loop 0 callback** saat semua section 3D jauh, hidup lagi (60.1) setelah kembali ke atas |
| B16 | Interpolasi cincin kursor **aktif** saat pointer bergerak (60 fps) dan **0 callback** setelah menyatu |

**`verify-webgl-off.mjs` — 7 cek lulus / 0 gagal** dengan Chrome dijalankan
`--disable-3d-apis`:

| Cek | Hasil |
|---|---|
| WebGL benar-benar mati (uji valid) | `webgl2=false webgl1=false` |
| Tidak ada canvas three.js di hero | 0 canvas |
| SVG helix fallback muncul | ya |
| SVG helix punya dimensi nyata | 267×560 |
| Headline hero tetap utuh | 24 karakter |
| SVG helix diam | 0 animasi |
| Nol error console | bersih |

### Lighthouse (Mobile, headless Chrome)

| Kategori | Skor |
|---|---|
| Performance | **66 / 69 / 70** (3 run berturut; median **69**) |
| Accessibility | 96 |
| Best practices | 100 |
| SEO | 91 |

Tiga kategori selain Performance **stabil persis** di setiap run. Performance naik dari 61
(median 3 run sebelum revisi ini) ke 69, dan tetap berfluktuasi mengikuti beban CPU host.

Rincian performance (run terbaik dari 3) — **empat dari lima metrik sudah sehat, satu tidak**:

| Metrik | Nilai | Skor | Bobot |
|---|---|---|---|
| FCP | 1.8 s | 90 | 10 |
| LCP | 2.3 s | 93 | 25 |
| CLS | 0 | 100 | 25 |
| Speed Index | 4.0 s | 81 | 10 |
| **TBT** | **1330 ms** | **17** | **30** |

**TBT adalah satu-satunya penahan, dan ini batas arsitektur, bukan bug.** Seluruh TBT
berasal dari satu long task: mount React 19 + `motion`.

> **Bukti bahwa TBT itu bukan dari fitur 3D yang baru.** Rincian main thread dari run
> terbaik: `scriptEvaluation` 1426 ms, dan **seluruhnya** berasal dari satu file,
> `index-*.js` (bundle utama). Bootup time file itu 2603 ms; tidak ada file lain yang
> muncul di daftar. Total transfer seluruh halaman ±196 KiB, sedangkan three.js saja
> 128 KiB gzip dan GSAP 27.6 KiB — secara aritmetika tidak mungkin keduanya ikut masuk.
> Ini cocok dengan rekaman jaringan B11: di HP, browser hanya meminta satu `.js`.
> Jadi features WebGL dan smooth scroll **nol** kontribusi terhadap TBT mobile.

Diukur tanpa throttling, satu muat halaman ini butuh ~180–340 ms `ScriptDuration` untuk
362 node DOM; Lighthouse mensimulasikan CPU 4× lebih lambat, jadi task yang sama muncul
sebagai ~1–1.4 s. Untuk skor TBT ≥ 90 (≈ ≤ 200 ms) pekerjaan JS riil harus turun ke bawah
~50 ms, dan itu tidak mungkin dicapai oleh mount React + `motion` tanpa mengganti
arsitekturnya.

**Biaya scene WebGL diukur langsung di browser, bukan dari selisih TBT** — pengukuran TBT
sendiri terlalu bising di mesin ini untuk menyimpulkan apa pun:

| Skenario | Hasil terukur |
|---|---|
| Partikel hero aktif, 1440×900 | 60.3 fps |
| Giroskop Aturan aktif, 1440×900 | 60.0 fps |
| Kedua scene hidup bersamaan | **tidak pernah terjadi** — jaraknya 3071px, rentang tumpang-tindih −2711px |
| Semua section 3D jauh dari viewport | **0 callback rAF** (loop benar-benar berhenti) |
| Kembali ke atas | 60.1 fps (loop hidup lagi) |

Keduanya mengikat frame 60 fps penuh di headless, jadi tidak ada satu pun yang memakai
buang frame. Dan tidak ada lagi loop rAF permanen ketiga: interpolasi cincin kursor juga
diukur (aktif saat bergerak, 0 setelah menyatu).

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
3. **Scroll** — `html { scroll-behavior: smooth }` untuk tautan anchor, dan pada mode `rich`
   `useSmoothScroll()` mengambil alih dengan GSAP (`gsap.ticker` + `window.scrollTo`).
   Scroll **tetap native** — yang diinterpolasi hanya nilai `scrollY`, tidak ada transform
   pada wrapper konten, jadi `position: sticky` tetap bekerja. Di mode `simple` dan
   `reduced`, scroll dibiarkan sepenuhnya native; reduced-motion memaksa `auto`.
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
8. **three.js vanilla, bukan `@react-three/fiber`** — supaya importer, tree-shaking, dan
   dynamic import-nya dikontrol langsung, tanpa menambah runtime React di dalam canvas.
   three.js **hanya** diimpor di dalam `src/three/`, dan modul itu **hanya** di-`import()`
   dari cabang `mode === 'rich'`. Mode `simple` dan `reduced` tidak pernah mencapai baris
   itu, jadi chunk-nya bukan sekadar "tidak dieksekusi" — benar-benar tidak pernah diminta
   di jaringan. `verify.mjs` A1 memeriksa batas path itu secara statis, B11 memverifikasi
   di level jaringan.
9. **`ScrollSmoother` GSAP sengaja tidak dipakai.** Ia membungkus konten lalu memberi
   `transform: translate3d` ke wrapper, dan konten di dalam elemen ber-transform kehilangan
   `position: sticky` — yang seluruh sistem overlap section ini bergantung padanya. Alasan
   lengkap di [Smooth scroll](#smooth-scroll--bukan-scrollsmoother).
10. **Dua pengecualian infinite-loop resmi**, dan hanya dua: rotasi partikel DNA di hero
    (0.05 rad/detik) dan giroskop armillary di Aturan. Keduanya hanya di mode `rich`, keduanya
    punya jalur berhenti (IO + `visibilitychange`), dan keduanya punya fallback saat WebGL
    ditolak. Tidak ada pengecualian ketiga: cincin kursor, tilt partikel, dan smooth scroll
    semuanya berhenti sendiri saat tidak ada yang berubah.
