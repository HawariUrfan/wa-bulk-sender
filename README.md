# WA Bulk Sender

Aplikasi desktop (Electron) untuk mengirim pesan WhatsApp massal dari nomor pribadi —
dengan import kontak dari **CSV / Excel**, personalisasi pesan, lampiran media,
**jeda anti-ban** otomatis, dan fitur **tambah kontak ke grup**.

---

## 🚀 Cara Install (Simpel — untuk pengguna biasa)

1. **Download** installer dari halaman
   [Releases](https://github.com/HawariUrfan/wa-bulk-sender/releases) → file
   **`WA Bulk Sender Setup 1.0.0.exe`**.
2. **Klik dua kali** file tersebut, lalu ikuti wizard instalasi.
3. Buka aplikasi dari **Start Menu** atau **shortcut desktop**. Selesai — tanpa CLI.

> Aplikasi tetap butuh **Google Chrome atau Microsoft Edge** terpasang di PC
> (dipakai untuk koneksi WhatsApp Web).

---

## ⚠️ Kalau Muncul Peringatan Keamanan

Installer ini **belum punya sertifikat code-signing** (berbayar, ratusan ribu–jutaan/tahun),
jadi Windows wajar menampilkan peringatan. **Ini bukan virus** — sumber kodenya terbuka di
repo ini. **Jangan menonaktifkan antivirus.** Cukup lakukan salah satu di bawah:

**a. SmartScreen ("Windows protected your PC"):**
Klik **More info** → **Run anyway**.

**b. Windows Defender menghapus/mengkarantina file:**
Jangan matikan Defender, cukup beri pengecualian untuk file ini saja:
1. Buka **Windows Security** → **Virus & threat protection**.
2. **Manage settings** → scroll ke **Exclusions** → **Add or remove exclusions**.
3. **Add an exclusion** → **Folder** → pilih folder tempat installer/aplikasi berada.

---

## 📖 Cara Pakai

1. Klik **Hubungkan** → scan QR dengan WhatsApp di HP
   (Setelan → Perangkat tertaut). Sesi tersimpan, lain kali tidak perlu scan lagi.
2. Klik **Import CSV / Excel** → pilih file kontak, lalu pilih kolom nomor HP.
3. Tulis pesan. Pakai `{nama}` atau nama kolom lain untuk personalisasi, mis:
   `Halo {nama} dari {kota}, ...`
4. (Opsional) lampirkan gambar/dokumen.
5. Atur **jeda anti-ban** (default acak 5–15 detik).
6. Klik **🚀 Kirim ke Semua**.

**Tambah kontak ke grup (opsional):** di bagian 5, klik **Muat daftar grup** → pilih grup
(kamu harus admin) → **Tambah ke Grup**. Nomor yang privasinya tertutup akan dikirimi undangan.

---

## 📄 Format File Kontak

File CSV/Excel harus punya baris header. Contoh (`contoh-kontak.csv`):

```
nama,nomor,kota
Budi,081234567890,Jakarta
Siti,6285678901234,Bandung
```

- Nomor boleh format `08xxxx`, `62xxxx`, atau `+62 8xx-xxxx` — otomatis dinormalisasi
  ke format WhatsApp (kode negara default `62`, bisa diubah di aplikasi).
- Setiap nama kolom bisa dipakai sebagai variabel `{namakolom}` di pesan.

---

## 🛠️ Untuk Developer (jalankan dari kode)

```bash
npm install      # install dependensi (sekali saja)
npm start        # jalankan aplikasi
npm run build    # build installer .exe (hasil di folder dist/)
```

---

## ⚠️ Penting — Risiko & Etika

- Mengirim massal dari **nomor pribadi melanggar Ketentuan Layanan WhatsApp** dan
  **nomor bisa diblokir**, terutama jika dianggap spam. Risiko ditanggung pengguna.
- Untuk lebih aman: pakai jeda yang cukup, jangan kirim ke orang yang tidak mengenalmu,
  hindari volume sangat besar dalam waktu singkat, dan dapatkan izin penerima.
- Menambah orang ke grup secara massal **lebih sensitif** dan berisiko blokir lebih tinggi.
- Untuk pemakaian bisnis skala besar yang legal, gunakan **WhatsApp Business API resmi**.
- Belum ditandatangani digital — installer ini tidak punya sertifikat code-signing (yang harganya ratusan ribu–jutaan/tahun). Tanpa itu, Windows SmartScreen & sebagian antivirus otomatis curiga ke file .exe baru yang belum dikenal.

---

## 🧩 Teknologi

- [Electron](https://www.electronjs.org/) — desktop UI
- [whatsapp-web.js](https://wwebjs.dev/) — otomasi WhatsApp Web
- [SheetJS/xlsx](https://sheetjs.com/) — baca CSV/Excel
- [qrcode](https://www.npmjs.com/package/qrcode) — render QR login
