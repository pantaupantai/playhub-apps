# Playhub POS Billing Application

Aplikasi kasir dan billing playhub terintegrasi (Frontend SPA + Express Backend API).

---

## 🚀 Panduan Deployment Docker di VPS (aaPanel)

### 1. Izin Akses Database MySQL di aaPanel (Penting!)
Secara default di aaPanel, user MySQL memiliki izin **Localhost** (`127.0.0.1`). Karena container Docker berjalan di jaringan bridge, koneksi ke host dikenali sebagai IP gateway Docker (`172.17.0.1`).
1. Buka menu **Database** di aaPanel.
2. Di baris database `bsb_playhub` (user `bsb_playhub`), klik **Permission** / **Permission Setting**.
3. Ubah **Access Permission** dari `Localhost` menjadi **Everyone** (`%`) atau **Specified IP** (`172.%`).
4. Klik **Submit** / **Save**.
5. Salin password user `bsb_playhub` (klik ikon copy password).

---

### 2. Konfigurasi Environment (`.env`)
Di folder proyek di VPS:
```bash
cp .env.example .env
nano .env
```
Sesuaikan nilainya:
```env
PORT=8000
DB_HOST=host.docker.internal
DB_PORT=3306
DB_DATABASE=bsb_playhub
DB_USERNAME=bsb_playhub
DB_PASSWORD=paste_password_dari_aapanel_disini
JWT_SECRET=rahasia_jwt_playhub_2026_super_secure_key
JWT_TTL=480
```

---

### 3. Build dan Jalankan Container Docker
Jalankan perintah berikut di direktori proyek:
```bash
docker compose up -d --build
```
Cek status container:
```bash
docker compose ps
docker compose logs -f app
```

---

### 4. Inisialisasi Database / Seed Data
Saat container pertama kali jalan, tabel-tabel database akan otomatis dibuat (`schema.js`).

Untuk mengisi data awal (role, permission, user awal: superadmin/admin/kasir):
```bash
docker compose exec app npm run seed
```

Atau jika ingin mengimpor data backup SQL yang ada di `backend/storage/app/private/backups/`:
```bash
docker compose exec app npm run import-backup
```

---

### 5. Setup Reverse Proxy di aaPanel
Agar domain `playhub.pantaibsb.com` mengarah ke container Docker:
1. Buka menu **Website** di aaPanel.
2. Klik nama domain **playhub.pantaibsb.com**.
3. Pilih menu tab **Reverse Proxy** di sebelah kiri.
4. Klik **Add reverse proxy**:
   - **Proxy Name**: `playhub_proxy`
   - **Target URL**: `http://127.0.0.1:8000`
   - **Send Host**: `$host`
5. Klik **Submit**.
6. (Opsional) Buka tab **SSL** di website settings aaPanel untuk mengaktifkan Let's Encrypt SSL.
