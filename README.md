# Helixa Olympiad — Landing Page

Landing page satu halaman untuk **Helixa Olympiad**, olimpiade online Matematika & Biologi
untuk siswa SMA di Indonesia. Static site, tanpa backend, siap deploy ke Vercel / Netlify /
Cloudflare Pages.

Prinsip desain: **LESS IS MORE**. Kalau ragu, kurangi.

---

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output ke dist/
npm run preview  # cek hasil build
```

## Perintah verifikasi

```bash
npm run check            # build + spec + responsif + interaksi (butuh dev/preview aktif)
npm run check:spec       # 67 cek kepatuhan desain
npm run check:responsive # 11 viewport: overflow, teks terpotong, target sentuh
npm run check:interaction# 59 cek perilaku: menu, FAQ, navbar, keyboard, reduced-motion
```

Skrip audit memakai Chrome DevTools Protocol lewat WebSocket bawaan Node — tanpa
Puppeteer/Playwright, jadi tidak menambah dependency. Jalankan dengan dev server
(`npm run dev`, port 5173) atau preview build (`npm run preview`, port 4173) aktif:

```bash
node scripts/audit.mjs             # default http://localhost:5173/
node scripts/audit.mjs http://localhost:4173/
```

> **Catatan:** headless Chrome default-nya `prefers-reduced-motion: reduce`. Kedua skrip
> memaksa `no-preference` supaya animasi benar-benar diuji; mode reduced-motion diuji
> terpisah di `interaction-check.mjs`.

---

## Struktur folder

```
Helixa Olympiad/
├─ index.html              # font preconnect, viewport-fit=cover, meta
├─ package.json
├─ vite.config.ts
├─ tsconfig.json / tsconfig.app.json / tsconfig.node.json
├─ public/
│  └─ favicon.svg          # ikon emas, SVG tulen
├─ scripts/
│  ├─ audit.mjs             # 11 viewport + deteksi overflow/terpotong/target sentuh
│  ├─ spec-check.mjs        # 67 cek kepatuhan token, tipografi, animasi, larangan
│  └─ interaction-check.mjs # 59 cek menu, FAQ, navbar, keyboard, reduced-motion
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ index.css            # design tokens, base, utilitas
   ├─ content.ts           # SEMUA teks + REGISTER_URL + INSTAGRAM_URL
   ├─ vite-env.d.ts
   ├─ hooks/
   │  ├─ useReducedMotion.ts
   │  └─ useParallax.ts
   └─ components/
      ├─ MotionProvider.tsx
      ├─ Navbar.tsx
      ├─ Hero.tsx
      ├─ WhyHelixa.tsx
      ├─ PerdanaInfo.tsx
      ├─ HowToJoin.tsx
      ├─ JudgesPartners.tsx
      ├─ RulesTransparency.tsx
      ├─ Faq.tsx
      ├─ ClosingCta.tsx
      ├─ Footer.tsx
      ├─ ornaments/
      │  ├─ DnaHelix.tsx
      │  ├─ MathSymbols.tsx
      │  └─ GrainOverlay.tsx
      └─ ui/
         ├─ Section.tsx
         ├─ Reveal.tsx
         ├─ Eyebrow.tsx
         ├─ Placeholder.tsx
         └─ Buttons.tsx
```

---

## Mengedit konten

**Semua teks ada di `src/content.ts`.** Tidak perlu menyentuh komponen.

| Yang diubah | Di mana |
|---|---|
| Link pendaftaran | `REGISTER_URL` |
| Link Instagram | `INSTAGRAM_URL` |
| Navbar, hero, seluruh section | objek `NAV_LINKS`, `HERO`, `WHY`, `PERDANA`, `HOW_TO_JOIN`, `JUDGES`, `RULES`, `FAQ`, `CLOSING`, `FOOTER` |

Nilai `REGISTER_URL` dan `INSTAGRAM_URL` masih `"#"` (placeholder). Ganti dengan URL asli
sebelum publish.

### Placeholder yang perlu diganti

Dicari dengan `grep -n "\[ISI" src/content.ts`:

- `PERDANA.details` → Pendaftaran, Pelaksanaan, Pengumuman, Hadiah
- `JUDGES.items` → nama juri/mitra, jabatan, peran
- `FOOTER.contact` → email/WhatsApp

Semua placeholder tampil dengan **border putus-putus emas** (`src/components/ui/Placeholder.tsx`)
supaya mudah terlihat di halaman maupun di panel teks.

### Aturan konten

Jangan menambahkan klaim, nama orang, tanggal, jumlah peserta, testimoni, atau frasa seperti
"resmi nasional", "terakreditasi", "bekerja sama dengan pemerintah/Kemendikdasmen".
Pernyataan independen di `RULES.items` wajib dipertahankan.

---

## Design tokens

Didefinisikan di blok `@theme` pada `src/index.css`.

| Token | Nilai | Pakai untuk |
|---|---|---|
| `--color-ink` | `#0A0A0B` | Background utama (~80%) |
| `--color-surface` | `#121214` | Kartu |
| `--color-gold-light` | `#F6E7B4` | Emas terang |
| `--color-gold` | `#D4AF37` | Emas utama, aksen (~10%) |
| `--color-gold-dark` | `#A17C1B` | Emas gelap |
| `--color-bone` | `#F4EFE4` | Teks utama (gading) |
| `--color-bone-dim` | `#A39E92` | Teks sekunder |
| `--color-gold-line` | `rgba(212,175,55,0.16)` | Garis / border kartu |
| `--font-display` | Cormorant Garamond 500/600 | Heading ≥ 28px saja |
| `--font-sans` | Manrope 400/500/600 | Isi & UI, 17–18px |
| `--ease-elegant` | `cubic-bezier(0.22,1,0.36,1)` | Reveal & panel |

