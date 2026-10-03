/**
 * Komposisi aplikasi.
 *
 * Dua tampilan, dipilih dari hash URL - bukan router, dan tidak ada dependensi
 * baru. `useHashRoute()` membaca hash sekali saat render pertama, jadi membuka
 * `#daftar` langsung memunculkan halaman form tanpa kedipan halaman utama
 * lebih dulu.
 *
 * Urutan tidak lagi punya provider scroll: halaman memakai scroll native
 * browser. Dari belakang ke depan:
 *   Navbar            -> fixed, berganti solid+blur saat scroll.
 *   main #top         -> seluruh section stacking (kartu menumpuk CSS).
 *   Footer            -> di luar main, mengikuti setelah CTA.
 *   GrainOverlay      -> dekoratif, paling atas, pointer-events none.
 *   CursorLayer       -> kursor kustom, hanya mode 'rich'.
 *
 * Kenapa `<main>` hanya di halaman utama: halaman form memakai
 * `RegistrationPage` yang sudah menjadi akar turunannya sendiri. Dua `<main>`
 * yang saling menimpa bukan hanya Landmark yang ambiguous bagi screen reader,
 * tapi juga membuat skip-link "Lewati ke konten" punya dua tujuan berbeda
 * tergantung halaman mana yang sedang tampil - dan itu sebabnya skip-link
 * harus ditulis ulang di bawah.
 *
 * URUTAN HOOK DIBAWAH INI PENTING, BUKAN GAYA PENULISAN
 * ------------------------------------------------------
 * `useHashRoute()` dipanggil sebelum `useSmoothScroll()` karena effect
 * dijalankan sesuai urutan deklarasi, dan `useHashRoute` yang menulis posisi
 * scroll saat halaman berganti. Kalau urutannya dibalik, form yang baru
 * terbuka akan mulai di posisi scroll halaman utama yang baru saja ditinggalkan.
 */
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { WhyHelixa } from './components/WhyHelixa';
import { PerdanaInfo } from './components/PerdanaInfo';
import { HowToJoin } from './components/HowToJoin';
import { JudgesPartners } from './components/JudgesPartners';
import { RulesTransparency } from './components/RulesTransparency';
import { Faq } from './components/Faq';
import { ClosingCta, Footer } from './components/ClosingCta';
import { CursorLayer } from './components/CursorLayer';
import { GrainOverlay } from './components/ornaments/GrainOverlay';
import { RegistrationPage } from './components/RegistrationPage';
import { useSmoothScroll } from './hooks/useSmoothScroll';
import { useHashRoute } from './hooks/useHashRoute';

export default function App() {
  const route = useHashRoute();
  const onLanding = route === 'landing';

  // Smooth scroll (GSAP ticker, hanya mode 'rich' DAN hanya di halaman utama).
  // ScrollPosition tetap native supaya `position: sticky` di section overlap
  // tetap bekerja.
  useSmoothScroll(onLanding);

  // Skip-link harus mengarah ke konten halaman yang sedang tampil. Menunjuk
  // `#top` selalu di halaman form akan gagal: tidak ada elemen itu di sana, dan
  // browser tidak melakukan apa-apa pada hash yang tidak menunjuk elemen.
  const skipHref = onLanding ? '#tentang' : '#daftar-nama';

  return (
    <>
      <a
        href={skipHref}
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-full focus:border focus:border-gold focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:text-bone"
      >
        Lewati ke konten
      </a>

      <Navbar />

      {onLanding ? (
        <>
          <main id="top">
            <Hero />
            <WhyHelixa />
            <PerdanaInfo />
            <HowToJoin />
            <JudgesPartners />
            <RulesTransparency />
            <Faq />
            <ClosingCta />
          </main>

          <Footer />
        </>
      ) : (
        <RegistrationPage />
      )}

      <GrainOverlay />
      <CursorLayer />
    </>
  );
}