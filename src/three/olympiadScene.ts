/**
 * Form Pendaftaran: benda ruang Platonic + debu partikel bergerak.
 *
 * PEMILIHAN BENTUK
 * ----------------
 * Dua objek 3D sudah dipakai situs ini: cincin armillary (Aturan) dan untai
 * DNA (Hero). Forma untuk halaman form harus terbaca sebagai hal ketiga,
 * bukan pengulangan salah satu dari keduanya. Yang dipakai di sini adalah
 * **benda ruang Platonic** - icosahedron dan dodecahedron - karena:
 *
 *   - Polytope Platonic adalah lambang geometri klasik yang paling sering
 *     muncul di identitas olimpiade matematika. Bentuknya langsung terbaca
 *     sebagai "matematika", bukan "astronomi" (armillary) atau "biologi" (DNA).
 *   - Site ini bidangnya adalah Matematika DAN Biologi. Benda ruang
 *     menutup sisi matematikanya; sisi biologi sudah diwakili DNA di Hero.
 *   - Bentuknya berbeda total dari dua yang sudah ada. Icosahedron punya
 *     bidang datar dan sudut tajam; armillary butuh TORUS (tabung), DNA butuh
 *    kurva sinus. Tidak ada tumpang tindih bentuk, jadi ketiga scene bisa
 *     hidup berdampingan tanpa terlihat seperti tema yang sama diulang.
 *
 * Kenapa wireframe, bukan permukaan solid: bentuknya sudah dikenali dari
 * garisnya. Permukaan solid butuh pencahayaan, dan pencahayaan pada benda
 * berputar menghasilkan highlight yang berkedip di tempat berbeda setiap
 * putaran - persis yang sudah dilarang di armillary. MeshBasicMaterial
 * memberi warna emas konstan yang tenang dan murah.
 *
 * PARTIKELNYA DI DALAM SCENE YANG SAMA, BUKAN SCENE KEDUA
 * -------------------------------------------------------
 * Permintaan awal menyebut "3D object" dan "partikel-partikel". Kalau
 * keduanya jadi dua scene terpisah, halaman ini punya DUA context WebGL dan
 * DUA loop rAF yang tidak saling tahu. Debunya cukup dijadikan satu
 * `THREE.Points` di scene yang sama: satu context, satu loop, satu
 * IntersectionObserver, satu dispose. Pemisahan di sini akan menciptakan
 * biaya yang tidak dibayar oleh apa pun yang terlihat.
 *
 * MODUL HANYA DIMUAT DI MODE 'rich'
 * ---------------------------------
 * `import()` dinamis dari OlympiadScene.tsx yang di-gate mode 'rich' dan
 * hanya saat halaman form benar-benar terbuka. Di ponsel chunk three.js tidak
 * pernah terunduh sama sekali - bukan sekadar tidak dieksekusi. Ini syarat
 * yang sudah diukur di jaringan oleh verify.mjs untuk halaman utama, dan
 * Kewajiban yang sama berlaku untuk halaman ini: tidak boleh memunculkan
 * chunk three.js baru di mobile.
 */

import * as THREE from 'three';

export interface OlympiadHandle {
  setPaused(p: boolean): void;
  dispose(): void;
}

/**
 * Batas device pixel ratio.
 *
 * Scene ini memenuhi SELURUH viewport halaman form, jadi luasnya jauh lebih
 * besar dari armillary yang cuma kotak persegi di tengah satu section. Tanpa
 * batas ini, DPI 3 di ponsel premium akan menggambar empat kali lebih banyak
 * piksel dari yang dibutuhkan untuk dua ratus partikel.
 */
const DPR_MAX = 2;

/**
 * `low-power`, sama seperti armillary.
 *
 * Scene ini tidak punya shader mahal: dua wireframe dan dua `Points`.
 * Meminta GPU high-performance untuk itu hanya memindahkan rendering ke GPU diskret pada
 * laptop yang tidak butuh, dan menguras baterai dengan tidak ada gunanya.
 */
