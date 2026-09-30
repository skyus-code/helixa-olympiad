/* ==========================================================================
   KONTEN — SATU-SATUNYA sumber teks untuk seluruh situs.
   Edit file ini tanpa menyentuh komponen.
   ========================================================================== */

/* --------------------------------------------------------------------------
   TAUTAN — ganti "#" dengan URL asli.
   -------------------------------------------------------------------------- */

export const REGISTER_URL = '#';
export const INSTAGRAM_URL = 'https://www.instagram.com/helixa.olim/?hl=en';

/* --------------------------------------------------------------------------
   NAVBAR
   -------------------------------------------------------------------------- */

export const SITE = {
  wordmark: 'Helixa',
  wordmarkSuffix: 'Olympiad',
  copyrightYear: 2026,
} as const;

export const NAV_LINKS = [
  { label: 'Tentang', href: '#tentang' },
  { label: 'Perdana', href: '#perdana' },
  { label: 'Aturan', href: '#aturan' },
  { label: 'FAQ', href: '#faq' },
] as const;

export const NAV_CTA = {
  label: 'Daftar',
  href: REGISTER_URL,
} as const;

/* --------------------------------------------------------------------------
   HERO
   -------------------------------------------------------------------------- */

export const HERO = {
  eyebrow: 'Olimpiade Online · Matematika & Biologi · SMA',
  headlineLead: 'Asah nalar. Kuasai',
  headlineAccent: 'sains',
  headlineTail: '.',
  subtext:
    'Helixa Olympiad adalah olimpiade online untuk siswa SMA yang fokus pada Matematika dan Biologi, dengan pembahasan lengkap dan laporan kemampuan per siswa.',
  primaryCta: 'Daftar Olimpiade Perdana',
  primaryCtaHref: REGISTER_URL,
  secondaryCta: 'Pelajari Lebih Lanjut',
  secondaryCtaHref: '#tentang',
  scrollHint: 'Gulir untuk mengenal Helixa',
} as const;

/* --------------------------------------------------------------------------
   KENAPA HELIXA
   -------------------------------------------------------------------------- */

export const WHY = {
  eyebrow: 'Tentang',
  title: 'Kenapa Helixa',
  lead: 'Empat hal yang kami pilih untuk membuat latihan ini benar-benar berguna.',
  items: [
    {
      number: '01',
      title: 'Fokus dua mapel',
      body: 'Matematika dan Biologi, disusun khusus untuk SMA.',
    },
    {
      number: '02',
      title: 'Pembahasan lengkap',
      body: 'Setiap soal dibahas, bukan sekadar skor.',
    },
    {
      number: '03',
      title: 'Laporan per siswa',
      body: 'Ringkasan bab yang sudah kuat dan yang perlu diperkuat, berguna untuk persiapan OSN.',
    },
    {
      number: '04',
      title: 'Transparan',
      body: 'Aturan, penilaian, dan hasil dipublikasikan terbuka.',
    },
  ],
} as const;

/* --------------------------------------------------------------------------
   OLIMPIADE PERDANA
   -------------------------------------------------------------------------- */

export const PERDANA = {
  eyebrow: 'Edisi Perdana',
  title: 'Helixa Olympiad Perdana',
  lead: 'Edisi pertama kami. Gratis, terbuka untuk siswa SMA/MA/SMK di seluruh Indonesia.',
  details: [
    { label: 'Bidang', value: 'Matematika dan Biologi (pilih satu)', placeholder: false },
    { label: 'Peserta', value: 'siswa SMA/MA/SMK sederajat', placeholder: false },
    { label: 'Biaya', value: 'Gratis (edisi perdana)', placeholder: false },
    { label: 'Pendaftaran', value: '[ISI TANGGAL]', placeholder: true },
    { label: 'Pelaksanaan', value: '[ISI TANGGAL], online', placeholder: true },
    { label: 'Pengumuman', value: '[ISI TANGGAL]', placeholder: true },
    {
      label: 'Hadiah',
      value: 'e-sertifikat untuk semua peserta; [ISI JIKA ADA]',
      placeholder: false,
    },
  ],
  ctaLabel: 'Daftar Olimpiade Perdana',
  ctaHref: REGISTER_URL,
} as const;

/* --------------------------------------------------------------------------
   CARA IKUT
   -------------------------------------------------------------------------- */

