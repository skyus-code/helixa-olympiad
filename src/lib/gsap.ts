/**
 * Registrasi plugin GSAP — titik tunggal dalam aplikasi.
 *
 * Semua plugin yang dipakai (ScrollTrigger dan SplitText) sudah
 * menyatu di paket npm `gsap` resmi sejak 3.13, jadi tidak ada plugin club
 * terpisah yang perlu dipasang.
 *
 * Penting: ScrollTrigger harus diregistrasikan sebelum Lenis querying ticker.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

/** Matikan warning internal GSAP soal transform pada elemen non-block. */
gsap.config({ nullTargetWarn: false });

export { gsap, ScrollTrigger, SplitText };
export default gsap;
