/**
 * Scene 3D untuk latar hero — heliks DNA dengan satelit yang mengorbit.
 *
 * Renderer sendiri di atas Canvas 2D, BUKAN three.js dan bukan WebGL.
 * Alasannya:
 *
 *  - Isi visualnya sederhana: dua untai heliks, tangga emas di antaranya,
 *    satu cincin penanda, satu bola satelit yang mengorbit, dan serbuk
 *    partikel. Semuanya cuma titik dan garis — tidak butuh engine, material,
 *    sistem pencahayaan, atau loader shader.
 *  - three.js menambah sekitar 150 kB gzip beserta loop render yang tidak bisa
 *    dimatikan. Scene ini nol dependency: tidak ada biaya bundle dan tidak ada
 *    permintaan jaringan tambahan.
 *  - WebGL bisa ditolak (GPU blocklist, driver tua, context lost). Canvas 2D
 *    hampir tidak pernah gagal, dan kalau `getContext` benar-benar mengembalikan
 *    null, fungsi ini melempar error sehingga pemanggil bisa jatuh ke ambient
 *    glow CSS.
 *
 * Matematikannya tetap 3D sungguhan: titik dihitung di ruang koordinat 3D,
 * diputar pada sumbu Y lalu X, diproyeksikan perspektif, lalu diurutkan
 * berdasarkan kedalaman sebelum digambar. `globalCompositeOperation = 'lighter'`
 * dipakai supaya cahaya yang bertumpuk saling menambahkan, seperti penjumlahan
 * warna di dalam shader.
 *
 * Loop render berada di luar React, jadi re-render komponen lain (mis. saat
 * FAQ dibuka) tidak menyentuh canvas sama sekali.
 *
 * Pemanggil bertanggung jawab atas reduced-motion: jangan panggil ini kalau
 * `MQ.motionScene` tidak cocok.
 */

export interface SceneHandle {
  dispose(): void;
  /** Pointer ternormalisasi -1..1 relatif terhadap tengah viewport. */
  setPointer(nx: number, ny: number): void;
  /** Progress scroll 0..1 untuk satu viewport pertama. */
  setScroll(p: number): void;
}

type RGB = [number, number, number];
type P3 = { x: number; y: number; z: number };

/* ---------------------------------------------------------------------------
   PARAMETER
   ------------------------------------------------------------------------ */

/*
 * Bentuk scene, dalam satuan ruang.
 *
 * Angka di sini bukan pilihan estetika semata — semuanya harus muat di dalam
 * satu kotak yang lebih kecil daripada kanvas. Scene menggambar memakai
 * perspektif, jadi lebar di layar selalu lebih besar daripada ukuran ruangnya:
 * titik paling depan diregangkan FOCAL/(FOCAL - z) kali. Untuk z = -1.35 dan
 * FOCAL = 6, itu 1,29 kali. Batas yang dipakai di `draw()` sudah memperhitungkan
 * faktor itu (lihat SCALE_OF_HEIGHT), jadi tidak ada bagian yang terpotong
 * tepi kanvas.
 */
const HEIGHT = 2.2;
const RADIUS = 0.55;
const TURNS = 3.1;
const RUNGS = 15;
const PARTICLES = 64;

/** Setengah sisi kotak partikel. Lebih sempit dari heliks supaya serbuk
 *  hanya jadi tekstur, bukan pesaing utama. */
const P_HALF_X = 1;
const P_HALF_Y = 1.35;
const P_HALF_Z = 0.9;

/** Setengah tinggi scene dalam satuan ruang, termasuk ayunan satelit. */
const SCENE_HALF = 1.35;

/** Perspektif. Makin besar, makin datar (makin kecil regangan ke depan). */
const FOCAL = 6;

/** Porsi tinggi kanvas yang boleh dipakai scene. Dikali dua = 86% tinggi. */
const FILL = 0.43;

/** Regangan perspektif titik paling depan terhadap ukuran ruangnya. */
const STRETCH = FOCAL / (FOCAL - SCENE_HALF);

/** Titik per untai. Makin banyak makin halus, makin mahal tiap frame. */
const PER_STRAND = 130;

