# POS / Kasir - Backend (M6 Sprint 1: US1 & US2)

Backend Express.js untuk modul POS/Kasir. Database: **PostgreSQL (Supabase)**.

## Stack

- Node.js + Express 4
- `pg` (node-postgres) — pool koneksi ke Supabase
- `dotenv`, `cors`
- Test runner bawaan Node (`node:test`), tanpa dependency tambahan

## Setup

```bash
npm install
cp .env.example .env     # lalu isi DB_HOST, DB_USER, DB_PASSWORD
npm run db:check         # verifikasi koneksi ke Supabase
npm start                # http://localhost:5000
```

Variabel `.env` yang dibutuhkan:

| Variabel | Keterangan |
|---|---|
| `DB_HOST` | `db.<ref>.supabase.co` (IPv6) atau `aws-0-<region>.pooler.supabase.com` (IPv4) |
| `DB_PORT` | `5432` (jangan pakai 6543 / transaction pooler) |
| `DB_USER` | `postgres` (direct) atau `postgres.<ref>` (session pooler) |
| `DB_PASSWORD` | password database |
| `DB_NAME` | `postgres` |
| `DB_SSL` | `true` untuk Supabase |
| `DB_POOL_MAX` | jumlah koneksi maksimum (default 10) |

Backend **tidak** memakai API key Supabase (publishable/secret). Koneksi memakai
password database, jadi key tersebut tidak perlu disimpan di repo.

### Koneksi yang dipakai proyek ini (penting)

Direct connection (`db.<ref>.supabase.co`) **hanya memiliki record AAAA/IPv6**.
Pada jaringan tanpa IPv6, koneksi gagal dengan:

```
getaddrinfo ENOTFOUND db.<ref>.supabase.co        # tidak ada A record
(ENOTFOUND) tenant/user postgres.<ref> not found  # host pooler region salah
```

Karena itu proyek ini memakai **Session Pooler (IPv4)** dengan region yang benar-benar
meng-host tenant-nya:

```ini
DB_HOST=aws-0-ap-south-1.pooler.supabase.com
DB_PORT=5432
DB_USER=postgres.mopswiuveqmlftbffjoe
DB_NAME=postgres
DB_SSL=true
```

Catatan:

1. Host pooler **tidak selalu sama dengan region yang terlihat**; `aws-0-ap-southeast-1`
   dan `aws-1-ap-southeast-1` membalas `tenant/user ... not found` untuk proyek ini.
   Ambil host pasti dari dashboard: **Connect → Session pooler**.
2. Jangan memakai port `6543` (transaction pooler) karena tidak mendukung prepared
   statement driver `pg`.
3. Session pooler tetap mendukung `FOR UPDATE` dan transaksi yang dipakai
   `withTransaction` pada alur pembayaran.
4. `npm install` di root wajib dijalankan. Tanpa itu `require('pg')` gagal dan
   `npm start` langsung berhenti dengan `Cannot find module 'pg'` — gejala di
   frontend berupa banner *"Tidak dapat terhubung ke server"*.

### Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `Error: Cannot find module 'pg'` saat `npm run dev` | `npm install` belum dijalankan di root, atau `node_modules` berisi sisa project lain | `npm install` (atau `npm ci` setelah hapus `node_modules`) |
| `Error: listen EACCES: permission denied 0.0.0.0:5000` | Port 5000 dipakai service lain lewat `http.sys` (mis. `HerdHelper` dari Laravel Herd). Cek dengan `netsh http show servicestate` dan `netsh interface ipv4 show excludedportrange protocol=tcp` | Ganti `PORT` di `.env` (mis. `5001`), lalu samakan `VITE_API_BASE_URL` di `frontend/.env` |
| `Error: listen EADDRINUSE ... :5001` | Server yang sama masih berjalan di terminal lain, atau ada proses lain yang listen di port itu | Tutup terminal yang menjalankan `npm run dev` lain, atau hentikan prosesnya lewat `netstat -ano \| findstr :5001`; pesan `[server] Port ... sudah dipakai` dari `index.js` menandakan kasus ini |
| Frontend menampilkan *"Tidak dapat terhubung ke server"* | Backend mati, atau `VITE_API_BASE_URL` tidak cocok dengan `PORT` backend | Jalankan backend lebih dulu dan pastikan kedua nilai port sama |

