import { useEffect, useLayoutEffect } from 'react';

/**
 * `useLayoutEffect` yang tidak memunculkan warning saat render di server.
 * Menggantikan versi lama yang dulu tinggal di useGsapMedia.ts.
 */
export const useIsoLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;