Gradasi emas: `linear-gradient(135deg, #F6E7B4 0%, #D4AF37 45%, #A17C1B 100%)`.
Hanya dipakai di **tiga tempat**: satu kata `sains` di headline hero, tombol utama
(`.bg-gold-gradient`), dan garis dekoratif tipis (`.gold-rule`).

### Tipografi

Fluid, berbasis `clamp()`:

- Hero `h1` — `clamp(2.5rem, 8vw, 5.5rem)`
- `h2` section — `clamp(1.875rem, 4vw, 3rem)`
- Isi — `1rem` (ponsel) → `1.0625rem` (≥1024px), `line-height: 1.7`
- Eyebrow — 12–13px, kapital, `letter-spacing: 0.18em`, warna emas

Cormorant Garamond hanya untuk teks ≥ 28px karena goresannya tipis.

### Layout

- Lebar konten maks **1120px** (`.shell`), padding horizontal 20px (ponsel) → 32px (≥768px)
- Padding vertikal section **72px** (ponsel) / **96px** (≥768px) / **120px** (≥1024px)
- Kartu: `radius 16px` (`rounded-2xl`), bg `#121214`, border 1px emas 16% alpha, tanpa shadow tebal
- Pemisah antar section: garis emas tipis 1px (`.hairline`), bukan blok warna kontras
- Semua section dibungkus `overflow-x-clip` → tidak ada scroll horizontal sejak 320px

---

## Ornamen

Tanpa gambar stok atau aset eksternal. Semuanya SVG/CSS tulen.

| Komponen | Isi | Letak |
|---|---|---|
| `DnaHelix` | Dua untai sinusoidal berpelintir + anak tangga | Hero. Ponsel: di belakang teks, `opacity 0.10`. Desktop (≥1024px): sisi kanan, `opacity 0.30` |
| `MathSymbols` | Σ, π, ∫, φ | Latar section "Kenapa Helixa", desktop saja, `opacity 0.06` |
| `GrainOverlay` | `feTurbulence` data-URI | `fixed inset-0`, `opacity 0.035`, `pointer-events-none` |

Cahaya hero: `radial-gradient` emas `.hero-glow`, opacity efektif `0.60 × 0.16 ≈ 0.10` di ponsel
dan `0.16` di desktop. Grain `0.035`. Keduanya di bawah batas yang diminta.

---

## Animasi — tepat 5 jenis

1. **Hero load** — `m.*` dari `motion/react`; headline, subteks, tombol muncul berurutan
   (fade + naik 24px, jeda 100ms, sekali saja).
2. **Scroll reveal** — `IntersectionObserver` threshold `0.15`, durasi `700ms`,
   `cubic-bezier(0.22,1,0.36,1)`, sekali saja (observer di-disconnect), stagger `80ms` di grid
   lewat `--reveal-delay` (`src/components/ui/Reveal.tsx`).
3. **Parallax halus** — hanya di **dua** tempat: (a) heliks + cahaya emas di hero,
   (b) simbol dekoratif di "Kenapa Helixa". `src/hooks/useParallax.ts`: hanya
   `transform: translate3d()`, faktor ~0.2, clamp 60px, aktif hanya ≥1024px **dan**
   `(pointer: fine)`, `requestAnimationFrame` + listener pasif.
4. **Hover elegan** (300ms ease-out) — kartu naik 4px + border menguat + glow
   `0 12px 40px -12px rgba(212,175,55,0.25)`; tombol utama gradasi bergeser + panah +4px;
   link navbar garis bawah emas tumbuh dari kiri; tombol sekunder terisi tipis.
