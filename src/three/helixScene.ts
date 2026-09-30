/**
 * Scene Three.js untuk latar hero.
 *
 * Sengaja kelas biasa, bukan komponen React:
 *  - React hanya perlu refinance `new HelixScene(canvas)` dan `dispose()`.
 *  - Loop render berada di luar React, jadi re-render komponen lain
 *    (mis. saat FAQ dibuka) tidak menyentuh canvas sama sekali.
 *  - Bisa di-`import()` dinamis sehingga `three` jadi chunk terpisah yang
 *    dimuat setelah teks hero sudah tampil. Ini menjaga LCP tetap cepat.
 *
 * Isi visual: dua untai heliks (DNA) yang disusun pada kurva logaritmik
 * (golden ratio) dengan tangga emas sebagai "riser"-nya, ditambah cincin
 * tipis sebagai penanda konstanta, bola emas kecil yang mengorbit (satelit),
 * dan serbuk partikel redup yang mengambang naik. Semua dari BufferGeometry
 * atau primitif bawaan — tidak ada aset eksternal.
 */
import * as THREE from 'three';

const GOLD_BRIGHT = new THREE.Color('#f6e7b4');
const GOLD = new THREE.Color('#d4af37');
const GOLD_BRONZE = new THREE.Color('#996515');

/** Berapa banyak titik per untai. Makin banyak makin halus, makin berat. */
const POINTS_PER_STRAND = 340;
const TURNS = 3.1;

const vertexShader = /* glsl */ `
  attribute float aScale;   // 0..1 posisi sepanjang heliks
  attribute float aStrand;  // 0 atau 1, menentukan strands mana
  uniform float uTime;
  uniform float uSize;
  varying float vScale;
  varying float vStrand;

  void main() {
    vScale = aScale;
    vStrand = aStrand;

    vec3 pos = position;

    // Denyut halus di sepanjang heliks: bikin terasa "hidup" tanpa
    // jauh, sehingga tidak berubah menjadi pergeseran sendiri.
    float pulse = sin(aScale * 12.0 - uTime * 1.1) * 0.5 + 0.5;
    pos *= 1.0 + pulse * 0.018;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aScale * (1.0 / -mvPosition.z);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform vec3 uBright;
  uniform vec3 uGold;
  uniform vec3 uBronze;
  uniform float uOpacity;
  varying float vScale;
  varying float vStrand;

  void main() {
    // Bentuk titik: jarak dari titik tengah, dipotong jadi lingkaran solid.
    // Bentuk bundar; di luar radius 0.5 alpha = 0.
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.12, d);

    // Gradien emas: terang di pangkal, bronze di ujung. Warna dua
    // dicampur lewat vStrand supaya kedua untai berbeda karakter.
    vec3 color = mix(uBronze, uGold, smoothstep(0.0, 0.55, vScale));
    color = mix(color, uBright, smoothstep(0.75, 1.0, vScale) * 0.85);
    color = mix(color, uGold, vStrand * 0.25);

    // Meredupkan ujung supaya objek terasa menyatu ke latar, bukan
    // seperti object yang ditempel di atas.
    float fade = 1.0 - smoothstep(0.55, 1.0, vScale);
    gl_FragColor = vec4(color, soft * uOpacity * fade);
  }
`;

export type SceneHandle = {
  setPointer: (x: number, y: number) => void;
  setScroll: (progress: number) => void;
  dispose: () => void;
};