export const HOW_TO_JOIN = {
  eyebrow: 'Cara Ikut',
  title: 'Cara ikut',
  lead: 'Empat langkah sederhana dari sekarang sampai Anda melihat hasil.',
  steps: [
    { number: '01', title: 'Daftar', body: 'Isi formulir online.' },
    {
      number: '02',
      title: 'Ikuti simulasi',
      body: 'Tautan ujian dan panduan teknis lewat grup peserta.',
    },
    {
      number: '03',
      title: 'Kerjakan',
      body: 'Ujian online dengan waktu terbatas sesuai aturan.',
    },
    {
      number: '04',
      title: 'Lihat hasil',
      body: 'Peringkat, pembahasan, dan sertifikat setelah pengumuman.',
    },
  ],
} as const;

/* --------------------------------------------------------------------------
   JURI & MITRA
   -------------------------------------------------------------------------- */

export const JUDGES = {
  eyebrow: 'Juri & Mitra',
  title: 'Juri & Mitra',
  lead: 'Komposisi kegiatan kami. Identitas lengkap akan diumumkan menjelang pelaksanaan.',
  items: [
    {
      kind: 'juri' as const,
      monogram: 'A',
      name: '[Nama Juri/Penyusun Soal]',
      role: '[Jabatan, instansi, bukti kredensial]',
    },
    {
      kind: 'juri' as const,
      monogram: 'B',
      name: '[Nama Juri/Penyusun Soal]',
      role: '[Jabatan, instansi, bukti kredensial]',
    },
    {
      kind: 'mitra' as const,
      monogram: 'C',
      name: '[Mitra Sekolah/Komunitas]',
      role: '[Peran dalam kegiatan]',
    },
  ],
} as const;

/* --------------------------------------------------------------------------
   ATURAN & TRANSPARANSI
   -------------------------------------------------------------------------- */

export const RULES = {
  eyebrow: 'Aturan & Transparansi',
  title: 'Aturan & Transparansi',
  lead: 'Hal-hal ini kami buka sejak awal, supaya tidak ada kejutan di tengah kegiatan.',
  items: [
    'Soal orisinal dan direview sebelum dipakai.',
    'Penilaian otomatis; sanggahan soal diterima dalam waktu yang ditentukan dan dijawab terbuka.',
    'Kecurangan berujung diskualifikasi, sesuai aturan yang diumumkan sebelum lomba.',
    'Data pribadi hanya dipakai untuk penyelenggaraan, tidak dijual atau dibagikan.',
    'Helixa adalah penyelenggara independen dan tidak berafiliasi dengan lembaga pemerintah.',
  ],
} as const;

/* --------------------------------------------------------------------------
   FAQ
   -------------------------------------------------------------------------- */

export const FAQ = {
  eyebrow: 'FAQ',
  title: 'Pertanyaan umum',
  lead: 'Kalau tidak ada di sini, tanyakan lewat kontak resmi kami.',
  items: [
    {
      question: 'Apakah benar-benar gratis?',
      answer:
        'Ya, untuk edisi Perdana. Kalau nanti ada biaya, akan diumumkan jelas sebelum pendaftaran dibuka.',
    },
    {
      question: 'Apakah Helixa sama dengan OSN?',
      answer:
        'Bukan. OSN diselenggarakan pemerintah. Helixa independen dan bisa dipakai sebagai latihan.',
    },
    {
      question: 'Perangkat apa yang dibutuhkan?',
      answer:
        'Laptop atau ponsel dengan internet stabil; laptop lebih direkomendasikan.',
    },
    {
      question: 'Bagaimana kalau ada soal yang keliru?',
      answer:
        'Kirim sanggahan lewat kontak resmi; akan ditinjau dan hasilnya diumumkan.',
    },
    {
      question: 'Apakah ada jenjang SMP dan SD?',
      answer:
        'Belum. Mulai dari SMA agar kualitas matang, lalu diperluas bertahap.',
    },
  ],
} as const;

/* --------------------------------------------------------------------------
   CTA PENUTUP & FOOTER
   -------------------------------------------------------------------------- */

export const CLOSING = {
  eyebrow: 'Pendaftaran',
  title: 'Siap ikut?',
  lead: 'Gratis untuk edisi Perdana. Daftar lewat formulir online atau ikuti kami di Instagram.',
  primaryCta: 'Formulir Pendaftaran',
  primaryCtaHref: REGISTER_URL,
  secondaryCta: 'Instagram',
  secondaryCtaHref: INSTAGRAM_URL,
} as const;

export const FOOTER = {
  contact: '[email/WhatsApp]',
  privacy: 'Kebijakan Privasi',
  note: 'Helixa adalah penyelenggara independen.',
} as const;
