const pool = require('../config/db');

// Kode error bisnis yang stabil untuk dikonsumsi klien API (SCRUM-52).
// Dinamai errorCode, bukan code, karena driver pg memakai error.code untuk
// SQLSTATE (mis. 23505/23514) sehingga nama `code` berisiko tertukar.
const ERROR_CODES = Object.freeze({
  INSUFFICIENT_PAYMENT: 'INSUFFICIENT_PAYMENT'
});

// Error dengan status HTTP agar controller dapat memetakan ke response yang tepat.
// errorCode bersifat opsional sehingga pemanggil lama tetap kompatibel.
function createServiceError(message, statusCode, errorCode = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

// Menjalankan callback dalam satu transaksi database.
// callback menerima `client` (pg Client) yang wajib dipakai untuk semua query.
async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[db] rollback gagal:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { ERROR_CODES, createServiceError, withTransaction };
