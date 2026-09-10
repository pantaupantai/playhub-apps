# PLAYHUB POS APPS

Aplikasi kasir dan billing playhub terintegrasi (Frontend SPA + Express Backend API).

---

## 🚀 Panduan Deployment Docker di aaPanel (Linux VPS)

Dengan konfigurasi `network_mode: host`, container berjalan langsung di jaringan host VPS:
- ✅ **Koneksi instan ke MySQL `bsb_playhub` via `127.0.0.1:3306`** (menghindari error `connect ETIMEDOUT`).
- ✅ Tidak terpengaruh firewall Docker bridge / bind-address MySQL aaPanel.
- ✅ Port `8000` langsung tersedia di server untuk Reverse Proxy aaPanel.

---

### 1. Salin Password Database dari aaPanel
1. Buka menu **Database** di aaPanel.
2. Di baris database **`bsb_playhub`** (user `bsb_playhub`), klik ikon copy di kolom **Password**.

---

### 2. Siapkan File `.env` di Server
Di terminal server VPS:
```bash
git pull origin main
cp .env.example .env
nano .env
```
Isi file `.env`:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=bsb_playhub
DB_USERNAME=bsb_playhub
DB_PASSWORD=paste_password_dari_aapanel
JWT_SECRET=playhub-pos-jwt-secret-key-2026-super-secure
JWT_TTL=480
```

---

### 3. Build & Jalankan Docker
```bash
docker compose down
docker compose up -d --build
```
Cek log container:
```bash
docker compose logs -f app
```
*(Pastikan muncul tulisan `Database tables ensured successfully.` dan tidak ada lagi `connect ETIMEDOUT`)*.

---

### 4. Tes Koneksi Database Langsung via Browser
Buka URL:
👉 **`https://playhub.pantaibsb.com/api/db-check`**
Jika database tersambung, akan muncul status `"success"` dan daftar tabel serta sample user!

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