5. **Navbar** — transparan di atas, setelah scroll 40px menjadi
   `rgba(10,10,11,0.72)` + `backdrop-blur` + garis bawah emas tipis.

### `prefers-reduced-motion`

- `useReducedMotion()` mengembalikan `true` → `Reveal` langsung tampil, `useParallax` tidak
  memasang listener sama sekali, animasi hero dimatikan, panel menu tidak bertransisi.
- Blok `@media (prefers-reduced-motion: reduce)` di `index.css` memaksa semua
  `transition-duration`/`animation-duration` jadi `0.01ms` dan `scroll-behavior: auto`.

### Dilarang (dan tidak ada di kode ini)

Partikel · cursor kustom · scroll-jacking · marquee · tilt 3D · animasi berulang tanpa henti ·
glassmorphism di semua tempat · bounce/spring berlebihan · emoji · slider/carousel.

---

## Responsif

Mobile-first. Gaya dasar untuk layar kecil, diperluas dengan `sm` 640 · `md` 768 ·
`lg` 1024 · `xl` 1280.

| Section | <640px | ≥640px | ≥768px | ≥1024px |
|---|---|---|---|---|
| Navbar | wordmark + hamburger 44px, panel layar penuh | — | link + tombol "Daftar" | sama |
| Hero | 1 kolom, rata tengah, 2 tombol menumpuk | tombol berdampingan | — | 2 kolom, teks kiri, ornamen kanan |
| Kenapa Helixa | 1 kolom | 2 kolom | 2 kolom | 4 kolom |
| Info Perdana | `<dl>` bertumpuk, label atas nilai | — | 2 kolom label–nilai (bukan tabel) | 2 kolom + sidebar |
| Cara Ikut | vertikal + garis penghubung | vertikal | vertikal | horizontal 4 kolom |
| Juri & Mitra | 1 kolom, avatar di tengah | 2 kolom | 2 kolom | 3 kolom |
| Aturan | 1 kolom, `max-w-[65ch]` | — | — | — |
| FAQ | 1 kolom penuh, judul min 56px | — | — | — |
| CTA + Footer | tumpuk, rata tengah | tombol berdampingan | — | sejajar |

Detail penting:

- **`svh`, bukan `vh`** — hero `min-h-svh` agar tidak lompat saat address bar HP naik-turun.
- **Landscape ponsel** — `@media (orientation: landscape) and (max-height: 500px)` membuat hero
  `min-height: auto` dengan padding wajar, dan menyembunyikan petunjuk scroll.
- **Safe area iPhone** — `<meta name="viewport" content="..., viewport-fit=cover">`; navbar memakai
  `env(safe-area-inset-top)`, panel menu dan footer memakai `env(safe-area-inset-bottom)`.
- **Target sentuh ≥ 44px** — semua tombol `min-h-11`, tombol hamburger 44×44, judul FAQ
  `min-h-14` (56px).
- **Hover vs sentuh** — semua efek hover untuk kartu dan tautan dibungkus
  `@media (hover: hover) and (pointer: fine)`. Di perangkat sentuh dipakai
  `:active` ringan: `.btn:active { transform: scale(0.98) }` dan
  `.card-hover:active { translateY(-2px) + border menguat }`.
- **Zoom 200%** — tidak ada tinggi tetap yang menahan teks; semua ukuran teks fluid.

### Menu mobile

`role="dialog"` `aria-modal`, `aria-expanded` + `aria-controls` pada tombol, focus trap
sederhana (siklus Tab/Shift+Tab di dalam panel), fokus awal ke elemen pertama, `Esc` menutup,
klik link menutup, scroll body dikunci (termasuk kompensasi scrollbar agar tidak layout shift),
fokus dikembalikan ke tombol pemicu saat ditutup. Ikon hamburger berubah jadi `✕`.

### FAQ

`<button>` native dengan `aria-expanded` + `aria-controls`. Tinggi buka-tutup dianimasikan
dengan `grid-template-rows: 0fr → 1fr` (transisi tinggi CSS murni, tanpa JS) plus `inert` pada
panel tertutup agar kontennya tidak terbaca screen reader.

---

## Deploy

```bash
npm run build   # -> dist/
```

`dist/` adalah static site murni, tanpa adapter server. Ketiganya langsung bisa:

- **Vercel** — build `npm run build`, output `dist`
- **Netlify** — build `npm run build`, publish `dist`
- **Cloudflare Pages** — build `npm run build`, output directory `dist`

Hanya anchor (`#tentang` dll) dan tombol eksternal, jadi tidak perlu aturan rewrite.

