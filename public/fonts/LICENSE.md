# Font di dalam folder ini

| File | Asal | Lisensi | Cakupan |
|---|---|---|---|
| `cormorant-garamond-latin-var.woff2` | Google Fonts — Cormorant Garamond (Christian Thalmann) | SIL Open Font License 1.1 | latin, weight 500–600 (variable) |
| `manrope-latin-var.woff2` | Google Fonts — Manrope (Mikhail Sharanda) | SIL Open Font License 1.1 | latin, weight 400–600 (variable) |

Kedua berkas ini adalah *subset* latin dalam format WOFF2 variable — hanya rentang
weight yang benar-benar dipakai situs, sehingga totalnya ~62 kB dan tidak ada
permintaan ke pihak ketiga saat halaman dimuat. `.gitignore` tidak mengecualikan
folder ini, jadi kedua berkas ikut ter-*commit*.

Teks lengkap SIL Open Font License 1.1: <https://openfontlicense.org/>

Aturan lisensi yang relevan bila font ini diubah atau didistribusikan ulang: nama
font tetap harus menyertakan copyright aslinya, dan font tidak boleh dijual
sendirian.
