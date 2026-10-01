/**
 * Hero: pusaran partikel emas membentuk heliks DNA (three.js).
 *
 * Kenapa modul ini terpisah dan di-`import()` dinamis
 * --------------------------------------------------
 * three.js berat (sekitar 150 kB gzip). Kalau diimpor statis di mana pun pada
 * graf impor yang disentuh HP, dia ikut terunduh dan diparse di sana. Jadi
 * modul ini HANYA boleh dimuat dari cabang `mode === 'rich'` (lihat
 * HeroParticles.tsx). Mode 'simple' dan 'reduced' tidak pernah menyentuh
 * jalur ini, jadi chunk-nya benar-benar tidak terunduh, bukan sekadar tidak
 * dieksekusi. Inilah alasan dinamanya.
 *
 * Catatan governance
 * ------------------
 * Putaran kontinu di sini adalah pengecualian infinite-loop yang resmi:
 * motif DNA berputar adalah identitas visual inti Helixa. Ada tepat dua
 * pengecualian di situs ini, putaran DNA di Hero dan putaran giroskop di
 * Aturan. Tidak ada yang ketiga tanpa pembahasan ulang.
 *
 * Bentuk dan material
 * -------------------
 * Dua untai: untai A di sudut theta, untai B di theta+pi, radius konsisten.
 * Tiap partikel diberi jitter acak kecil di x/y/z supaya terbaca sebagai
 * serbuk, bukan garis padat. Itulah pembeda utama partikel dari polyline SVG.
 *
 * Additive blending dipakai supaya partikel yang menumpuk menyatu halus.
 * Opacity per-partikel sengaja dijaga rendah (0.78, di rentang 0.75-0.80
 * yang diminta) supaya tidak menyala norak dan tetap kalah oleh tipografi
 * headline yang berada di atasnya lewat .hero-scrim.
 */

import * as THREE from 'three';

/** Handle yang dikembalikan ke React. */
export interface DnaSceneHandle {
  /** Pointer ternormalisasi ke -1..1 relatif tengah viewport. */
  setPointer(x: number, y: number): void;
  /** 0..1 progress scroll halaman; dipakai untuk menggeser fase putaran. */
  setScroll(p: number): void;
  /** Jeda dan lanjutkan loop (dipakai saat tab disembunyikan). */
  setPaused(p: boolean): void;
  /** Hentikan rAF dan lepaskan seluruh resource GPU. */
  dispose(): void;
}

const COUNT = 560; // di rentang 500-600 yang diminta: aksen halus, bukan showcase
const TURNS = 3.05; // putaran untai sepanjang tinggi
const RADIUS = 1.0;
const HEIGHT = 3.5;

/** Rotasi kontinu dalam rad/detik. 0.05, sangat lambat. */
const SPIN = 0.05;

/** Batas tilt tambahan dari posisi mouse, rad. */
const TILT_Y = 0.3;
const TILT_X = 0.15;

/** Damping lerp tilt per frame, di rentang 0.04-0.06 yang diminta. */
const TILT_DAMP = 0.05;

const DPR_MAX = 2;

/**
 * Posisi pusat motif di layar, sebagai fraksi lebar viewport (0.87 = 87%).
 *
 * Disesuaikan dengan kotak fallback SVG DnaHelix yang memakai `right: 4%`
 * (pusatnya di sekitar 87% lebar layar). Menaikkannya supaya perpindahan dari
 * mode rich ke mode simple - atau ke fallback saat WebGL ditolak - tidak terasa
 * melompat: motif muncul di tempat yang sama, hanya bedarenderer.
 */
const MOTIF_CENTER_X = 0.87;

/**
 * Sprite radial 64x64 di-prerender sekali, dipakai sebagai texture point.
 * Tanpa ini three.js memakai kotak putih solid untuk Points, dan cluster
 * partikel akan terlihat sebagai blok kasar, bukan butiran bercahaya.
 */
