/**
 * Teks situs yang bisa diubah admin: satu sumber untuk seluruh halaman.
 *
 * KENAPA STORE MODUL, BUKAN `useState` PER KOMPONEN
 * ------------------------------------------------
 * Section "Perdana" dan "Juri & Mitra" memuat data yang sama, dan keduanya
 * bisa tampil bersamaan di halaman utama. Kalau masing-masing mengambil
 * sendiri, halaman yang sama melakukan dua permintaan untuk data yang identik
 * dan bisa menampilkan dua keadaan berbeda selama satu frame (satu sudah
 * terisi, satu belum). Satu store dengan `useSyncExternalStore` membuat
 * pembacaannya gratis setelah permintaan pertama, dan mustahil tidak
 * sinkron.
 *
 * KENAPA SEMUANYA PUNYA NILAI BAWAAN
 * ----------------------------------
 * `src/content.ts` tetap jadi isi situs. Database hanya MENIMPA. Karena itu:
 * API mati, database kosong, atau balasan tidak berbentuk JSON - semuanya
 * berakhir pada halaman yang tetap utuh dengan teks bawaan, bukan halaman
 * kosong atau error. Perilaku itu yang diuji `scripts/verify.mjs`, dan itu
 * pula yang membuat `npm run preview` tanpa `npm run api` tetap bisa dipakai.
 */
import { useSyncExternalStore } from 'react';
import { PERDANA } from '../content';
import { fetchContent } from './api';
import type { Person } from './api';

export interface SiteContent {
  /** `loading` hanya selama permintaan pertama berjalan. */
  status: 'loading' | 'ready' | 'default';
  settings: Record<string, string>;
  /** `null` berarti pakai `JUDGES.items` bawaan. */
  people: Person[] | null;
}

/**
 * Baris `PERDANA.details` yang bisa diedit admin, dipasangkan dengan kunci
 * `settings`-nya.
 *
 * Pemasangannya lewat `label` karena itu yang sudah ada di `content.ts` dan
 * yang dibaca manusia. Kunci database sengaja bertitik (`perdana.pendaftaran`)
 * supaya jelas milik section mana dan tidak bertabrakan dengan field form.
 */
export const PERDANA_FIELDS = [
  { label: 'Pendaftaran', key: 'perdana.pendaftaran' },
  { label: 'Pelaksanaan', key: 'perdana.pelaksanaan' },
  { label: 'Pengumuman', key: 'perdana.pengumuman' },
  { label: 'Hadiah', key: 'perdana.hadiah' },
] as const;

/** Penanda "belum diisi" yang dipakai `content.ts`, mis. `[ISI TANGGAL]`. */
const PLACEHOLDER_RE = /\[ISI/i;

let snapshot: SiteContent = { status: 'loading', settings: {}, people: null };
const listeners = new Set<() => void>();
let started = false;

function emit(): void {
  for (const listener of listeners) listener();
}

async function load(): Promise<void> {
  const payload = await fetchContent();
  snapshot = payload
    ? { status: 'ready', settings: payload.settings, people: payload.people }
    : { status: 'default', settings: {}, people: null };
  emit();
}

/** Ambil ulang setelah admin menyimpan perubahan. */
export async function reloadContent(): Promise<void> {
  await load();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!started) {
    started = true;
    void load();
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SiteContent {
  return snapshot;
}

function getServerSnapshot(): SiteContent {
  return snapshot;
}

export function useSiteContent(): SiteContent {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* -------------------------------------------------------------------------- */

export interface PerdanaDetail {
  label: string;
  value: string;
  placeholder: boolean;
}

/**
 * Detail "Perdana" dengan nilai dari database bila ada.
 *
 * `placeholder` HANYA dihitung ulang untuk baris yang benar-benar ditimpa.
 * Kalau tidak, teks bawaan yang sebagian masih placeholder (mis. Hadiah yang
 * berbunyi "e-sertifikat untuk semua peserta; [ISI JIKA ADA]") akan berubah
 * warna tanpa ada yang mengubahnya - perubahan tampilan yang tidak diminta
 * siapa pun, hanya karena aturan baru diterapkan surut.
 */
export function perdanaDetails(settings: Record<string, string>): PerdanaDetail[] {
  const byLabel = new Map<string, string>(PERDANA_FIELDS.map((f) => [f.label, f.key]));

  return PERDANA.details.map((detail) => {
    const key = byLabel.get(detail.label);
    const overridden = key !== undefined && typeof settings[key] === 'string';
    const value = overridden ? settings[key] : detail.value;

    return {
      label: detail.label,
      value,
      placeholder: overridden ? PLACEHOLDER_RE.test(value) : detail.placeholder,
    };
  });
}

export interface PersonCard {
  key: string;
  kind: string;
  monogram: string;
  name: string;
  role: string;
}

/**
 * Juri & mitra: dari database kalau ada isinya, kalau tidak dari bawaan.
 *
 * `key` untuk React memakai `id` database, bukan monogram. Dua orang dengan
 * inisial sama adalah hal biasa (dan justru itu gunanya monogram), sementara
 * `key` yang sama akan membuat React memakai ulang node yang salah.
 */
export function peopleCards(people: Person[] | null): PersonCard[] {
  if (!people || people.length === 0) {
    return [];
  }
  return people.map((person) => ({
    key: 'db-' + person.id,
    kind: person.kind,
    monogram: person.monogram || person.name.charAt(0).toUpperCase(),
    name: person.name,
    role: person.role,
  }));
}
