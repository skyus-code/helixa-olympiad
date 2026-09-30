import type { ReactNode } from 'react';

type SectionProps = {
  id: string;
  /**
   * Tingkat tumpukan kartu. Harus naik sesuai urutan section (Hero=10,
   * Kenapa Helixa=20, Perdana=30, ...) supaya section yang datang belakangan
   * selalu tampil DI ATAS section sebelumnya saat menumpuk.
   */
  z: number;
  children: ReactNode;
  /**
   * Kartu berbentuk (radius sudut atas + bayangan ke atas). Semua section
   * utama adalah kartu KECUALI Hero.
   */
  card?: boolean;
  className?: string;
  /** Padding vertikal ditimpa, mis. section hero yang butuh layar penuh. */
  innerClassName?: string;
  /** Lebar isi. `wide` dipakai section dengan daftar dua kolom. */
  width?: 'default' | 'wide' | 'narrow';
};

/**
 * Pembungkus section dengan efek "kartu menumpuk" (stacking).
 *
 * Desktop (>=768px): section dipin `position: sticky; top: 0; min-height:
 * 100svh` dengan z-index bertingkat, sehingga saat digulir tiap section naik
 * dan menutupi section sebelumnya seperti kartu — murni CSS, tanpa listener
 * scroll. `.stack-wrap--card` menambah radius sudut atas 28px + bayangan agar
 * terasa "mengambang".
 *
 * Mobile (<768px): pin dilepas (normal flow) agar konten section yang lebih
 * tinggi dari viewport tetap terbaca penuh; kesan bertumpuk dipertahankan
 * lewat z-index, radius, bayangan, dan overlap kecil antar kartu.
 *
 * prefers-reduced-motion: seluruh mekanisme dimatikan di CSS — section
 * tersusun berurutan biasa, tanpa radius/bayangan.
 */
export function Section({
  id,
  z,
  children,
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

  return (
    <section
      id={id}
      className={`stack-wrap ${card ? 'stack-wrap--card' : ''} ${className}`}
      style={{ zIndex: z, scrollMarginTop: '88px' }}
    >
      <div
        className={`shell ${innerClassName}`}
        style={{ ['--shell-max' as string]: shellMax }}
      >
        {children}
      </div>
    </section>
  );
}