/**
 * Aturan & Transparansi: objek armillary (cincin presisi berlapis).
 *
 * Bentuk: 4 cincin TorusGeometry wireframe emas, tiap cincin berputar pada
 * sumbu yang berbeda seperti armillary sphere/giroskop astronomi.
 *
 * Alasan bentuknya (dari brief, dan alasan itu benar secara semantik):
 *   - cincin presisi berlapis = ketertiban & aturan
 *   - wireframe tembus pandang = transparansi
 *   - gerakan konsisten & dapat diprediksi = kepercayaan
 *
 * Pencahayaan sengaja TIDAK dipakai. Cincin di rotate pada sumbu berbeda,
 * sehingga spekular highlight akan berkedip-kedip acak dan justru merusak
 * "dapat diprediksi". MeshBasicMaterial dengan warna emas konstan memberi
 * hasil yang tenang dan cheap, dan memenuhi alasan bentuk di atas.
 *
 * Ini pengecualian infinite-loop kedua dan terakhir yang resmi: putaran
 * giroskop. Bersama putaran DNA di Hero, itulah dua-satunya loop
 * abadi di situs.
 *
 * Modul hanya dimuat lewat dynamic import dari GyroCanvas.tsx yang hanya
 * aktif di mode 'rich' dan hanya saat section mendekati viewport.
 */

import * as THREE from 'three';

export interface GyroHandle {
  setPaused(p: boolean): void;
  dispose(): void;
}

const DPR_MAX = 2;
const OPACITY = 0.55; // 0.5-0.6: tidak boleh mengalahkan teks aturan

/**
 * Radius paket armillary, dipakai untuk fitting kamera.
 *
 * Cincin terluar (RINGS[0].radius) tepat 1.0, dan `TorusGeometry` dengan
 * `tubularSegments`/`radialSegments` membuat polygon's edge sedikit di luar
 * radius ideal - pinggiran kecil ini menutup selisihnya.
 */
const FIT_RADIUS = 1.03;

/**
 * Ruang kosong di sekeliling armillary, sebagai fraksi dari FIT_RADIUS.
 *
 * 1.0 berarti pas menyentuh tepi. Di sinilah objek ini pernah "hilang-hilang":
 * pada nilai 1.0, cincin menyinggung tepi kanvas dan terpotong sedikit, jadi
 * yang terlihat hanya dua busur tipis - persis gejala yang dilaporkan.
 */
const FIT_MARGIN = 1.18;

/** Emas khusus wireframe, sedikit lebih hangat dari emas UI. */
const GOLD = new THREE.Color('#D4AF37');
const GOLD_BRIGHT = new THREE.Color('#F6E7B4');

/**
 * Empat cincin. Sumbu rotasi sengaja disebar (X, Y, Z, dan diagonal) supaya
 * geraknya tidak menghasilkan pola berulang yang mudah ditebak mata.
 */
const RINGS = [
  { radius: 1.0, tube: 0.006, tilt: 0, speed: 0.35, color: GOLD },
  { radius: 0.86, tube: 0.005, tilt: Math.PI / 2, speed: -0.52, color: GOLD_BRIGHT },
  { radius: 0.72, tube: 0.005, tilt: Math.PI / 3, speed: 0.44, color: GOLD },
  { radius: 0.58, tube: 0.004, tilt: -Math.PI / 3, speed: -0.28, color: GOLD_BRIGHT },
] as const;

export function createGyroScene(
  canvas: HTMLCanvasElement,
  opts: { reduced?: boolean } = {},
): GyroHandle {
  const reduced = opts.reduced === true;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true, // garis wireframe tipis, MSAA sangat berharga di sini
    alpha: true,
    powerPreference: 'low-power', // satu cincin kecil, tidak perlu high-performance
    preserveDrawingBuffer: true, // dibutuhkan untuk screenshot verifikasi
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0, 4.2);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  scene.add(group);

  const disposables: Array<{ dispose(): void }> = [];

  for (const ring of RINGS) {
    const geo = new THREE.TorusGeometry(ring.radius, ring.tube, 3, 96);
    const mat = new THREE.MeshBasicMaterial({
      color: ring.color,
      wireframe: true,
      transparent: true,
      opacity: OPACITY,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = ring.tilt;
    mesh.rotation.y = ring.tilt * 0.5;
    // Kecepatan disimpan di userData, bukan di closure per mesh, supaya loop
    // render tetap satu iterasi tunggal tanpa array terpisah.
    mesh.userData.speed = ring.speed;
    group.add(mesh);
    disposables.push(geo, mat);
  }

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
    camera.aspect = aspect;

    /*
     * JARAK KAMERA DIHITUNG, BUKAN FIXED.
     *
     * Versi sebelumnya menaruh kamera di z = 4.2 lalu hanya membiarkan aspect
     * mengikuti kotak kanvas. Dua-duanya salah untuk tujuan yang sama:
     *
     *   - `PerspectiveCamera` memakai fov VERTIKAL, jadi saat kanvas lebih lebar
     *     daripada tingginya, bidang pandang ke arah x justru lebih sempit.
     *   - Pada fov 38 dan z = 4.2, setengah tinggi bidang pandang di z = 0 hanya
     *     1.446, sedangkan cincin terluar radiusnya 1.0. Diameternya jadi 138%
     *     dari tinggi kanvas, jadi bagian atas DAN bawah setiap cincin
     *     terpotong - di SEMUA lebar layar.
     *
     * Yang tersisa tinggal dua busur tipis. Dan karena banyaknya bagian yang
     * terpotong ikut berubah-ubah mengikuti tinggi section, objeknya terlihat
     * "kadang muncul kadang hilang" - bukan karena scene mati, tapi karena
     * sebagian besarnya ada di luar kanvas.
     *
     * Di sini jaraknya dipilih supaya seluruh armillary muat di KEDUA sumbu,
     * dengan ruang kosong FIT_MARGIN. Kanvas boleh lebar, tinggi, atau persegi;
     * hasilnya sama saja: cincin utuh, di tengah.
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
      // Cincin berputar pada sumbu Y-nya sendiri, sementara tilt yang dipasang
      // di constructor tetap: hasil akhirnya cincin-cincin berputar pada sumbu
      // yang berbeda satu sama lain.
      const speed = (child.userData as { speed?: number }).speed ?? 0;
      child.rotation.y += speed / 60;
      child.rotation.z += speed / 120;
    }
    group.rotation.y = Math.sin(time * 0.18) * 0.16; // denyut pelan, sangat halus
    renderer.render(scene, camera);
  }

  if (reduced) {
    // Reduced-motion: satu frame statis, cincin tetap terlihat.
    renderer.render(scene, camera);
  } else {
    raf = requestAnimationFrame(frame);
  }

  // Jeda saat tab disembunyikan, lanjut lagi saat kembali.
  //
  // Syarat di cabang `else` pernah terbalik (`!paused`), sehingga handler ini
  // tidak pernah menyalakan loop lagi setelah tab disembunyikan. Gejalanya
  // tidak terlihat karena GyroCanvas memanggil setPaused(false) dari listener
  // visibilitychange-nya sendiri, tapi begitu listener itu dihapus, masuk
  // kembali ke section tidak akan memulai putaran sama sekali.
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
      renderer.forceContextLoss();
    },
  };
}