/** Kecepatan putaran untai (radian per detik). */
const SPIN = 0.34;

/** Radius orbit satelit, kecepatannya, serta ayunan vertikalnya. */
const SAT_RADIUS = 1;
const SAT_SPEED = 0.85;
const SAT_LIFT = 0.25;
const SAT_BOB = 0.3;

/**
 * Skala = tinggi kanvas x faktor ini. Dihitung, bukan ditebak: agar scene
 * mengisi tepat FILL dari tinggi kanvas setelah regangan perspektif.
 *
 * Mengubahnya berarti mengubah proporsi scene terhadap teks, jadi angkanya
 * diuji lewat scripts/_hero.mjs (lihat `fillY`, harus <= 0,88).
 */
const SCALE_OF_HEIGHT = FILL / (SCENE_HALF * STRETCH);

/**
 * Lebar layar minimum yang mendapat komposisi "objek di kanan". Di bawah ini
 * headline sudah memenuhi layar, jadi objek dipindah ke tengah dan diredupkan.
 * Nilainya WAJIB sama dengan breakpoint `.hero-scrim` di index.css — kalau
 * scrim dan scene tidak sepakat soal kapan bergeser, teks jadi tertutup atau
 * objeknya menggantung di tengah ruang kosong.
 */
const WIDE_AT = 1280;

const GOLD_BRIGHT: RGB = [246, 231, 180];
const GOLD: RGB = [212, 175, 55];
const GOLD_BRONZE: RGB = [153, 101, 21];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/* ---------------------------------------------------------------------------
   GEOMETRI (dihitung sekali, dipakai tiap frame)
   ------------------------------------------------------------------------ */

/**
 * Titik pada untai. Sudut helical dikali putaran penuh; radius dijepit ke
 * ujung dengan `sin(t·π)` supaya bentuknya spindle, bukan tabung.
 */
function strandPoint(t: number, strand: number): P3 {
  const angle = t * TURNS * Math.PI * 2 + strand * Math.PI;
  const r = RADIUS * (0.3 + 0.7 * Math.sin(t * Math.PI));
  return {
    x: Math.cos(angle) * r,
    y: (t - 0.5) * HEIGHT,
    z: Math.sin(angle) * r,
  };
}

/** Cincin penanda: lingkaran tegak lurus sumbu heliks, di tengah tinggi. */
const RING: P3[] = Array.from({ length: 48 }, (_, i) => {
  const a = (i / 48) * Math.PI * 2;
  return { x: Math.cos(a) * RADIUS * 1.45, y: 0, z: Math.sin(a) * RADIUS * 1.45 };
});

/** Serbuk partikel: sebar acak di kotak, lalu naik pelan dan membungkus. */
const PARTICLE_SEEDS: P3[] = Array.from({ length: PARTICLES }, () => ({
  x: (Math.random() - 0.5) * 2 * P_HALF_X,
  y: (Math.random() - 0.5) * 2 * P_HALF_Y,
  z: (Math.random() - 0.5) * 2 * P_HALF_Z,
}));

/** Kenaikan partikel per detik. Masing-masing beda sedikit supaya geraknya
 *  tidak terlihat serempak. */
const PARTICLE_RISE = 0.05 + Math.random() * 0.09;

/* ---------------------------------------------------------------------------
   SPRITE
   Titik bercahaya di-prerender sekali supaya tiap frame cukup `drawImage`.
   Menyusun string rgba per titik di dalam loop akan jadi bottleneck.
   ------------------------------------------------------------------------ */

const SPRITE_SIZE = 48;

function buildSprite([r, g, b]: RGB): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const g2 = c.getContext('2d');
  if (!g2) return c;
  const half = SPRITE_SIZE / 2;
  const grad = g2.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255, 252, 240, 1)');
  grad.addColorStop(0.18, `rgba(${r}, ${g}, ${b}, 0.95)`);
  grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.26)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  g2.fillStyle = grad;
  g2.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return c;
}

const SPRITES = {
  bright: buildSprite(GOLD_BRIGHT),
  gold: buildSprite(GOLD),
  bronze: buildSprite(GOLD_BRONZE),
};

