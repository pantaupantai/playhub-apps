# Playhub POS Billing Application

Aplikasi kasir dan billing playhub terintegrasi (Frontend SPA + Express Backend API).

---

## 🚀 Panduan Deployment Docker di aaPanel (Linux VPS)

Dengan konfigurasi `network_mode: host`, container Docker berjalan langsung di jaringan host server. Keuntungannya:
- ✅ **Langsung tersambung ke MySQL `bsb_playhub`** di `127.0.0.1:3306` tanpa perlu mengubah permission database aaPanel (tetap `Localhost`).
- ✅ Port `8000` langsung tersedia di server untuk dihubungkan ke domain aaPanel melalui Reverse Proxy.

---

### 1. Salin Password Database dari aaPanel
1. Buka menu **Database** di aaPanel.
2. Di baris database **`bsb_playhub`** (user `bsb_playhub`), klik ikon salin/copy pada kolom **Password**.

---

### 2. Siapkan File `.env` di Server
Di folder proyek di server (misalnya `/www/wwwroot/playhub.pantaibsb.com` atau direktori kerja Anda):
```bash
git pull origin main
cp .env.example .env
nano .env
```
Isi `DB_PASSWORD` dengan password yang baru saja disalin:
```env
PORT=8000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=bsb_playhub
DB_USERNAME=bsb_playhub
DB_PASSWORD=paste_password_disini
JWT_SECRET=rahasia_jwt_playhub_2026_super_secure_key
JWT_TTL=480
```

---

### 3. Jalankan Docker Compose
Jalankan perintah ini di terminal server:
```bash
docker compose up -d --build
```
Cek log:
```bash
docker compose logs -f app
```
*(Tabel-tabel database akan otomatis dibuat saat pertama kali aplikasi menyala)*.

---

### 4. Isi Data Awal / Seed (Opsional)
Untuk memasukkan role & user default (Super Admin, Admin, Kasir):
```bash
docker compose exec app npm run seed
```
Atau jika ingin mengimpor data backup SQL:
```bash
docker compose exec app npm run import-backup
```

---

### 5. Hubungkan Domain di aaPanel (Reverse Proxy)
1. Buka menu **Website** di aaPanel.
2. Klik nama domain **`playhub.pantaibsb.com`**.
3. Pilih tab **Reverse Proxy** di sisi kiri.
4. Klik **Add reverse proxy**:
   - **Proxy Name**: `playhub_proxy`
   - **Target URL**: `http://127.0.0.1:8000`
   - **Send Host**: `$host`
5. Klik **Submit**.
6. Aktifkan sertifikat SSL gratis di tab **SSL** -> **Let's Encrypt** -> **Apply**.
