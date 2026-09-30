/**
 * Komposisi aplikasi.
 *
 * Urutan provider itu penting:
 *   SmoothScrollProvider  -> membuat Lenis dan menyinkronkan ScrollTrigger.
 *                           Harus di luar supaya komponen anak (mis. Navbar
 *                           yang menghentikan Lenis saat menu terbuka) bisa
 *                           mengakses instance-nya.
 *   GrainOverlay          -> dekoratif, paling atas, pointer-events none.
 *   CursorLayer           -> kursor kustom, hanya di pointer presisi.
 */
import { SmoothScrollProvider } from './hooks/useSmoothScroll';
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

export default function App() {
  return (
    <SmoothScrollProvider>
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
    </SmoothScrollProvider>
  );
}