---

## Hasil verifikasi

Semua diukur terhadap **production build** (`npm run build` → `npm run preview`),
bukan dev server.

| Lebar | Shell | Hero | Scroll horizontal | Teks terpotong | Target < 44px |
|---|---|---|---|---|---|
| 320 | 320px | 720/720 | tidak ada | tidak ada | tidak ada |
| 375 | 375px | 812/812 | tidak ada | tidak ada | tidak ada |
| 430 | 430px | 932/932 | tidak ada | tidak ada | tidak ada |
| 768 | 768px | 1024/1024 | tidak ada | tidak ada | tidak ada |
| 1024 | 1024px | 768/768 | tidak ada | tidak ada | tidak ada |
| 1280 | 1120px | 800/800 | tidak ada | tidak ada | tidak ada |
| 1440 | 1120px | 900/900 | tidak ada | tidak ada | tidak ada |
| 1920 | 1120px | 1080/1080 | tidak ada | tidak ada | tidak ada |
| landscape 844×390 | 844px | 489 (tidak dipaksa 100svh) | tidak ada | tidak ada | tidak ada |
| landscape 740×360 | 740px | 481 (tidak dipaksa 100svh) | tidak ada | tidak ada | tidak ada |
| landscape 1024×768 | 1024px | 768/768 | tidak ada | tidak ada | tidak ada |

Catatan:
- Padding section terukur **72px** (375px) → **96px** (768px) → **120px** (1280px).
- Konten terkunci di **1120px** mulai 1280px ke atas dan tetap terpusat di 1920px.
- Portrait dan landscape sudah diuji untuk ukuran ponsel (320–430) dan tablet
  (768 / 1024).
- Screenshot full-page tiap lebar ada di `screenshots/` (di-git-ignore).

**Total: 67/67 cek spec + 59/59 cek interaksi + 11/11 viewport bersih.**

Yang ikut terverifikasi otomatis:
- Navigasi keyboard: urutan tab mulai dari skip link, semua link navbar terjangkau, 12/12 elemen
  punya cincin fokus emas.
- Menu hamburger: `aria-expanded`, `aria-controls`, `role="dialog"`, `aria-modal`, focus trap,
  scroll lock, `Esc`, klik link menutup, fokus kembali ke pemicu.
- FAQ: accordion tunggal, tinggi 0px saat tertutup, `inert` saat tertutup, judul 107px.
- Navbar: transparan di atas → alpha 0.72 + `blur(12px)` + garis bawah `rgba(212,175,55,0.16)`
  setelah scroll.
- `prefers-reduced-motion: reduce`: 29 elemen `.reveal` tetap `opacity: 1`, parallax tidak
  memasang transform, `scroll-behavior: auto`.
- Gradasi emas hanya di 3 konsep: kata "sains", tombol utama, garis dekoratif.
- Tidak ada `<canvas>`, `<img>`, `<video>`, `<iframe>`, emoji, marquee, cursor kustom,
  animasi `infinite`, atau `<table>`.
- Tidak ada teks serif (Cormorant) di bawah 28px.
- Tidak ada klaim terlarang ("resmi nasional", "terakreditasi", "Kemendikdasmen", dll);
  pernyataan independen tetap ada.

---

## Catatan asumsi

1. **Paket `motion` dipakai lokal**, bukan `LazyMotion` penuh. `MotionProvider` memuat
   `domAnimation` sehingga bundel tetap ramping (≈106 kB gzip).
2. **Tailwind v4** dengan plugin `@tailwindcss/vite` — token ditulis di blok `@theme`, tidak
   ada `tailwind.config.js`. Karena itu nilai spacing dinamis (`py-18`, `py-24`, `py-30`)
   tersedia tanpa konfigurasi tambahan: `18 × 0.25rem = 72px`, `24 × = 96px`, `30 × = 120px`.
3. **Font dimuat dari Google Fonts** dengan `preconnect` + `display=swap` (bukan `@fontsource`),
   sesuai opsi yang diberikan. Kalau situs perlu Fully offline-first, ganti ke `@fontsource`.
4. **`h-18` navbar** = 72px (desktop), `h-16` = 64px (ponsel).
5. **`FOOTER.privacy`** diarahkan ke `#daftar` karena belum ada halaman kebijakan tersendiri;
   ganti dengan URL lengkap bila tersedia.
6. **Link `#` di `REGISTER_URL` / `INSTAGRAM_URL`** sengaja dibiarkan sebagai placeholder
   agar tidak ada tautan palsu yang terpublished.
7. **Tidak ada klaim kemitraan** dengan pemerintah/instansi mana pun, sesuai batasan konten.