const POWER = 'low-power';

/** Emas wireframe, sama dengan emas wireframe armillary. */
const GOLD = new THREE.Color('#D4AF37');
const GOLD_BRIGHT = new THREE.Color('#F6E7B4');

/**
 * Benda dalam, langsam. Icosahedron berputar satu arah, dodecahedron arah
 * sebaliknya: dua gerak berlawanan pada dua sumbu membuat bentuknya tidak
 * pernah terlihat berputar sebagai satu benda utuh, sehingga tidak ada pola
 * berulang yang mudah ditebak mata (persis alasan RINGS di armillary disebar
 * ke empat sumbu).
 */
const SOLID_A = { radius: 1.0, detail: 0, tilt: 0.22, speed: 0.22, opacity: 0.5, color: GOLD };
const SOLID_B = {
  radius: 0.62,
  detail: 0,
  tilt: -0.6,
  speed: -0.34,
  opacity: 0.42,
  color: GOLD_BRIGHT,
};

/**
 * Radius untuk fitting kamera.
 *
 * Benda luar (SOLID_A) tepat 1.0, dan `wireframe` pada polyhedron memotong
 * tepat di rusuknya, jadi tidak ada pinggiran yang perlu ditutup di sini -
 * berbeda dari torus yang polygon's edge-nya keluar sedikit dari radius ideal.
 * 1.12 memberi ruang kosong 12% supaya tilt tidak pernah menyinggung tepi.
 */
const FIT_RADIUS = 1.12;
const FIT_MARGIN = 1.14;

/**
 * Ukuran titik simpul icosahedron, dalam PIXEL CSS.
 *
 * Dulu 0.05 unit dunia dengan `sizeAttenuation: true`. Sekarang pixel - dan
 * alasannya bukan selera, tapi rasterisasi. three.js menghitung
 *
 *   gl_PointSize = size * pixelRatio * (viewportHeight / 2) / distance
 *
 * (lihat `refreshUniformsPoints` + shader `points_vert`). Tiga konsekuensi,
 * semuanya nyata di layar ini:
 *
 *   1. Ukuran partikel SEBANDING dengan tinggi viewport. Jendela pendek
 *      menyusutkan semua partikel, padahal isi scene tidak berubah sama
 *      sekali pun.
 *   2. Sebaliknya, partikel yang jauh (debu paling belakang) tetap kecil
 *      di viewport besar.
 *   3. Di bawah ~5 px, sprite bulat tidak lagi bisa membulat: disk 3x3 piksel
 *      rasterisasi menjadi blok penuh. Diukur di halaman `#pendaftaran`,
 *      gumpalan 2-3 px punya fillRatio 0,83-0,86 (persegi) sementara 6 px
 *      ke atas turun ke 0,74-0,78 (pi/4 = 0,785, lingkaran).
 *
 * Makanya `sizeAttenuation` dimatikan untuk kedua layer titik: dengan begitu
 * `size` dibaca sebagai pixel CSS, jadi ukurannya dijamin sama di semua
 * perangkat. Persepsi kedalaman tidak hilang - ia dipindah ke
 * `DUST_FAR_DIM`, yang meredupkan butiran sesuai jaraknya.
 *
 * 9 px dipilih karena jauh di atas ambang 5 px, jadi setiap simpul selalu
 * terbaca sebagai bola, bukan kotak.
 */
const NODE_SIZE = 9;

/**
 * Ukuran satu butiran debu, dalam PIXEL CSS.
 *
 * Sama seperti `NODE_SIZE`: pixel, bukan unit dunia, supaya tidak ikut
 * menyusut saat jendela pendek dan tidak pernah jatuh ke bawah ambang
 * rasterisasi. 6 px sedikit di atas rata-rata ukuran lama di viewport
 * desktop (0,025 * 613 / 3,71 = 4,1 px), jadi penampilannya masih dekat
 * dengan sebelumnya, tapi sekarang dijamin tidak pernah turun ke 2-3 px
 * yang terbaca kotak. Diukur di halaman, gumpalan 6-8 px selalu persis
 * di regime lingkaran (fillRatio 0,72-0,78, tanpa satu pun persegi).
 *
 * Yang paling butuh lantai ukuran ini adalah butiran paling belakang:
 * paling redup DAN paling lambat bergerak di layar, sebab gerak sebuah
 * partikel di layar berbanding 1/jarak. Dengan `sizeAttenuation: true`
 * mereka justru yang paling kecil - jadi partikel paling pelan adalah
 * partikel paling kotak. `false` menutup celah itu. Lihat `NODE_SIZE`.
 */
