# WA Bulk Sender

Aplikasi desktop (Electron) untuk mengirim pesan WhatsApp massal dari nomor pribadi,
dengan import kontak dari **CSV / Excel**, personalisasi pesan, lampiran media, dan
**jeda anti-ban** otomatis.

## Cara pakai

1. **Install dependensi** (sekali saja):
   ```
   npm install
   ```

2. **Jalankan aplikasi**:
   ```
   npm start
   ```

3. Di aplikasi:
   - Klik **Hubungkan** → scan QR dengan WhatsApp di HP (Setelan → Perangkat tertaut).
     Sesi tersimpan, lain kali tidak perlu scan lagi.
   - Klik **Import CSV / Excel** → pilih file kontak. Pilih kolom nomor HP.
   - Tulis pesan. Pakai `{nama}` atau nama kolom lain untuk personalisasi, mis:
     `Halo {nama} dari {kota}, ...`
   - (Opsional) lampirkan gambar/dokumen.
   - Atur **jeda anti-ban** (default acak 5–15 detik).
   - Klik **🚀 Kirim ke Semua**.

## Format file kontak

File CSV/Excel harus punya baris header. Contoh (`contoh-kontak.csv`):

```
nama,nomor,kota
Budi,081234567890,Jakarta
Siti,6285678901234,Bandung
```

- Nomor boleh format `08xxxx`, `62xxxx`, atau `+62 8xx-xxxx`. Otomatis dinormalisasi
  ke format WhatsApp (kode negara default `62`, bisa diubah di aplikasi).
- Setiap nama kolom bisa dipakai sebagai variabel `{namakolom}` di pesan.

## Build jadi installer (.exe)

```
npm run build
```
Hasil installer ada di folder `dist/`.

## ⚠️ Penting — risiko & etika

- Mengirim massal dari **nomor pribadi melanggar Ketentuan Layanan WhatsApp** dan
  **nomor bisa diblokir**, terutama jika dianggap spam. Risiko ini ditanggung pengguna.
- Untuk lebih aman: pakai jeda yang cukup, jangan kirim ke orang yang tidak mengenal
  kamu, hindari volume sangat besar dalam waktu singkat, dan dapatkan izin penerima.
- Untuk pemakaian bisnis skala besar yang legal, gunakan **WhatsApp Business API resmi**.

## Teknologi

- [Electron](https://www.electronjs.org/) — desktop UI
- [whatsapp-web.js](https://wwebjs.dev/) — otomasi WhatsApp Web
- [SheetJS/xlsx](https://sheetjs.com/) — baca CSV/Excel
- [qrcode](https://www.npmjs.com/package/qrcode) — render QR login
