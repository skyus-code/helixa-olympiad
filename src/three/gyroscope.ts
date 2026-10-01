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
    camera.aspect = w / Math.max(1, h);
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