function makeSprite(): THREE.Texture {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia untuk sprite partikel');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Sebaran partikel: dua untai heliks dengan jitter.
 *
 * Semua partikel tetap menempel lintasan untai, tapi jitter di tiga sumbu
 * itulah yang membuatnya terbaca sebagai serbuk. Tanpa jitter, hasilnya
 * dua garis bersih dan partikel menjadi tidak bermakna.
 */
function buildPositions(): Float32Array {
  const pos = new Float32Array(COUNT * 3);
  const half = COUNT / 2; // paruh pertama untai A, paruh kedua untai B
  for (let i = 0; i < COUNT; i++) {
    const isA = i < half;
    const idx = isA ? i : i - half;
    const n = isA ? half : COUNT - half;
    const t = n === 1 ? 0 : idx / (n - 1); // 0..1 sepanjang untai
    const theta = t * Math.PI * 2 * TURNS + (isA ? 0 : Math.PI);
    const r = RADIUS + (Math.random() - 0.5) * 0.12; // jitter radial
    const y = -HEIGHT / 2 + t * HEIGHT + (Math.random() - 0.5) * 0.1; // jitter vertikal
    const jx = (Math.random() - 0.5) * 0.16;
    const jz = (Math.random() - 0.5) * 0.3; // jitter kedalaman, paling besar
    pos[i * 3 + 0] = Math.cos(theta) * r + jx;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = Math.sin(theta) * r + jz;
  }
  return pos;
}

/** Campuran #D4AF37 dan #F6E7B4 per partikel, supaya tidak seragam. */
function buildColors(): Float32Array {
  const a = new THREE.Color('#D4AF37');
  const b = new THREE.Color('#F6E7B4');
  const col = new Float32Array(COUNT * 3);
  const c = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    c.copy(a).lerp(b, Math.random());
    col[i * 3 + 0] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  return col;
}

export function createDnaScene(
  canvas: HTMLCanvasElement,
  opts: { reduced?: boolean } = {},
): DnaSceneHandle {
  const reduced = opts.reduced === true;

  // Sengaja tanpa try/catch di dalam modul: pemanggil yang memutuskan
  // apakah fallback perlu. Lihat HeroParticles.tsx, yang membungkus pemanggilan
  // ini dan otomatis jatuh ke SVG helix bila gagal.
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false, // partikel kecil, MSAA di sini tidak terbayar
    alpha: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true, // dibutuhkan untuk screenshot verifikasi
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);
  camera.lookAt(0, 0, 0);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buildPositions(), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(buildColors(), 3));

  const sprite = makeSprite();
  const material = new THREE.PointsMaterial({
    size: 0.075, // kecil: aksen, bukan showcase
    map: sprite,
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  points.scale.set(0.85, 1, 0.85);
  scene.add(points);

  // ---- state animasi ----
  let ptrX = 0;
  let ptrY = 0;
  let tiltY = 0;
  let tiltX = 0;
  let spin = 0; // rad, akumulatif
  let scrollPhase = 0;
  let paused = false;
  let disposed = false;
  let raf = 0;

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
    const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_MAX));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    /*
     * Pada layar lebar, geser motif ke KANAN mengikuti layout dua kolom
     * asimetris hero, supaya tidak menimpa headline di kiri.
     *
     * Tanda minusnya penting, dan dulu terbalik. Kamera diarahkan ke (0,0,0)
     * saat posisi x-nya masih nol, jadi sumbu pandangnya tegak lurus ke -Z.
     * Kalau kamera lalu digeser ke x positif, titik asal (0,0,0) berada di
     * sebelah KIRI bidang pandang danmotif justru muncul di kiri - persis
     * kebalikan dari yang diinginkan, dan tepat di bagian paling pekat dari
     * hero-scrim. Akibatnya partikel tenggelam di bawah lapisan tinta dan
     * nyaris tidak terlihat, padahal scene-nya berjalan normal.
     *
     * Offset dihitung dari geometri kamera, bukan angka tetap, supaya posisinya
     * di layar sama persis pada aspect rasio berapa pun. `HALF_W` adalah
     * setengah lebar bidang pandang di bidang z=0; menggeser kamera sepanjang
     * 2 * HALF_W akan menggeser isi layar sepanjang 1.0 (yaitu 100%).
     */
    if (w >= 1024) {
      const halfW =
        Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect;
      // MOTIF_CENTER_X = 0.87: pusat motif di 87% lebar layar, sama dengan
      // kotak fallback SVG DnaHelix (right: 4%), supaya transisi rich -> simple
      // tidak terasa melompat.
      camera.position.x = (0.5 - MOTIF_CENTER_X) * 2 * halfW;
    } else {
      camera.position.x = 0;
    }
    camera.updateProjectionMatrix();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ---- render loop ----
  function frame() {
    raf = requestAnimationFrame(frame);

    if (!reduced) {
      spin += SPIN / 60; // sekitar 0.05 rad/detik pada 60 fps
      // Tilt mengejar target mouse dengan lerp: filosofi yang sama dengan ring
      // kursor, supaya konsisten di seluruh situs.
      tiltY += (ptrX * TILT_Y - tiltY) * TILT_DAMP;
      tiltX += (ptrY * TILT_X - tiltX) * TILT_DAMP;
    }

    points.rotation.y = spin + tiltY + scrollPhase;
    points.rotation.x = tiltX;

    renderer.render(scene, camera);
  }

  if (reduced) {
    // Reduced-motion: satu frame statis. Partikel tetap terlihat, hanya diam.
    // Tidak ada rAF, tidak ada reaksi pointer.
    renderer.render(scene, camera);
  } else {
    raf = requestAnimationFrame(frame);
  }

  // ---- pause saat tab disembunyikan ----
  const onVis = () => {
    if (disposed) return;
    if (document.hidden) {
      paused = true;
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!paused) {
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', onVis);

  return {
    setPointer(x, y) {
      ptrX = x;
      ptrY = y;
    },
    setScroll(p) {
      scrollPhase = p * 0.6;
    },
    setPaused(p) {
      if (disposed || reduced) return;
      if (p && !paused) {
        paused = true;
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!p && paused) {
        paused = false;
        raf = requestAnimationFrame(frame);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      sprite.dispose();
      renderer.dispose();
      // Lepaskan context supaya context lain (mis. giroskop Aturan) tidak
      // kehabisan: browser membatasi jumlah WebGL context aktif.
      renderer.forceContextLoss();
    },
  };
}