const DUST_SIZE = 6;

/**
 * Jumlah debu partikel.
 *
 * Angka 260 dipilih supaya layer ini terbaca sebagai "udara" yang bergerak,
 * bukan sebagai bintang. Terlalu sedikit (di bawah ~120) tidak terlihat
 * bergerak sama sekali; terlalu banyak (di atas ~500) berubah jadi kabut padat
 * yang menutupi wireframe dan, yang lebih penting, memakan waktu frame pada
 * perangkat yang sudah harus menggambar dua scene lain.
 */
const DUST_COUNT = 520;

/**
 * Volume debu, sebagai setengah-extent di unit dunia.
 *
 * Sengaja lebih besar daripada bidang pandang kamera: debu yang keluar kanvas
 * bukan bug, itu yang membuatnya terasa seperti ruang yang luas. Yang penting
 Layer ini tidak bolong di tengah - jadi tiap partikel selalu punya tekstur
 * di sekelilingnya, bahkan di layar 320px yang bidang pandangnya sempit.
 */
const DUST = { x: 3.6, y: 2.8, z: 2.0 } as const;

/** Kecepatan naik partikel (unit dunia per detik) dan ayunan horizontalnya. */
const DUST_RISE = 0.16;
const DUST_SWAY = 0.42;
const DUST_SWAY_SPEED = 0.28;

/**
 * Kecerahan butiran yang paling jauh dari kamera, sebagai bagian dari 1.
 *
 * Inilah yang membuat layer ini terbaca sebagai udara, bukan sebagai tabel
 * bintang. Tanpa peredupan ini semua butiran punya kecerahan sama, dan sumbu z
 * hanya mengubah ukurannya lewat `sizeAttenuation`; mata membaca itu sebagai
 * gambar, bukan sebagai ruang. Meredupkan butiran yang menjauh memberi
 * persepsi kedalaman yang murah: tanpa lighting, tanpa shader tambahan, cukup
 * satu perkalian pada warna yang sudah ada.
 *
 * 0.55 dipilih supaya butiran paling jauh tetap terbaca. Kalau terlalu rendah,
 * separuh volume debu praktis hilang dan layer ini kehilangan teksturnya.
 */
const DUST_FAR_DIM = 0.55;

/**
 * Arah cahaya sprite, sudah ternormalisasi.
 *
 * X dan Y negatif berarti cahaya datang dari kiri ATAS. Z positif sedikit
 * mengarah ke penonton, supaya sisi yang menghadap kamera juga menyala -
 * tanpa itu, butiran terlihat seperti bola yang gelap dari arah pandangan.
 */
const DUST_LIGHT = { x: -0.42, y: -0.52, z: 0.74 };

/**
 * Cahaya ambient: sisi gelap butiran tetap menyala, tidak pernah hitam total.
 *
 * Debu di ruang nyata tidak pernah blackout, karena selalu ada cahaya ambient
 * dari segala arah. 0.30 membuat sisi yang jauh dari cahaya terlihat sebagai
 * bola abu-abu, bukan lubang hitam di dalam sprite. Kalau 0, tiap butiran
 * terlihat seperti cincin gelap - dan justru itu yang tidak natural.
 */
const DUST_AMBIENT = 0.3;

