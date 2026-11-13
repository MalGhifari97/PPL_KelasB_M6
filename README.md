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
