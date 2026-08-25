# WhatsApp Number Scanner Extension

Dokumen scope untuk Chrome Extension lokal dengan flow dummy. Produk akhir akan memakai backend untuk QR WhatsApp dan proses scan. Versi awal tidak terhubung ke WhatsApp atau backend.

## Tujuan

Membuat Chrome Extension Manifest V3 untuk:

- Menampilkan flow koneksi WhatsApp melalui QR.
- Menerima banyak nomor lewat input manual atau file lokal.
- Menjalankan simulasi scan nomor.
- Menampilkan progres dan statistik nomor aktif atau tidak aktif.
- Menyimpan status koneksi secara lokal saat halaman ditutup atau dibuka ulang.

## Target Pengguna

Pengguna yang memproses nomor milik sendiri atau kontak dengan izin yang sah.

## Ruang Lingkup Versi Dummy

### Teknologi

- Chrome Extension Manifest V3.
- Vanilla HTML, CSS, dan JavaScript.
- Tanpa framework dan dependency pihak ketiga.
- `chrome.storage.local` untuk menyimpan status sesi dummy.
- Popup overlay saat pengguna klik ikon extension.
- Halaman penuh dapat ditambahkan kemudian sebagai opsi untuk batch besar.

### Flow Aplikasi

1. Pengguna klik ikon extension.
2. Extension membuka popup overlay browser.
3. Jika status sesi lokal belum terhubung, popup tampil halaman login QR dummy.
4. Pengguna klik `Simulasikan Terhubung`.
5. Extension menyimpan status `connected` pada `chrome.storage.local`.
6. Pengguna masuk ke halaman input scan.
7. Pengguna memilih sumber nomor: input manual atau upload file.
8. Pengguna memulai scan dummy.
9. Popup berpindah ke halaman hasil, lalu memproses nomor satu per satu dan menampilkan statistik.
10. Status koneksi tetap tersimpan sampai pengguna menekan reset sesi.

### Login QR Dummy

- QR hanya gambar atau pola statis untuk representasi UI.
- Tidak membuat sesi WhatsApp.
- Tidak memindai QR dari kamera.
- Tombol simulasi menggantikan proses sukses autentikasi.
- Tombol reset sesi menghapus status koneksi lokal dan kembali ke halaman QR.

### Sumber Nomor

#### Input Manual

- Textarea menerima satu nomor per baris.
- Nomor dipakai persis seperti input pengguna.
- Baris kosong diabaikan.
- Nomor duplikat tetap diproses sebagai baris terpisah pada versi dummy.

#### Upload File

- Terima file `.txt` dan `.csv`.
- File dibaca di browser memakai `FileReader`; file tidak diunggah ke mana pun pada versi dummy.
- Setiap baris diperlakukan sebagai satu nilai nomor.
- CSV belum memahami header, quoted field, atau banyak kolom. File CSV versi dummy harus berisi satu nomor per baris.
- Baris kosong diabaikan.

### Scan Dummy

- Tidak menghubungi WhatsApp, API, atau backend.
- Nomor diproses berurutan dengan jeda singkat untuk menampilkan progres.
- Hasil setiap nomor berupa `Aktif` atau `Tidak Aktif`.
- Status dummy harus deterministik berdasarkan isi nomor. Input sama menghasilkan status sama saat dipindai ulang.
- Bila input kosong, tombol scan tidak menjalankan proses dan UI menampilkan pesan validasi.

### Hasil dan Statistik

- Tampilkan progres: jumlah selesai dari total nomor dan persentase.
- Tampilkan tabel hasil selama scan berjalan.
- Kolom minimum: nomor, status, dan urutan.
- Tampilkan statistik minimum:
  - Total nomor.
  - Nomor aktif.
  - Nomor tidak aktif.
  - Nomor selesai diproses.
- Hasil hanya hidup di halaman saat ini. Refresh halaman menghapus hasil scan.

## Di Luar Scope

- Backend nyata.
- Login QR WhatsApp nyata.
- Automasi WhatsApp Web.
- Validasi apakah nomor benar memiliki akun WhatsApp.
- Normalisasi format nomor, kode negara, atau validasi format telepon.
- Parsing CSV kompleks, termasuk header dan multi-kolom.
- Ekspor hasil ke CSV, TXT, atau format lain.
- Penyimpanan riwayat scan.
- Akun pengguna, autentikasi server, atau role akses.
- Parallel scan, retry, pembatalan scan, dan rate limiting backend.
- Kirim pesan WhatsApp.

## Batasan dan Privasi

- Versi dummy memproses file dan nomor sepenuhnya lokal di extension.
- Pengguna bertanggung jawab memastikan nomor yang diproses memiliki izin yang sah.
- Integrasi produksi wajib memakai backend dan jalur resmi yang sesuai kebijakan WhatsApp serta aturan privasi yang berlaku.
- Extension tidak boleh menyimpan isi nomor atau hasil scan permanen tanpa persetujuan dan kebutuhan produk yang jelas.

## Struktur File Rencana

```text
manifest.json       Konfigurasi Chrome Extension Manifest V3 dan default popup
popup.html          Shell popup dengan halaman QR, input, dan hasil
popup.css           Tampilan popup
popup.js            State sesi, routing view, input file, simulasi scan, dan render UI
README.md           Dokumen scope ini
```

## Kontrak Backend Masa Depan

Versi produksi dapat mengganti bagian dummy dengan backend, tanpa mengubah flow UI utama.

### Sesi QR

Backend perlu menyediakan:

- Pembuatan sesi QR beserta `sessionId` dan data QR.
- Status sesi: `pending`, `connected`, `expired`, atau `error`.
- Cara pembaruan status: polling HTTP, Server-Sent Events, atau WebSocket.
- Aksi logout atau reset sesi.

Contoh respons pembuatan sesi:

```json
{
  "sessionId": "session_123",
  "qr": "data:image/png;base64,...",
  "status": "pending"
}
```

### Bulk Scan

Backend perlu menerima daftar nilai nomor apa adanya dan mengembalikan hasil per item.

Contoh request:

```json
{
  "sessionId": "session_123",
  "numbers": ["08123456789", "+628123456789"]
}
```

Contoh hasil per nomor:

```json
{
  "index": 0,
  "number": "08123456789",
  "status": "active"
}
```

Status minimum backend:

- `active`
- `inactive`
- `error`

Detail batas batch, autentikasi extension, rate limit, retry, dan metode pembaruan progres ditetapkan setelah backend tersedia.

## Kriteria Selesai Versi Dummy

- Extension dapat dimuat sebagai unpacked extension di Chrome.
- Klik ikon extension membuka halaman aplikasi.
- Status `connected` tersimpan setelah simulasi dan bertahan setelah halaman dibuka ulang.
- Reset sesi mengembalikan halaman login QR.
- Input manual dan upload `.txt` atau `.csv` menghasilkan daftar nomor dari baris tidak kosong.
- Scan dummy menampilkan hasil per nomor, progres, total, aktif, dan tidak aktif.
- Tidak ada request jaringan saat menjalankan seluruh flow dummy.
