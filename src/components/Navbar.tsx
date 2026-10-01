/**
 * Navbar.
 *
 * Transparan di atas; setelah scroll 40px berubah menjadi solid + blur + garis
 * emas. Panel mobile: kunci body scroll, kunci fokus, tutup dengan Esc —
 * tanpa integrasi Lenis (scroll native murni).
 *
 * Tinggi z-index sengaja di atas seluruh section stacking (header z-[100]),
 * supaya kartu section yang tertahan di `top: 0` tidak pernah menutupi menu.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsoLayoutEffect } from '../hooks/useIsoLayoutEffect';
import { NAV_CTA, NAV_LINKS, SITE } from '../content';

function Wordmark() {
  return (
    <a
      href="#top"
      className="flex min-h-11 items-center gap-2 transition-opacity duration-300 ease-out hover:opacity-80"
      aria-label={SITE.wordmark + ' ' + SITE.wordmarkSuffix + ' - kembali ke atas'}
    >
      <span className="font-display text-[1.75rem] leading-none font-semibold text-gold md:text-[2rem]">
        {SITE.wordmark}
      </span>
      <span className="hidden font-sans text-[0.6875rem] tracking-[0.18em] text-bone-dim uppercase sm:inline">
        {SITE.wordmarkSuffix}
      </span>
    </a>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" className="relative block h-4 w-5">
      <span
        className={
          'absolute left-0 block h-px w-5 bg-gold transition-transform duration-300 ease-out ' +
          (open ? 'top-1/2 rotate-45' : 'top-0.5')
        }
      />
      <span
        className={
          'absolute left-0 top-1/2 block h-px w-5 -translate-y-1/2 bg-gold transition-opacity duration-300 ease-out ' +
          (open ? 'opacity-0' : 'opacity-100')
        }
      />
      <span
        className={
          'absolute left-0 block h-px w-5 bg-gold transition-transform duration-300 ease-out ' +
          (open ? 'top-1/2 -rotate-45' : 'top-[0.9375rem]')
        }
      />
    </span>
  );
}

/**
 * Batas umur handle requestAnimationFrame. Kalau rAF yang dijadwalkan belum
 * juga jalan setelah ini, dianggap jatuh dan tidak lagi dipercaya sebagai
 * "sudah ada pembaruan terjadwal". See catatan throttle di efek navbar.
 */
const STALE_MS = 300;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  /*
   * Transparan di atas; semi-transparan + blur + garis emas setelah 40px.
   *
   * Throttle pakai cap WAKTU, bukan handle requestAnimationFrame yang disimpan
   * sebagai boolean "sudah ada frame_pending".
   *
   * Pola lama (`if (frame) return; frame = requestAnimationFrame(...)`) punya
   *-mode gagal yang permanen: kalau rAF itu dijatuhkan browser - yang terjadi
   * saat renderer sedang sibuk, tab di-throttle, atau headless sedang
   * mengambil screenshot - callback-nya tidak pernah jalan, jadi penanda
   * `frame` tidak pernah dikembalikan ke 0. Setelah itu SETIAP event scroll
   * berikutnya ditolak, dan navbar tidak pernah berubah lagi sampai halaman
   * dimuat ulang. Symptom-nyaExactly "navbar tetap transparan padahal sudah
   * di-scroll", persis yang terpakai.
   *
   * Dengan cap waktu, kegagalan rAF yang terjatuh hanya menunda pembaruan satu
   * frame: begitu handle dianggap basi (lebih lama dari STALE_MS tanpa pernah
   * jalan), event scroll berikutnya boleh menjadwalkan rAF baru. Jadi state pulih
   * sendiri tanpa perlu memuat ulang halaman.
   */
  useEffect(() => {
    const THROTTLE_MS = 100;
    /** Cap waktu rAF terakhir yang benar-benar JALAN, bukan yang dijadwalkan. */
    let lastRun = 0;
    /** Handle rAF terjadwal, atau 0. */
    let frame = 0;
    /** Kapan rAF di atas dijadwalkan. Dipakai untuk mengenali frame yang jatuh. */
    let scheduledAt = 0;

    const run = () => {
      frame = 0;
      lastRun = performance.now();
      setScrolled(window.scrollY > 40);
    };

    const onScroll = () => {
      const now = performance.now();
      // Frame sudah menjadwal DAN masih dianggap hidup: jangan antre dua kali.
      if (frame && now - scheduledAt < STALE_MS) return;
      // Terlalu baru setelah frame terakhir benar-benar jalan: nilai scrollY
      // dibaca di dalam rAF, jadi membaca sekarang hanya membuang kerja.
      if (now - lastRun < THROTTLE_MS) return;
      scheduledAt = now;
      frame = window.requestAnimationFrame(run);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  /* Panel terbuka: kunci body, kunci fokus, tutup dengan Esc. */
  useIsoLayoutEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { body } = document;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;

    body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) body.style.paddingRight = scrollBarWidth + 'px';

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
      ).filter((el) => el.offsetParent !== null);

    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
      (previouslyFocused ?? toggleRef.current)?.focus?.();
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <header
        className={
          'fixed inset-x-0 top-0 z-[100] transition-[background-color,backdrop-filter,border-color] duration-500 ease-out ' +
          (scrolled && !open
            ? 'border-b border-gold-line bg-ink/72 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent')
        }
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <nav
          aria-label="Navigasi utama"
          className="shell flex h-16 items-center justify-between gap-4 md:h-18"
        >
          <Wordmark />

          <div className="hidden items-center gap-7 md:flex">
            <ul className="flex items-center gap-7">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="nav-link inline-flex min-h-11 min-w-11 items-center justify-center px-1.5 text-[0.9375rem] font-medium text-bone/85 hover:text-bone"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={NAV_CTA.href}
              className="btn btn-shimmer bg-gold-gradient inline-flex min-h-11 items-center justify-center rounded-full px-5 text-[0.875rem] font-semibold text-ink"
            >
              {NAV_CTA.label}
            </a>
          </div>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
            className="btn -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full md:hidden"
          >
            <MenuIcon open={open} />
          </button>
        </nav>
      </header>

      {open && (
        <div
          id="menu-mobile"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi"
          className="menu-panel fixed inset-0 z-[120] flex flex-col bg-ink/97 backdrop-blur-xl md:hidden"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="shell flex h-16 shrink-0 items-center justify-between">
            <Wordmark />
            <button
              type="button"
              onClick={close}
              aria-label="Tutup menu"
              className="btn -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-gold"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="h-5 w-5"
              >
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>

          <ul className="shell flex flex-1 flex-col justify-center gap-1 py-6">
            {NAV_LINKS.map((link) => (
              <li key={link.href} data-menu-link>
                <a
                  href={link.href}
                  onClick={close}
                  className="flex min-h-14 w-full items-center font-display text-3xl font-medium text-bone/90 transition-colors duration-300 ease-out active:text-gold"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div
            className="shell shrink-0 pb-6"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          >
            <a
              href={NAV_CTA.href}
              onClick={close}
              className="btn bg-gold-gradient flex min-h-13 w-full items-center justify-center rounded-full px-6 py-3.5 text-base font-semibold text-ink"
            >
              {NAV_CTA.label}
            </a>
          </div>
        </div>
      )}
    </>
  );
}