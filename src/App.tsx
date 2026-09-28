import { MotionProvider } from './components/MotionProvider';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { WhyHelixa } from './components/WhyHelixa';
import { PerdanaInfo } from './components/PerdanaInfo';
import { HowToJoin } from './components/HowToJoin';
import { JudgesPartners } from './components/JudgesPartners';
import { RulesTransparency } from './components/RulesTransparency';
import { Faq } from './components/Faq';
import { ClosingCta } from './components/ClosingCta';
import { Footer } from './components/Footer';
import { GrainOverlay } from './components/ornaments/GrainOverlay';

export default function App() {
  return (
    <MotionProvider>
      <a
        href="#tentang"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:border focus:border-gold/40 focus:bg-surface focus:px-5 focus:text-sm focus:font-medium focus:text-bone"
      >
        Lewati ke konten
      </a>

      <Navbar />

      <main className="relative">
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
    </MotionProvider>
  );
}
