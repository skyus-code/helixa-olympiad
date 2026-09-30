import type { ReactNode } from 'react';

type SectionProps = {
  id: string;
  /**
   * Tingkat tumpukan. Harus naik sesuai urutan section (Hero=10,
   * Kenapa Helixa=20, Perdana=30, ...) supaya section yang datang belakangan
   * selalu tampil DI ATAS section sebelumnya.
   *
   * Nilai ini tetap dipakai section yang tidak menumpuk, karena section
   * berikutnya harus bisa melewati section yang sedang di-pin.
   */
  z: number;
  children: ReactNode;
  /**
   * Aktifkan efek "kartu menumpuk". SENGaja hanya dua section yang memakai
   * ini — lihat catatan di bawah.
   *
   * Kenapa dibatasi: ketika semua section memakai sticky + radius + bayangan,
   * halaman berhenti terbaca sebagai bagian-bagian yang berbeda dan berubah
   * jadi tumpukan slab yang seragam. Efeknya sendiri cuma terasa di awal
   * scroll, jadi dua section pertama sudah cukup untuk menyampaikananya.
   */
  stack?: boolean;
  /** Kartu berbentuk (radius sudut atas + bayangan ke atas). Tidak berlaku
   *  kalau `stack` mati — section biasa memakai garis rambut, bukan kartu. */
  card?: boolean;
  className?: string;
  /** Padding vertikal ditimpa, mis. section hero yang butuh layar penuh. */
  innerClassName?: string;
  /** Lebar isi. `wide` dipakai section dengan daftar dua kolom. */
  width?: 'default' | 'wide' | 'narrow';
};

/**
 * Pembungkus section.
 *
 * Ada dua bentuk, dan pemisahan ini disengaja:
 *
 * 1. `stack` — efek kartu menumpuk. Desktop (>=768px): section dipin
 *    `position: sticky; top: 0; min-height: 100svh` dengan z-index bertingkat,
 *    sehingga saat digulir section berikutnya naik menutupi section sebelumnya
 *    seperti kartu — murni CSS, tanpa listener scroll. Radius sudut atas 28px
 *    + bayangan ke atas membuatnya terasa mengambang.
 *
 *    Mobile (<768px): pin dilepas (normal flow) supaya konten section yang
 *    lebih tinggi dari viewport tetap terbaca penuh. Kesan bertumpuk
 *    dipertahankan lewat radius, bayangan, dan overlap 28px ke atas.
 *
 * 2. Section biasa — flow normal, tinggi mengikuti isi, dipisah dari section
 *    sebelumnya oleh garis rambut emas. Dipakai semua section setelah zona
 *    tumpukan.
 *
 * prefers-reduced-motion: seluruh mekanisme dimatikan di CSS — section
 * tersusun berurutan biasa, tanpa radius/bayangan/overlap.
 */
export function Section({
  id,
  z,
  children,
  stack = false,
  card = true,
  className = '',
  innerClassName = 'py-18 md:py-24 lg:py-30',
  width = 'default',
}: SectionProps) {
  const shellMax = {
    default: '1120px',
    wide: '1240px',
    narrow: '820px',
  }[width];

  const classes = ['stack-wrap'];
  if (stack) {
    classes.push('stack-wrap--stack');
    if (card) classes.push('stack-wrap--card');
  } else {
    classes.push('stack-wrap--rule');
  }

  return (
    <section
      id={id}
      className={`${classes.join(' ')} ${className}`}
      style={{ zIndex: z, scrollMarginTop: '88px' }}
    >
      <div className={`shell ${innerClassName}`} style={{ ['--shell-max' as string]: shellMax }}>
        {children}
      </div>
    </section>
  );
}
