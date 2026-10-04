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
import { NAV_CTA, NAV_LINKS } from '../content';

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

/*
 * Durasi transisi header, harus sama dengan `duration-700` di className
 * header. Dipakai untuk menunda `inert` sampai fade-out selesai.
 */
const HEADER_FADE_MS = 700;

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

  /* Keadaan tampilan header: muncul hanya setelah scroll 40px DAN panel
   * mobile tertutup. Satu sumber kebenaran untuk className, `inert`, dan
   * refleksi - sebelumnya tiga tempat menghitungnya sendiri. */
  const shown = scrolled && !open;

  /*
   * Header tersembunyi (opacity-0) TETAP bisa diklik dan difokus: opacity
   * tidak mematikan hit-testing maupun tab-order. DiUkur di halaman ini,
   * `a.focus()` ke tombol "Daftar" berhasil saat scrollY=0, padahal
   * user tidak melihat apa pun. Itu bug aksesibilitas, bukan desain:
   * orang yang pakai keyboard menabrak link tak terlihat, dan klik di
   * area atas halaman mendarat ke navbar yang tak terlihat.
   *
   * `inert`_membereskan keduanya sekaligus - keluar dari tab-order, keluar
   * dari hit-testing, dan tidak diumumkan pembaca layar.
   *
   * Kenapa bukan `inert={!shown}` yang polos? Karena saat user menggulir
   * ke atas, navbar mulai memudar selama 700ms. Kalau langsung inert,
   * klik di tengah fade-out itu diam-diam tidak melakukan apa-apa -
   * user masih melihat tombolnya. Jadi `inert` ditunda sampai transisi
   * benar-benar selesai: selama itu navbar masih di layar, jadi masih
   * boleh dipakai.
   */
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    if (shown) {
      setInteractive(true);
      return;
    }
    const t = window.setTimeout(() => setInteractive(false), HEADER_FADE_MS);
    return () => window.clearTimeout(t);
  }, [shown]);

  return (
    <>
      <header
        inert={!interactive}
        className={
          'fixed z-[100] left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] sm:w-[calc(100%-3rem)] max-w-5xl transition-all duration-700 ease-out ' +
          'rounded-2xl sm:rounded-full ' +
          (shown
            ? 'top-3 sm:top-4 md:top-5 opacity-100 translate-y-0 scale-100 border border-gold-line/60 bg-ink/40 backdrop-blur-2xl backdrop-saturate-150 backdrop-brightness-110 shadow-[0_16px_36px_-10px_rgba(0,0,0,0.8),0_0_24px_-4px_rgba(212,175,55,0.12),inset_0_1px_1px_rgba(255,255,255,0.18)]'
            : 'top-1 sm:top-2 md:top-3 opacity-0 -translate-y-4 scale-[0.98] border border-transparent bg-transparent shadow-none')
        }
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        {/* Tekstur Glass reflection & highlights */}
        <div
          aria-hidden="true"
          className={
            'pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] transition-opacity duration-700 ' +
            (shown ? 'opacity-100' : 'opacity-0')
          }
        >
          {/* Specular highlight on the top lip of the glass. This is the single
              strongest "this is glass" cue: a hard bright line where the curved
              surface catches the light, fading out toward both ends. */}
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          {/* Second, wider and softer highlight just under it: gives the lip some
              thickness instead of reading as a 1px sticker. */}
          <div className="absolute inset-x-10 top-px h-[3px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          {/* Sheen sweeping down the face of the glass from the top. */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.14] via-white/[0.03] to-transparent" />
          {/* Curved-surface sheen: an off-centre elliptical hotspot, which is what
              a flat vertical gradient can never fake. */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_120%_at_28%_-10%,rgba(255,255,255,0.16),transparent_70%)]" />
          {/* Warm gold bounce along the bottom lip, tying the glass to the palette. */}
          <div className="absolute inset-x-12 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        </div>

        <nav
          aria-label="Navigasi utama"
          className="relative flex h-14 sm:h-16 items-center justify-center gap-4 px-4 sm:px-6 md:px-7"
        >
          <div className="hidden items-center gap-7 md:flex">
            <ul className="flex items-center gap-7">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="nav-link inline-flex min-h-11 min-w-11 items-center justify-center px-1.5 text-[0.9375rem] font-medium text-bone/85 transition-colors duration-200 hover:text-gold"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={NAV_CTA.href}
              className="btn btn-shimmer bg-gold-gradient inline-flex min-h-11 items-center justify-center rounded-full px-5 text-[0.875rem] font-semibold text-ink shadow-[0_4px_16px_-4px_rgba(212,175,55,0.4)]"
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
            className="btn -mr-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-gold md:hidden"
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
          <div className="shell flex h-16 shrink-0 items-center justify-end">
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