`EACCES` berbeda dari `EADDRINUSE`: `EACCES` muncul saat port berada di *exclusion
range* Windows (sering karena Hyper-V/WSL atau service seperti Laravel Herd),
sehingga proses apa pun tidak boleh bind ke port tersebut meskipun `netstat`
tampak kosong.

## Struktur

```
index.js                         # bootstrap Express (export app untuk pengujian)
backend/config/db.js             # Pool pg + parser NUMERIC/BIGINT/DATE
backend/utils/dbTransaction.js   # withTransaction + createServiceError
backend/models/                  # Product, CartItem (toJSON -> angka numerik)
backend/services/                # productService, cartService, paymentService
backend/controllers/             # validasi input + mapping error ke HTTP
backend/routes/                  # productRoutes, transactionRoutes
backend/tests/                   # unit test (node:test)
database/schema.sql              # dokumentasi skema PostgreSQL
scripts/db-check.js              # cek koneksi database
scripts/e2e-check.js             # uji AC end-to-end ke Supabase
```

## Endpoint

### M6-US1 — Cari produk & kelola keranjang

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/products?search=` | Cari produk aktif berdasarkan nama/kode (`ILIKE`) |
| POST | `/api/transactions` | Buat draft transaksi (`unpaid`) |
| GET | `/api/transactions/:transactionId` | Ambil isi keranjang |
| POST | `/api/transactions/:transactionId/items` | Tambah produk (kuantitas awal 1) |
| PATCH | `/api/transactions/:transactionId/items/:itemId` | Ubah kuantitas |
| DELETE | `/api/transactions/:transactionId/items/:itemId` | Hapus item |

Body `POST /api/transactions`:

```json
{ "cashier_name": "Budi", "payment_timing": "upfront", "order_type": "retail", "table_number": null }
```

`order_type`: `retail` | `dine_in` | `take_away`. `table_number` wajib bila `dine_in`.

Response item selalu memuat `name`, `unit_price`, `quantity`, dan `subtotal` (dari
generated column `transaction_items.subtotal`) sebagai **angka**, bukan string.

### M6-US2 — Pembayaran tunai & kembalian

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/transactions/pay/cash` | Catat pembayaran tunai, hitung kembalian, set `paid` |

Service yang dipanggil: `payCash(transactionId, nominal)` pada
`backend/services/paymentService.js` (Task 19 / SCRUM-51). Alias lama
`processCashPayment({ transaction_id, cash_received })` tetap tersedia namun
berstatus deprecated.

```json
{ "transaction_id": 12, "cash_received": 100000 }
```

Response:

```json
{
  "success": true,
  "message": "Pembayaran tunai berhasil",
  "data": {
    "transaction": { "payment_status": "paid", "total": 85000, "paid_at": "..." },
    "payment": {
      "method": "cash",
      "amount_received": 100000,
      "change_amount": 15000,
      "reference_number": "PAY-...",
      "confirmed_at": "..."
    },
    "items": []
  }
}
```

### Format error

Semua response gagal memakai envelope yang sama. Field `code` diisi kode error bisnis
yang stabil, atau `null` bila tidak ada kode khusus (SCRUM-52):

```json
{
  "success": false,
  "code": "INSUFFICIENT_PAYMENT",
  "message": "Uang tunai kurang dari total tagihan (total Rp85000, diterima Rp84000)",
  "data": null
}
```

| `code` | HTTP | Kondisi |
|---|---|---|
| `INSUFFICIENT_PAYMENT` | 400 | `cash_received` kurang dari total tagihan. Tidak ada baris `payments` yang dibuat dan transaksi tetap `unpaid`. |
| `null` | 4xx / 5xx | Error lain: input tidak valid, produk/transaksi tidak ditemukan, konflik status, atau kesalahan server. |

