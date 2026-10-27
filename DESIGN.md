# DESIGN.md: Pitulung Visual & Structural Direction

## Identity & Purpose
- **Product:** Pitulung
- **Category:** Utilitas dokumen, ekstraksi tabel terverifikasi, dan alat PDF lokal berbahasa Indonesia.
- **Audience:** Pekerja administrasi, pelaku UMKM, mahasiswa, dan tim operasional yang perlu mengekstrak tabel RAB/kontrak, merapikan pesanan WhatsApp, serta menggabung atau memisah berkas PDF tanpa birokrasi akun.
- **Design Read:** `Document & PDF utility workspace for Indonesian users (pitulung.my.id), preserving the signature warm maroon + cream rounded-rectangle aesthetic, Fredoka + Plus Jakarta Sans typography, and smooth interactive animations while removing redundant pill badges above headings, nested rounded-rectangle notes inside dropdowns, and double horizontal divider lines, dial ENERGY 3 / RHYTHM 2 / MOTION 2.`
- **Dial:** `ENERGY 3 / RHYTHM 2 / MOTION 2`

## Color System (R-29: 2 Core Neutrals + 1 Core Ink + 1 Deliberate Accent)
- **Base Surfaces:**
  - `--bg-white: #ffffff` (Permukaan kertas kerja utama)
  - `--bg-subtle: #faf7f8` (Permukaan sekunder untuk pengelompokan panel tanpa garis putus-putus)
  - `--bg-tint: #f6eef0` (Sorotan status aktif dan fokus ringan)
- **Typography Ink (WCAG AA Verified via `contrast-check.py`):**
  - `--text-main: #181214` (18.49:1 di atas `#ffffff`)
  - `--text-secondary: #4a3f42` (10.09:1 di atas `#ffffff`)
  - `--text-muted: #685a5e` (6.54:1 di atas `#ffffff`, 6.14:1 di atas `#faf7f8`)
- **Component Boundaries (WCAG 1.4.11 >= 3:1 Non-Text Contrast):**
  - `--border-light: #e4dcde` (Garis pemisah struktural antarseksi)
  - `--border-control: #857378` (4.45:1 di atas `#ffffff` untuk batas input, tombol, dan kartu interaktif)
- **Deliberate Accent (`--maroon-800: #631729`, 12.46:1 di atas `#ffffff`):**
  - Digunakan khusus pada aksi utama (tombol submit, indikator tab aktif, dan fokus keyboard), bukan disebar ke lencana kapsul atau dekorasi latar.

## Typography (R-06)
- **Display Typeface:** `Fredoka` (Heading H1/H2/H3)
- **Body & UI Typeface:** `Plus Jakarta Sans`
- **Reason:** Kombinasi `Fredoka` pada judul ramah khas `pitulung.my.id` dengan `Plus Jakarta Sans` pada kontrol dan tabel data memisahkan hierarki bacaan secara jelas serta menjaga keterbacaan angka rupiah, rincian RAB, dan istilah Bahasa Indonesia.
- **Hierarchy:** Judul utama mempertahankan aksen panah khas `Mau dibantu [->] apa hari ini?`, namun lencana kapsul deskriptif tambahan di atas H1/H2 dihapus agar tidak menumpuk.

## Border Radius & Surface Architecture (R-11, R-12)
- **Radius Hierarchy (No Pill-Everything):**
  - Kontainer ruang kerja utama & modal: `12px`
  - Kartu sekunder & panel hasil: `10px`
  - Input teks, pemicu dropdown, dan tombol aksi: `8px`
  - Tab segmen, kotak centang, dan penanda kecil: `6px`
- **Elevation:** Bayangan hanya diterapkan pada lapisan melayang nyata (menu dropdown terbuka dan dialog modal) untuk membedakan lapisan aktif dari bidang dasar kertas kerja.

## One-Line Decisions (R-31)
- **Why this color:** Warna merah marun tua (`#631729`) di atas kertas hangat (`#ffffff` / `#faf7f8`) memberi kontras bacaan tinggi (12.46:1) yang tegas seperti dokumen cetak resmi tanpa kesan dingin.
- **Why this layout:** Ruang kerja input ditempatkan langsung di paruh atas layar sebagai satu-satunya titik fokus utama, diikuti seksi dua kolom asimetris di bawahnya untuk utilitas PDF dan contoh pemakaian nyata.
- **Why this typography:** `Plus Jakarta Sans` dipilih karena karakter angka dan hurufnya jelas saat menampilkan tabel RAB, rincian halaman PDF, dan nomor telepon pelanggan.
- **Why this spacing:** Skala ruang kosong memisahkan area kerja utama, seksi referensi, dan footer satu garis tanpa membutuhkan garis putus-putus ganda yang memotong kartu.
- **Why use cards:** Kartu hanya dipakai untuk membingkai ruang kerja interaktif dan pemilih mode yang memiliki batas fungsi jelas, sedangkan daftar contoh dan tautan disajikan sebagai baris terstruktur.
- **Why use these icons:** Ikon garis sederhana hanya dipakai sebagai penanda fungsi nyata (unggah berkas, unduh, salin, hapus, ganti urutan halaman), tanpa ikon kilau AI (`sparkle`) atau panah dekoratif di setiap tombol.
