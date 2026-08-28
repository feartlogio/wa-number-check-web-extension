# Webscanner Extension

Chrome Extension Manifest V3 untuk pairing WhatsApp via QR dan bulk number check melalui Webscanner API.

## Fitur

- Pairing WhatsApp memakai QR dari backend.
- Refresh QR otomatis sebelum `qr_expires_at`.
- Poll status pairing setiap 3 detik sampai backend mengembalikan `session_token`.
- Simpan session token di `chrome.storage.local`; tab ditutup tidak logout.
- Disconnect memakai endpoint backend, lalu membuat pairing QR baru.
- Check nomor lewat input manual atau file `.txt`/`.csv`.
- Bulk check memakai loading state, hasil per nomor, statistik, error state, dan re-scan.
- Validasi nomor: country code tanpa `+`, digit saja, 8-15 digit.

## Jalankan

### Chrome

1. Buka `chrome://extensions`.
2. Aktifkan Developer mode.
3. Pilih **Load unpacked**.
4. Pilih root repository ini.
5. Klik icon Webscanner di toolbar. Extension membuka popup.

### Firefox

1. Jalankan `./package-firefox.sh` dari root repository.
2. Buka `about:debugging#/runtime/this-firefox`.
3. Klik **Load Temporary Add-on**.
4. Pilih `dist/firefox/manifest.json`.
5. Klik icon Webscanner di toolbar. Extension membuka halaman Webscanner pada tab baru agar file picker tetap terbuka.

Firefox temporary add-on menggunakan `background.scripts` untuk membuka tab. Chrome memakai `default_popup` tanpa background worker. Kedua browser perlu manifest terpisah.

Setelah perubahan source, klik reload pada kartu extension di `chrome://extensions`.

## Flow Pairing

1. Popup tanpa session membuat pairing baru dengan vendor code `EXT`.
2. Backend mengembalikan `pairing_id`, `pairing_token`, QR, `qr_expires_at`, dan `expires_at`.
3. Extension menampilkan QR dan countdown expiry.
4. Extension refresh QR tiga detik sebelum expiry.
5. Extension meminta status pairing setiap tiga detik.
6. Saat status `paired`, extension menyimpan `session_token` dan membuka halaman number check.
7. Saat **Disconnect session**, extension memanggil backend logout, menghapus token lokal setelah sukses, lalu membuat QR baru.

## Number Check

### Format Nomor

Satu nomor per baris. Pakai country code tanpa tanda `+`.

```text
6281234567890
60123456789
14155552671
```

Ditolak sebelum request:

- Tanda `+`, spasi, huruf, atau karakter lain selain digit.
- Digit pertama `0`.
- Panjang kurang dari 8 atau lebih dari 15 digit.

Backend tetap menentukan validitas nomor negara dan status WhatsApp akhir.

### Input Manual

Extension mengirim `multipart/form-data` dengan field `numbers` ke bulk endpoint.

### Upload File

- Format: `.txt` atau `.csv`.
- Maksimal: 2 MB.
- Satu nomor per baris. Header pertama `phone` boleh dipakai.
- File diupload hanya saat scan dimulai.

## API

Base URL staging:

```text
https://webscanner.djgroup-dev.com/api/v1/scan
```

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| `POST` | `/pairings` | Tidak ada | Buat QR pairing dengan body `{"vendor_code":"EXT"}`. |
| `POST` | `/pairings/{pairingId}/qr` | `X-Pairing-Token` | Refresh QR. |
| `GET` | `/pairings/{pairingId}` | `X-Pairing-Token` | Poll state pairing dan ambil `session_token` saat paired. |
| `GET` | `/session` | Bearer session token | Verifikasi session saat halaman dibuka. |
| `DELETE` | `/session` | Bearer session token | Disconnect session backend. |
| `POST` | `/check/bulk` | Bearer session token | Check daftar nomor atau file. |

Bulk response dirender dari `data.results`:

- `has_whatsapp: true`: `On WhatsApp`.
- `has_whatsapp: false`: `Not on WhatsApp`.
- `error: "invalid_number"`: `Invalid`.
- Error lain: `Failed`.

## Storage Dan Privasi

- `sessionToken` disimpan di `chrome.storage.local` agar session bertahan setelah tab ditutup atau extension reload.
- Pairing state sementara menyimpan ID, pairing token, dan expiry. QR base64 tidak disimpan persistent.
- Nomor dan hasil scan hanya hidup di memory halaman. Tidak disimpan persistent oleh extension.
- Session token dihapus hanya setelah disconnect backend sukses atau backend menolak token dengan `401`/`403`.
- Gunakan hanya nomor milik sendiri atau kontak dengan izin yang sah.

## Security Hardening

- Host permission dibatasi ke `https://webscanner.djgroup-dev.com/*`.
- Tidak ada remote font atau dependency pihak ketiga.
- QR hanya menerima `data:image/png;base64,`.
- Semua hasil backend dirender memakai DOM API dan `textContent`.
- Request pairing/session/QR timeout setelah 15 detik.
- Request bulk check timeout setelah 120 detik.
- Timeout dan error `5xx` tidak menghapus session token. Token dihapus hanya saat `401` atau `403`.

## Batasan

- Batas jumlah nomor bulk belum diketahui dari backend. Extension belum menerapkan client cap.
- CSV hanya satu nomor per baris. Header pertama `phone` didukung; quoted field dan multi-kolom tidak diparse.
- Tidak ada ekspor hasil, riwayat scan, atau pembatalan bulk check.
- Progress bulk bersifat indeterminate sampai backend mengembalikan respons final.

## Struktur

```text
manifest.json       Chrome Extension config, action, dan API host permission
background.js        Membuka halaman Webscanner saat Firefox action diklik
popup/popup.html    Struktur halaman Webscanner
popup/popup.css     Tampilan halaman Webscanner
popup/api.js         Request API, timeout, dan validasi QR
popup/pairing.js     Pairing QR, refresh, countdown, dan polling
popup/popup.js       DOM binding, session, bulk check, dan state UI
icons/              Icon extension
document-api.json   OpenAPI backend
```