Kode ini dipakai frontend untuk membedakan kekurangan bayar dari kesalahan validasi lain
tanpa perlu mencocokkan teks pesan.

### Kode status

| Kode | Kondisi |
|---|---|
| 200 | Berhasil |
| 201 | Draft transaksi dibuat |
| 400 | Input tidak valid / stok kurang / uang kurang dari total |
| 404 | Produk atau transaksi tidak ditemukan |
| 409 | Transaksi sudah lunas, dibatalkan, atau keranjang sudah dibayar |

## Pemetaan Acceptance Criteria

| AC | Implementasi |
|---|---|
| US1 AC-01 | `POST /:id/items` menyimpan kuantitas 1 dan mengembalikan nama, harga satuan, kuantitas, subtotal |
| US1 AC-02 | `PATCH`/`DELETE` memanggil `recalculateTotals` (subtotal & total dihitung ulang) |
| US1 AC-03 | `GET /api/products` mengembalikan 404 `"Produk tidak ditemukan"` |
| US2 AC-01 | Total 85.000 dibayar 100.000 → `change_amount` 15.000, status `paid` |
| US2 AC-02 | Total 85.000 dibayar 85.000 → `change_amount` 0, status `paid` |

## Pengujian

```bash
npm test           # unit test (tanpa database)
npm run test:e2e   # end-to-end ke Supabase (menulis data uji)
E2E_CLEANUP=true npm run test:e2e   # hapus data uji setelah selesai
```

`npm run test:e2e` memakai produk seed `KLT001` (68.000) dan `KLT003` (17.000)
sehingga totalnya tepat 85.000 sesuai skenario AC.

## Catatan teknis

1. `pg` mengembalikan `NUMERIC` dan `BIGINT` sebagai string, sehingga `config/db.js`
   memasang type parser agar `price`, `total`, `subtotal`, dan `id` menjadi angka.
2. `DATE` dipertahankan sebagai string `YYYY-MM-DD` agar `expired_date` tidak bergeser
   satu hari akibat konversi zona waktu.
3. Pencarian memakai `ILIKE` karena `LIKE` PostgreSQL bersifat case-sensitive.
4. `transaction_items.subtotal` adalah generated column, jadi tidak pernah di-INSERT.
5. Pembayaran mengunci baris transaksi (`FOR UPDATE`) untuk mencegah pembayaran ganda.

## Frontend (React + Vite)

Frontend ada di `frontend/` dan memanggil API backend di atas.

```bash
cd frontend
npm install
cp .env.example .env     # opsional, default http://localhost:5000
npm run dev              # http://localhost:5173
```

| Variabel | Keterangan |
|---|---|
| `VITE_API_BASE_URL` | Base URL backend, default `http://localhost:5000` |

Backend sudah memasang `cors()`, jadi frontend di port 5173 boleh memanggil API
tanpa proxy tambahan.

### Alur integrasi

1. `GET /api/products` — katalog produk (tab kategori mengikuti data produk).
2. `POST /api/transactions` — draft `unpaid` dibuat otomatis saat produk pertama
   ditambahkan; id-nya disimpan di state `cartState`.
3. `POST|PATCH|DELETE /api/transactions/:id/items...` — setiap perubahan keranjang
   langsung disinkronkan; response berisi keranjang terbaru sehingga `total`
   selalu berasal dari server.
4. `POST /api/transactions/pay/cash` — dipanggil `CashPaymentForm` saat
   "Konfirmasi Pembayaran". Body `{ transaction_id, cash_received }`.
5. `PaymentSuccessModal` menampilkan `data.transaction`, `data.payment`, dan
   `data.items` dari response pembayaran (nomor transaksi, waktu, kasir,
   kembalian, `reference_number`), bukan lagi data hardcoded.
6. "Transaksi Baru" mereset state; draft berikutnya dibuat saat produk ditambah.

Kode yang dipakai: `frontend/src/services/api.js` (client + normalisasi item),
`frontend/src/components/CashPaymentForm.jsx`,
`frontend/src/components/PaymentSuccessModal.jsx`, dan penghubungnya di
`frontend/src/App.jsx`.