/* ---------------------------------------------------------------------------
   SCENE
   ------------------------------------------------------------------------ */

export function createHelixScene(canvas: HTMLCanvasElement): SceneHandle {
  const maybeCtx = canvas.getContext('2d', { alpha: true });
  if (!maybeCtx) throw new Error('Canvas 2D tidak tersedia');
  // Dianotasi eksplisit, bukan hanya lewat pengecekan di atas: ctx dipakai
  // dari banyak closure (draw, glow), dan tipe yang sudah dinarrowing hilang
  // begitu keluar dari scope pengecekan.
  const ctx: CanvasRenderingContext2D = maybeCtx;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let time = 0;
  let last = 0;
  let raf = 0;
  let disposed = false;
  let visible = true;

  let pointerX = 0;
  let pointerY = 0;
  /** Kemiringan nyata; dikejar pelan ke arah pointer supaya tidak tersentiak. */
  let tiltX = 0;
  let tiltY = 0;
  let scrollPhase = 0;

  /** Node yang akan digambar: sudah diproyeksi, tinggal diurutkan & digambar. */
  type Node = {
    sx: number;
    sy: number;
    depth: number;
    size: number;
    alpha: number;
    sprite: HTMLCanvasElement;
  };

  /**
   * Denyut sepanjang untai. Membuat heliks terasa hidup tanpa harus bergeser
   * jauh, sehingga tidak berubah menjadi pergeseran yang terus bergerak.
   */
  const pulse = (t: number) => Math.sin(t * 12 - time * 1.1) * 0.5 + 0.5;

  /** Titik yang terlalu dekat kamera diredupkan supaya tidak meledak jadi bercak. */
  const fade = (depth: number) => clamp(1 - Math.abs(depth) / 4.2, 0.08, 1);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // Batasi DPR di 2: di layar 3× kenaikan kualitasnya tidak terlihat, tapi
    // biaya fill rate naik 2,25 kali.
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function project(p: P3, spin: number, tilt: number, scale: number, cx: number, cy: number) {
    const cs = Math.cos(spin);
    const sn = Math.sin(spin);
    const x = p.x * cs + p.z * sn;
    const z1 = -p.x * sn + p.z * cs;

    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const y = p.y * ct - z1 * st;
    const z = p.y * st + z1 * ct;

    const persp = FOCAL / (FOCAL + z);
    return { sx: cx + x * persp * scale, sy: cy + y * persp * scale, depth: z, persp };
  }

  function glow(sprite: HTMLCanvasElement, sx: number, sy: number, size: number, alpha: number) {
    if (alpha <= 0.01 || size <= 0.2) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, sx - size / 2, sy - size / 2, size, size);
  }

  function draw() {
    /*
     * Komposisi. Headline hero rata kiri dan panjangnya sampai ~2/3 lebar
     * shell, jadi objek 3D digeser ke kanan pada layar lebar supaya tidak
     * berebut ruang dengan teks. Di bawah ambang itu teks sudah memenuhi
     * layar, jadi objek kembali ke tengah dan diredupkan — keterbacaan teks
     * selalu menang atas efek visualnya.
     */
    const wide = w >= WIDE_AT;
    const cx = w * (wide ? 0.72 : 0.5);
    const cy = h * 0.5;
    const scale = h * SCALE_OF_HEIGHT;
    /** Pengali opacity global. */
    const master = wide ? 1 : 0.55;
    const spin = time * SPIN + tiltY * 0.5 + scrollPhase * 1.5;
    const tilt = -0.3 + tiltX * 0.28;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    /* 1. Serbuk partikel — paling belakang, paling redup. */
    for (const seed of PARTICLE_SEEDS) {
      // Naik terus; saat lewat atas, balik ke bawah supaya tidak pernah habis.
      const yy = (((seed.y + time * PARTICLE_RISE) % (2 * P_HALF_Y)) + 2 * P_HALF_Y) % (2 * P_HALF_Y) - P_HALF_Y;
      const p = project({ x: seed.x, y: yy, z: seed.z }, spin, tilt, scale, cx, cy);
      glow(SPRITES.bronze, p.sx, p.sy, 4.5 * p.persp, 0.4 * master * fade(p.depth));
    }

    /* 2. Cincin penanda konstanta. */
    ctx.globalAlpha = 0.5 * master;
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= RING.length; i++) {
      const p = project(RING[i % RING.length], spin, tilt, scale, cx, cy);
      if (i === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();

    /* 3. Untai + satelit dikumpulkan dalam satu daftar supaya keduanya benar-benar
       bisa saling menutup sesuai kedalaman, bukan selalu menempel di atas. */
    const nodes: Node[] = [];

    for (let s = 0; s < 2; s++) {
      const sprite = s === 0 ? SPRITES.bright : SPRITES.gold;
      for (let i = 0; i < PER_STRAND; i++) {
        const t = i / (PER_STRAND - 1);
        const p = project(strandPoint(t, s), spin, tilt, scale, cx, cy);
        nodes.push({
          sx: p.sx,
          sy: p.sy,
          depth: p.depth,
          size: (4.2 + pulse(t) * 1.6) * p.persp,
          alpha: 0.9 * master * fade(p.depth),
          sprite,
        });
      }
    }

    const sa = time * SAT_SPEED;
    const sat = project(
      {
        x: Math.cos(sa) * SAT_RADIUS,
        y: SAT_LIFT + Math.sin(sa * 0.63) * SAT_BOB,
        z: Math.sin(sa) * SAT_RADIUS,
      },
      spin,
      tilt,
      scale,
      cx,
      cy,
    );
    nodes.push({
      sx: sat.sx,
      sy: sat.sy,
      depth: sat.depth,
      size: 26 * sat.persp,
      alpha: 0.95 * master * fade(sat.depth),
      sprite: SPRITES.bright,
    });

    // Makin jauh, digambar lebih dulu.
    nodes.sort((a, b) => b.depth - a.depth);
    for (const n of nodes) glow(n.sprite, n.sx, n.sy, n.size, n.alpha);

    /* 4. Inti satelit: titik padat kecil supaya ada bintangnya, bukan blur. */
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.9 * master * fade(sat.depth);
    ctx.fillStyle = 'rgba(255, 250, 232, 0.95)';
    ctx.beginPath();
    ctx.arc(sat.sx, sat.sy, Math.max(0.8, 1.9 * sat.persp), 0, Math.PI * 2);
    ctx.fill();

    /* 5. Tangga emas penghubung kedua untai — digambar terakhir supaya terlihat
       sebagai riser: tipis dan transparan, bukan penghalang. */
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let midDepth = 0;
    for (let i = 0; i < RUNGS; i++) {
      const t = i / (RUNGS - 1);
      const a = project(strandPoint(t, 0), spin, tilt, scale, cx, cy);
      const b = project(strandPoint(t, 1), spin, tilt, scale, cx, cy);
      midDepth += (a.depth + b.depth) / 2;
      if (i === 0) ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
    }
    ctx.globalAlpha = 0.22 * master * fade(midDepth / RUNGS);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.7)';
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function frame(now: number) {
    if (disposed) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;

    // Di luar viewport: jangan gambar dan jangan kumpulkan waktu. rAF sendiri
    // TETAP dijadwalkan, tapi hanya saat memang sedang terlihat.
    if (visible) {
      time += dt;
      tiltX += (pointerY - tiltX) * Math.min(1, dt * 4);
      tiltY += (pointerX - tiltY) * Math.min(1, dt * 4);
      draw();
      raf = requestAnimationFrame(frame);
    }
    // Kalau tidak terlihat, loop berhenti total dan dihidupkan lagi oleh
    // IntersectionObserver di bawah.
  }

  function start() {
    if (disposed || raf) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  const ro = new ResizeObserver(resize);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) start();
    else stop();
  });
  ro.observe(canvas);
  io.observe(canvas);

  resize();
  start();

  return {
    dispose() {
      disposed = true;
      stop();
      ro.disconnect();
      io.disconnect();
    },
    setPointer(nx, ny) {
      pointerX = clamp(nx, -1, 1);
      pointerY = clamp(ny, -1, 1);
    },
    setScroll(p) {
      scrollPhase = clamp(p, 0, 1);
    },
  };
}