/**
 * Sprite satu butiran debu: BULAT dan BER-SHADING.
 *
 * Tanpa `map`, three.js memakai kotak putih solid untuk `Points`, sehingga
 * setiap partikel tergambar sebagai PERSEGI. Itulah bentuk "kotak-kotak" yang
 * terlihat di form pendaftaran. Sekarang tiap butiran memakai sprite bulat
 * yang dihitung sendiri:
 *
 *   - BENTUK: jarak dari pusat menentukan alpha, jadi tepinya bulat dan
 *     ter-anti-alias. Cakupannya dihitung per piksel dalam satuan piksel,
 *     bukan sekadar `r > 1`, jadi tidak ada tepi bergerigi di layar kecil.
 *   - SHADING: tiap piksel diperlakukan sebagai titik pada permukaan bola
 *     (normal = x, y, sqrt(1 - r^2)), lalu disinari dari arah `DUST_LIGHT`.
 *     Hasilnya gradasi terang di kiri-atas dan sisi jauh yang meredup, jadi
 *     butiran terbaca sebagai butiran BER-BENTUK, bukan titik rata.
 *   - HIGHLIGHT kecil ditambahkan supaya sisi yang kena cahaya terlihat
 *     sedikit mengkilap, seperti butiran yang benar-benar mengenai cahaya.
 *
 * Alpha sengaja dibiarkan memuncak di 1.0, dan peredupan shading dilakukan
 * lewat RGB. Alasannya presisi: canvas menyimpan piksel dalam bentuk
 * premultiplied, jadi warna pada alpha kecil ikut terkuantisasi kasar - dan
 * tepi justru bagian yang paling butuh gradasi mulus. Dengan membiarkan alpha
 * hanya mengurus bentuk, gradasi shading tetap utuh di bagian yang
 * benar-benar terlihat.
 */
function makeDustSprite(): THREE.Texture {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia untuk sprite debu');

  const img = ctx.createImageData(size, size);
  const px = img.data;
  const half = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // -1..1, dengan (0, 0) di tengah sprite. `half` sudah setengah dari lebar
      // sprite, jadi cukup `+ 0.5` untuk mengambil pusat piksel - tidak ada
      // faktor 2 di sini. Kalau ada, rentangnya jadi -3..3 dan sebagian besar
      // piksel jatuh di luar lingkaran: butirannya menyusut jadi seperempat
      // ukuran yang dimaksud dan jauh lebih redup dari seharusnya.
      const u = (x + 0.5) / half - 1;
      const v = (y + 0.5) / half - 1;
      const r2 = u * u + v * v;
      const i = (y * size + x) * 4;

      if (r2 > 1) {
        px[i + 3] = 0;
        continue;
      }

      // Cakupan tepi dihitung dari jarak ke lingkaran dalam satuan piksel,
      // jadi nilainya jatuh pelan dari 1 ke 0 di tepi: anti-aliasing yang benar.
      const edge = (1 - Math.sqrt(r2)) * half;
      const alpha = edge <= 0 ? 0 : Math.min(1, edge);

      // Normal permukaan bola satuan di titik (u, v).
      const nz = Math.sqrt(Math.max(0, 1 - r2));
      const diffuse = Math.max(0, u * DUST_LIGHT.x + v * DUST_LIGHT.y + nz * DUST_LIGHT.z);

      const shade = DUST_AMBIENT + (1 - DUST_AMBIENT) * diffuse;
      const spec = Math.pow(diffuse, 12) * 0.28;
      const val = Math.min(1, shade + spec) * 255;

      // Grayscale: rona emas datang dari vertex color, jadi sprite ini hanya
      // boleh mengalikan terang/gelap - kalau dia berwarna, satu partikel
      // akan dapat dua warna sekaligus.
      px[i] = val;
      px[i + 1] = val;
      px[i + 2] = val;
      px[i + 3] = alpha * 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Kumpulkan simpul unik dari polyhedron.
 *
 * `IcosahedronGeometry` mengembalikan BufferGeometry TANPA index, jadi setiap
 * rusuk dipecah jadi dua segitiga dan simpul yang sama muncul beberapa kali di
 * array posisi. Kalau dipakai apa adanya, 12 simpul akan jadi 60 titik yang
 * bertumpuk persis di atas satu sama lain - tidak salah secara visual, tapi
 * attribute-nya berisi data yang salah dan buahnya terbuang.
 *
 * Pembulatan ke 4 desimal dipakai sebagai kunci. Luas toleransinya jauh lebih
 * kecil daripada jarak antar simpul icosahedron (sekitar 1,05 unit), jadi ini
 * tidak pernah salah menggabungkan dua simpul berbeda.
 */
function uniqueVertices(geo: THREE.BufferGeometry): Float32Array {
  const pos = geo.getAttribute('position');
  const seen = new Set<string>();
  const out: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key =
      Math.round(x * 1e4) + ':' + Math.round(y * 1e4) + ':' + Math.round(z * 1e4);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x, y, z);
  }
  return new Float32Array(out);
}

