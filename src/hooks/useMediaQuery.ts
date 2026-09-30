import { useEffect, useState } from 'react';

/**
 * Abonemen query media dengan state React.
 *
 * Dipakai sebagai pengganti `gsap.matchMedia`: komponen membaca hasilnya dan
 * memilih apakah akan memasang animasi atau tidak. Saat query berubah (resize,
 * user mengubah preferensi reduced-motion), komponen re-render dan unmount
 * animasi lama.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    // Fallback Safari lama.
    (mq as unknown as { addListener: (fn: () => void) => void }).addListener(update);
    return () =>
      (mq as unknown as { removeListener: (fn: () => void) => void }).removeListener(update);
  }, [query]);

  return matches;
}