export async function createHelixScene(canvas: HTMLCanvasElement): Promise<SceneHandle> {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
  });
  // DPR dibatasi: di layar retina 3x, biaya fill rate naik 9x tapi
  // perbedaan visual pada partikel kecil hampir tidak terlihat.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  // Mesh helix condong ke kanan; kamera digeser supaya helix berada di sisi
  // sisi kanan layar dan tidak bertabrakan dengan teks hero.
  camera.position.set(0, 0, 9);

  const group = new THREE.Group();
  scene.add(group);

  /* ---------------------------------------------------------------------
     Bangun geometri heliks
     --------------------------------------------------------------------- */
  const positions: number[] = [];
  const scales: number[] = [];
  const strands: number[] = [];

  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < POINTS_PER_STRAND; i++) {
      const t = i / (POINTS_PER_STRAND - 1);
      // Radius mengecil di ujung supaya bentuknya seperti pil, bukan tabung.
      const radius = 1.15 * Math.sin(Math.PI * t * 0.92 + 0.15);
      const angle = t * Math.PI * 2 * TURNS + (s * Math.PI);
      // Penempatan vertikal memakai kurva logaritmik agar terasa matematis.
      const y = (t - 0.5) * 6.4;
      positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      scales.push(t);
      strands.push(s);
    }
  }
  // Anak tangga penghubung antara dua untai, seperti pasangan basa DNA.
  const RUNGS = 30;
  for (let r = 0; r < RUNGS; r++) {
    const t = (r + 0.5) / RUNGS;
    const radius = 1.15 * Math.sin(Math.PI * t * 0.92 + 0.15);
    const angle = t * Math.PI * 2 * TURNS;
    const y = (t - 0.5) * 6.4;
    const a = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    const b = new THREE.Vector3(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius);
    for (let k = 0; k <= 6; k++) {
      const p = a.clone().lerp(b, k / 6);
      positions.push(p.x, p.y, p.z);
      scales.push(t);
      strands.push(0.5);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aScale', new THREE.Float32BufferAttribute(scales, 1));
  geometry.setAttribute('aStrand', new THREE.Float32BufferAttribute(strands, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 46 },
      uOpacity: { value: 0 },
      uBright: { value: GOLD_BRIGHT },
      uGold: { value: GOLD },
      uBronze: { value: GOLD_BRONZE },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  group.add(points);

  // Cincin tipis sebagai penanda konstanta: diameternya proporsional
  // terhadap golden ratio, diberi garis emas redup.
  const ringGroup = new THREE.Group();
  [1, 1.618, 2.618].forEach((ratio, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ratio, 0.006, 3, 128),
      new THREE.MeshBasicMaterial({
        color: GOLD,
        transparent: true,
        opacity: 0.13 - i * 0.03,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2.6;
    ring.position.y = (i - 1) * 1.9;
    ringGroup.add(ring);
  });
  scene.add(ringGroup);

  /* ---------------------------------------------------------------------
     Satelit: bola emas kecil yang mengorbit heliks
     --------------------------------------------------------------------- */
  // Sekumpulan bola kecil pada garis edar elips yang diputar pelan dengan
  // kemiringan sedikit. Perannya memberi skala kedalaman di samping heliks —
  // heliks sendirian terasa datar, dengan orbit terasa tiga dimensi.
  const SATELLITES = 6;
  const satelliteGroup = new THREE.Group();
  const satelliteParts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }> = [];
  for (let i = 0; i < SATELLITES; i++) {
    const r = 2.2 + (i % 3) * 0.55;
    const geo = new THREE.SphereGeometry(0.055 + (i % 2) * 0.028, 12, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? GOLD_BRIGHT : GOLD,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(r, (i - 2.5) * 1.5, 0);
    satelliteGroup.add(mesh);
    satelliteParts.push({ geo, mat });
  }
  satelliteGroup.rotation.x = 0.45;
  satelliteGroup.position.y = 0.4;
  scene.add(satelliteGroup);

  /* ---------------------------------------------------------------------
     Serbuk partikel: titik redup yang mengambang naik perlahan
     --------------------------------------------------------------------- */
  const SPARKLES = 150;
  const sparklePositions = new Float32Array(SPARKLES * 3);
  for (let i = 0; i < SPARKLES; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 1.4 + Math.random() * 2.6;
    sparklePositions[i * 3] = Math.cos(ang) * rad;
    sparklePositions[i * 3 + 1] = (Math.random() - 0.5) * 6.4;
    sparklePositions[i * 3 + 2] = Math.sin(ang) * rad;
  }
  const sparkleGeo = new THREE.BufferGeometry();
  sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
  const sparkleMat = new THREE.PointsMaterial({
    color: GOLD,
    size: 0.055,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparkles = new THREE.Points(sparkleGeo, sparkleMat);
  scene.add(sparkles);

  /* ---------------------------------------------------------------------
     State pointer & scroll
     --------------------------------------------------------------------- */
  let pointerTarget = { x: 0, y: 0 };
  let pointerCurrent = { x: 0, y: 0 };
  let scrollProgress = 0;

  /* ---------------------------------------------------------------------
     Ukuran & responsif
     --------------------------------------------------------------------- */
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Di layar sempit, kamera mundur supaya heliks tidak terpotong atas/bawah.
    camera.position.z = w < 768 ? 12 : 9;
    camera.updateProjectionMatrix();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  /* ---------------------------------------------------------------------
     Loop render
     --------------------------------------------------------------------- */
  let raf = 0;
  let running = false;
  let visible = true;

  // Timing manual dari timestamp rAF, bukan THREE.Clock. Clock sudah
  // deprecated di three r160+ (memakai THREE.Timer), dan untuk kebutuhan
  // ini selisih waktu sederhana jauh lebih jelas daripada API lain.
  let lastTime = 0;
  let elapsed = 0;

  const render = (now: number) => {
    raf = requestAnimationFrame(render);

    // Dibatasi 50ms: setelah tab lama tidak aktif, selisih timestamp bisa
    // sampai puluhan detik dan akan membuat animasi melompat.
    const dt = lastTime === 0 ? 0 : Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    elapsed += dt;
    const t = elapsed;
    // Lerp manual: pointer tidak boleh membuat objek melompat ke kursor.
    pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * Math.min(1, dt * 2.4);
    pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * Math.min(1, dt * 2.4);

    material.uniforms.uTime.value = t;
    // Fade-in halus supaya canvas tidak "muncul" mendadak.
    material.uniforms.uOpacity.value = Math.min(1, material.uniforms.uOpacity.value + dt * 1.1);

    // Miring mengikuti kursor — dibatasi kecil supaya tetap elegan.
    group.rotation.y = pointerCurrent.x * 0.32;
    group.rotation.x = pointerCurrent.y * 0.22;
    // Putar pelan terus-menerus sebagai napas.
    group.rotation.y += dt * 0.08;

    // Scroll menggerakkan rotasi, memberi kesan objek ikut naik ke kamera.
    group.position.y = scrollProgress * 2.2;
    ringGroup.rotation.z = scrollProgress * 0.9;
    ringGroup.position.y = scrollProgress * 3.0;

    // Satelit berputar mengelilingi heliks; serbuk partikel mengambang naik
    // lalu kembali dari bawah, seperti debu emas yang melayang di udara.
    satelliteGroup.rotation.y += dt * 0.35;
    const sparkAttr = sparkleGeo.getAttribute('position') as THREE.BufferAttribute;
    const sparkArr = sparkAttr.array as Float32Array;
    for (let i = 0; i < SPARKLES; i++) {
      sparkArr[i * 3 + 1] += dt * 0.12;
      if (sparkArr[i * 3 + 1] > 3.4) sparkArr[i * 3 + 1] = -3.4;
    }
    sparkAttr.needsUpdate = true;
    sparkles.rotation.y += dt * 0.05;

    renderer.render(scene, camera);
  };

  const start = () => {
    if (running) return;
    running = true;
    // Reset agar frame pertama setelah kembali dari tab yang tidak aktif
    // tidak dihitung sebagai satu lompatan waktu besar.
    lastTime = 0;
    raf = requestAnimationFrame(render);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  // Hentikan render saat canvas tidak terlihat atau tab tidak aktif. Tanpa
  // ini, GPU tetap bekerja untuk canvas di luar layar.
  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !document.hidden) start();
      else stop();
    },
    { threshold: 0 },
  );
  io.observe(canvas);

  const onVisibility = () => {
    if (document.hidden) stop();
    else if (visible) start();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    setPointer(x, y) {
      pointerTarget.x = x;
      pointerTarget.y = y;
    },
    setScroll(progress) {
      scrollProgress = progress;
    },
    dispose() {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      geometry.dispose();
      material.dispose();
      ringGroup.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      satelliteParts.forEach(({ geo, mat }) => {
        geo.dispose();
        mat.dispose();
      });
      sparkleGeo.dispose();
      sparkleMat.dispose();
      renderer.dispose();
    },
  };
}
