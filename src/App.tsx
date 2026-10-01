/**
 * Komposisi aplikasi.
 *
 * Urutan tidak lagi punya provider scroll: halaman memakai scroll native
 * browser. Dari belakang ke depan:
 *   Navbar            -> fixed, berganti solid+blur saat scroll.
 *   main #top         -> seluruh section stacking (kartu menumpuk CSS).
 *   Footer            -> di luar main, mengikuti setelah CTA.
 *   GrainOverlay      -> dekoratif, paling atas, pointer-events none.
 *   CursorLayer       -> kursor kustom, hanya mode 'rich'.
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
import { useSmoothScroll } from './hooks/useSmoothScroll';

export default function App() {
  // Smooth scroll (GSAP ticker, hanya mode 'rich'). ScrollPosition tetap
  // native supaya `position: sticky` di section overlap tetap bekerja.
  useSmoothScroll();

  return (
    <>
      <a
        href="#tentang"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-full focus:border focus:border-gold focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:text-bone"
      >
        Lewati ke konten
      </a>

      <Navbar />

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
      <GrainOverlay />
      <CursorLayer />
    </>
  );
}