export function createOlympiadScene(
  canvas: HTMLCanvasElement,
  opts: { reduced?: boolean } = {},
): OlympiadHandle {
  const reduced = opts.reduced === true;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: POWER,
    // Wajib: bukti piksel pada halaman ini diambil lewat drawImage +
    // getImageData di dalam halaman, dan `Page.captureScreenshot` di Chrome
    // headless TIDAK menangkap layer WebGL sama sekali. Tanpa preserve buffer,
    // verify.mjs akan melihat kanvas kosong dan melaporkan objek gagal.
    preserveDrawingBuffer: true,
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  scene.add(group);

  const disposables: Array<{ dispose(): void }> = [];

  /*
   * SATU SPRITE UNTUK KEDUA LAYER TITIK.
   *
   * Scene ini punya DUA `Points`: simpul icosahedron (12 titik) dan debu (520
   * titik). Keduanya WAJIB memakai sprite bulat yang sama. Ini bukan
   * konsistensi estetika saja - tanpa `map`, three.js menggambar tiap titik
   * sebagai PERSEGI putih solid, jadi satu layer yang lupa sprite langsung
   * muncul sebagai kotak-kotak di layar.
   *
   * Kenapa ini penting sekali di scene ini: simpul icosahedron berukuran
   * 0.05, yaitu DUA KALI ukuran debu (0.025), dengan opacity 0.9 dan warna
   * emas paling terang. Jadi 12 titik itu jauh lebih menonjol daripada 520
   * butiran debu - persis yang paling cepat terlihat oleh mata. Memperbaiki
   * debu saja akan meninggalkan 12 kotak yang paling menyebalkan.
   *
   * Dibuat sekali di sini, dipakai dua kali, dan di-`dispose` sekali. Texture
   * tidak dialokasikan ulang, dan `disposables` tidak mendaftarkannya dua kali
   * (memanggil `dispose` dua kali pada texture yang sama tidak merusak, tapi
   * mendaftarkannya sekali saja lebih jujur).
   */
  const dotTex = makeDustSprite();

  // ---- dua benda ruang Platonic ----
  //
  // Geometri icosahedron disimpan terpisah (bukan diambil kembali dari
  // `group.children[0]`) karena simpul-simpulnya dibutuhkan untuk layer titik
  // di bawah. `children` bertipe `Object3D[]`, jadi `.geometry` tidak ada di
  // tipe itu - menyimpan referensinya di sini juga lebih jelas urutan buildup.
  const icosaGeo = new THREE.IcosahedronGeometry(SOLID_A.radius, SOLID_A.detail);
  for (const spec of [SOLID_A, SOLID_B]) {
    const geo =
      spec === SOLID_A
        ? icosaGeo
        : new THREE.DodecahedronGeometry(spec.radius, spec.detail);
    const mat = new THREE.MeshBasicMaterial({
      color: spec.color,
      wireframe: true,
      transparent: true,
      opacity: spec.opacity,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = spec.tilt;
    mesh.rotation.y = spec.tilt * 0.5;
    mesh.userData.speed = spec.speed;
    group.add(mesh);
    disposables.push(geo, mat);
  }

  // ---- titik di simpul icosahedron ----
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(uniqueVertices(icosaGeo), 3));
  const nodeMat = new THREE.PointsMaterial({
    color: GOLD_BRIGHT,
    size: NODE_SIZE,
    // WAJIB false. Alasannya: layer simpul inilah yang bergerak paling pelan
    // di scene - tidak punya `userData.speed`, jadi hanya ikut denyut `group`
    // pada 0,16 rad/s. Dengan `true`, ukurannya ikut mengecil saat jendela
    // pendek, sehingga partikel yang paling lambat justru yang paling cepat
    // terbaca kotak. Dengan `false`, `size` dibaca sebagai pixel dan tidak
    // pernah turun ke bawah ambang rasterisasi.
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    // WAJIB. Tanpa baris ini, 12 titik simpul digambar sebagai persegi putih
    // solid - dan karena ukurannya dua kali debu serta nearly opaque, mereka
    // adalah bentuk kotak yang paling mencolok di seluruh halaman.
    map: dotTex,
    alphaTest: 0.01,
  });
  const nodes = new THREE.Points(nodeGeo, nodeMat);
  group.add(nodes);
  disposables.push(nodeGeo, nodeMat);

  // ---- debu partikel ----
  //
  // `dustBaseX` menyimpan posisi awal partikel. Ini bukan penghematan, tapi
  // perbaikan: versi pertama langsung menambah simpangan sinus ke X yang
  // sekarang setiap frame. Itu random walk - tiap partikel bergerak acak dan
  // setelah beberapa menit sebagian besar sudah keluar volume, jadi "lapisan
  // debu" tinggal jadi rintisan di satu sudut. Menyimpan posisi awal membuat
  // ayunan SELALU di sekitar titik yang sama, dan karena itu mesmerinya
  // berulang tapi tidak pernah menyimpang.
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_COUNT * 3);
  const dustColor = new Float32Array(DUST_COUNT * 3);
  const dustBaseX = new Float32Array(DUST_COUNT);
  const dustSeed = new Float32Array(DUST_COUNT);
  const c = new THREE.Color();
  for (let i = 0; i < DUST_COUNT; i++) {
    const x = (Math.random() * 2 - 1) * DUST.x;
    const z = (Math.random() * 2 - 1) * DUST.z;
    dustPos[i * 3] = x;
    dustPos[i * 3 + 1] = (Math.random() * 2 - 1) * DUST.y;
    dustPos[i * 3 + 2] = z;
    dustBaseX[i] = x;
    // Campuran dua emas supaya layer tidak terlihat satu warna datar.
    c.copy(GOLD).lerp(GOLD_BRIGHT, Math.random() * 0.7);
    // Peredupan sesuai kedalaman (lihat DUST_FAR_DIM). Perhitungan ini statis
    // karena z tidak pernah berubah - yang bergerak hanya x dan y - jadi tidak
    // ada biaya per frame. Pangkat 0.65 membuat gradasi lebih cepat mendekati
    // kamera: kalau linier, tiap kedalaman punya kecerahan yang sama dan
    // efeknya hilang.
    const depth = (z + DUST.z) / (2 * DUST.z); // 0 = terjauh, 1 = terdekat
    const dim = DUST_FAR_DIM + (1 - DUST_FAR_DIM) * Math.pow(depth, 0.65);
    dustColor[i * 3] = c.r * dim;
    dustColor[i * 3 + 1] = c.g * dim;
    dustColor[i * 3 + 2] = c.b * dim;
    // Fase ayunan per partikel, supaya geraknya tidak serempak.
    dustSeed[i] = Math.random() * Math.PI * 2;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColor, 3));

  // Sprite bulat yang sama dengan layer simpul, dibuat sekali di atas.
  const dustMat = new THREE.PointsMaterial({
    size: DUST_SIZE,
    // WAJIB false, sama alasannya dengan `nodeMat`: butiran yang paling jauh
    // adalah yang paling lambat bergerak di layar, dan dengan `true` mereka
    // juga yang paling kecil - jadi partikel paling pelan justru yang paling
    // terbaca kotak. `DUST_FAR_DIM` sudah menangani persepsi kedalaman.
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    map: dotTex,
    alphaTest: 0.01,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);
  disposables.push(dustGeo, dustMat, dotTex);

  // ---- state ----
  let time = 0;
  let paused = false;
  let disposed = false;
  let raf = 0;

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
    const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_MAX));
    renderer.setSize(w, h, false);

    const aspect = w / Math.max(1, h);

    /*
     * JARAK KAMERA DIHITUNG DARI FIT, BUKAN FIXED.
     *
     * Pola yang sama seperti armillary, dan alasannya sama: `PerspectiveCamera`
     * memakai fov VERTIKAL, jadi kanvas yang lebih lebar daripada tingginya
     *justru lebih sempit ke arah x. Distance fixed membuat salah satu sumbu
     * terpotong, dan gejalanya tidak selalu kelihatan - bagian yang hilang
     * cuma sedikit, dan selalu hilang di tempat yang sama, jadi terlihat
     * seperti disengaja.
     *
     * `Math.max` dipakai karena yang dicari adalah jarak TERJauh dari dua
     * sumbu: jarak yang cukup untuk sumbu yang lebih ketat otomatis cukup
     * untuk yang lain.
     */
    const halfFovV = (camera.fov * Math.PI) / 360;
    const need = FIT_RADIUS * FIT_MARGIN;
    const distForHeight = need / Math.tan(halfFovV);
    const halfFovH = Math.atan(Math.tan(halfFovV) * aspect);
    const distForWidth = need / Math.tan(halfFovH);
    camera.position.set(0, 0, Math.max(distForHeight, distForWidth));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function frame() {
    raf = requestAnimationFrame(frame);
    time += 1 / 60;

    for (const child of group.children) {
      const speed = (child.userData as { speed?: number }).speed ?? 0;
      if (speed === 0) continue;
      child.rotation.y += speed / 60;
      child.rotation.z += speed / 90;
    }
    // Denyut pelan, sama seperti armillary: dengan pergeseran kecil supaya
    // bentuknya tidak terlihat seperti roda yang berputar di tempat.
    group.rotation.y = Math.sin(time * 0.16) * 0.18;
    group.rotation.x = Math.sin(time * 0.11) * 0.08;

    // Debu naik perlahan dan membungkus diri sendiri saat melewati batas atas,
    // jadi tidak pernah ada bingkai wherein partikel terlihat meloncat.
    const p = dustGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < DUST_COUNT; i++) {
      let y = p.getY(i) + DUST_RISE / 60;
      if (y > DUST.y) y = -DUST.y;
      p.setY(i, y);
      p.setX(i, dustBaseX[i] + Math.sin(time * DUST_SWAY_SPEED + dustSeed[i]) * DUST_SWAY);
    }
    p.needsUpdate = true;

    renderer.render(scene, camera);
  }

  if (reduced) {
    // Reduced-motion: satu frame statis. Bentuk dan debu tetap terlihat.
    renderer.render(scene, camera);
  } else {
    raf = requestAnimationFrame(frame);
  }

  // Jeda saat tab disembunyikan. Perhatikan syaratnya: hanya boleh MENYALAKAN
  // loop kalau sebelumnya benar-benar sedang paused. Versi armillary sempat punya
  // tanda hubung terbalik di sini dan gejalanya baru muncul setelah listener
  // dihapus - jangan diulang.
  const onVis = () => {
    if (disposed) return;
    if (document.hidden) {
      if (paused) return;
      paused = true;
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (paused) {
      paused = false;
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', onVis);

  return {
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
      for (const d of disposables) d.dispose();
      renderer.dispose();
      // WAJIB. `forceContextLoss` membunuh context untuk selamanya di elemen
      // canvas yang sama, jadi canvas yang dilepas harus ikut dibuang oleh
      // React (lewat `key` yang berubah) sebelum scene baru dibangun.
      renderer.forceContextLoss();
    },
  };
}
