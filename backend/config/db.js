const { Pool, types } = require('pg');
require('dotenv').config();

// --- Normalisasi tipe data PostgreSQL agar aman dikonsumsi frontend ---
// NUMERIC(12,2): driver pg mengembalikan string ("68000.00"). Tanpa parser ini,
// total/subtotal menjadi string dan penjumlahan di frontend akan salah.
types.setTypeParser(types.builtins.NUMERIC, (value) => (value === null ? null : Number(value)));

// BIGINT: driver pg mengembalikan string ("1"). Tanpa parser ini, id produk dan
// id item menjadi string sehingga perbandingan id di frontend gagal.
types.setTypeParser(types.builtins.INT8, (value) => (value === null ? null : Number(value)));

// DATE: driver pg mengubahnya menjadi objek Date tengah malam waktu lokal yang
// dapat bergeser satu hari. Dipertahankan sebagai string 'YYYY-MM-DD'.
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'postgres',
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  statement_timeout: 15000,
  // Supabase mewajibkan koneksi TLS.
  ssl: String(process.env.DB_SSL).toLowerCase() === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', (error) => {
  console.error('[db] koneksi idle bermasalah:', error.message);
});

module.exports = pool;