-- Skema database Helixa Olympiad.
--
-- Kenapa database terpisah, bukan menumpang database lain di server yang sama:
-- `npm run db:setup` menjalankan file ini apa adanya, dan `CREATE DATABASE`
-- paling aman kalau namanya eksplisit. Tidak ada tabel milik aplikasi lain
-- yang disentuh.
--
-- Isi tiga tabel, dan pemisahannya mengikuti siapa yang menulisnya:
--
--   settings      -- teks yang diubah admin dan dibaca SEMUA pengunjung
--                    (tanggal pendaftaran/pelaksanaan/pengumuman, hadiah).
--                    Bentuk key-value karena jumlahnya sedikit dan masing-masing
--                    berdiri sendiri; kolom per tanggal berarti migrasi baru
--                    setiap kali ada satu teks lagi.
--
--   people        -- juri & mitra di section "Juri & Mitra". Satu tabel dengan
--                    kolom `kind`, bukan dua tabel, karena UI-nya memang satu
--                    daftar yang diurutkan bersama.
--
--   registrations -- isi form #pendaftaran. Tabel ini HANYA bertambah dari
--                    formulir publik, tidak pernah diedit admin.
--
-- Catatan utf8mb4: nama sekolah di Indonesia memakai karakter di luar ASCII,
-- dan utf8 (3 byte) tidak cukup untuk sebagian emoji/karakter astral.
-- utf8mb4_unicode_ci juga membuat pencarian `WHERE email = ...` tidak
-- membedakan huruf besar/kecil, yang justru diinginkan untuk email.

CREATE DATABASE IF NOT EXISTS `helixa_olympiad`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `helixa_olympiad`;

-- ---------------------------------------------------------------------------
-- settings: teks yang bisa diubah admin
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `settings` (
  `key`        VARCHAR(64)  NOT NULL,
  `value`      TEXT         NOT NULL,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- people: juri & mitra
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `people` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `kind`       ENUM('juri', 'mitra') NOT NULL,
  `name`       VARCHAR(160) NOT NULL,
  `role`       VARCHAR(200) NOT NULL DEFAULT '',
  `monogram`   VARCHAR(4)   NOT NULL DEFAULT '',
  `sort_order` INT          NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_kind_order` (`kind`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- registrations: isi form #pendaftaran
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `registrations` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nama`       VARCHAR(160)  NOT NULL,
  `sekolah`    VARCHAR(200)  NOT NULL,
  `kota`       VARCHAR(100)  NOT NULL,
  `kelas`      VARCHAR(8)    NOT NULL,
  `jurusan`    VARCHAR(8)    NOT NULL,
  `wa`         VARCHAR(32)   NOT NULL,
  `email`      VARCHAR(200)  NOT NULL,
  `bidang`     VARCHAR(24)   NOT NULL,
  `setuju`     TINYINT(1)    NOT NULL DEFAULT 0,
  `ip`         VARCHAR(64)   NULL,
  `user_agent` VARCHAR(300)  NULL,
  `created_at` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- Satu email hanya boleh mendaftar sekali per bidang. Tanpa ini, refresh
  -- halaman setelah submit akan menyimpan baris kedua untuk orang yang sama,
  -- dan panitia baru tahu setelah menghitung peserta.
  UNIQUE KEY `uniq_email_bidang` (`email`, `bidang`),
  KEY `idx_created` (`created_at`),
  KEY `idx_bidang` (`bidang`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
