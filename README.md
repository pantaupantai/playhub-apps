# PLAYHUB POS APPS

Aplikasi kasir dan billing playhub terintegrasi (Frontend SPA + Express Backend API).

---

## 🚀 Panduan Deployment Docker di aaPanel

Setup ini disamakan dengan aplikasi **HR** (`hr.pantaibsb.com`), yaitu berjalan di Docker dengan port mapping `8000 --> 8000/tcp` dan muncul di daftar **Docker -> Container** di aaPanel.

### 1. Ubah Permission User MySQL di aaPanel (Wajib)
Secara default di aaPanel, user MySQL memiliki izin **Localhost**. Karena container Docker berkomunikasi melalui bridge network (`172.x.x.x`), user `bsb_playhub` perlu diizinkan:
1. Buka menu **Database** di aaPanel.
2. Di baris database **`bsb_playhub`** (user `bsb_playhub`), klik **Permission**.
3. Ubah **Access Permission** dari `Localhost` ke **Everyone (`%`)**.
4. Klik **Submit**.
5. Salin password database (klik ikon copy di kolom Password).

---

### 2. Siapkan File `.env` di Server
Di folder proyek di VPS:
```bash
git pull origin main
cp .env.example .env
nano .env
```
Isi `DB_PASSWORD` dengan password yang baru saja Anda salin:
```env
DB_HOST=host.docker.internal
DB_PORT=3306
DB_DATABASE=bsb_playhub
DB_USERNAME=bsb_playhub
DB_PASSWORD=paste_password_dari_aapanel_disini
JWT_SECRET=playhub-pos-jwt-secret-key-2026-super-secure
JWT_TTL=480
```

---

### 3. Jalankan Docker Compose
Jalankan perintah ini di direktori proyek:
```bash
docker compose up -d --build
```
Setelah berjalan:
- Container akan muncul di menu **Docker -> Container** di aaPanel dengan port hijau `8000 --> 8000/tcp` (mirip seperti `hrpantaibsbcom-app-1`).
- Database schema akan dibuat secara otomatis saat container pertama kali menyala.

Cek log container:
```bash
docker compose logs -f app
```

---

### 4. Isi Akun Awal / Seed (Opsional)
Untuk memasukkan user default (Super Admin, Admin, Kasir):
```bash
docker compose exec app npm run seed
```
Atau jika ingin mengimpor data backup SQL:
```bash
docker compose exec app npm run import-backup
```

---

### 5. Hubungkan ke Domain di aaPanel (Reverse Proxy)
1. Buka menu **Website** di aaPanel.
2. Klik nama domain **`playhub.pantaibsb.com`**.
3. Pilih tab **Reverse Proxy** di sisi kiri.
4. Klik **Add reverse proxy**:
   - **Proxy Name**: `playhub_proxy`
   - **Target URL**: `http://127.0.0.1:8000`
   - **Send Host**: `$host`
5. Klik **Submit**.
6. Pasang SSL di tab **SSL** -> **Let's Encrypt** -> **Apply**.
