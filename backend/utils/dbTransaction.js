const pool = require('../config/db');

// Error dengan status HTTP agar controller dapat memetakan ke response yang tepat.
function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
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

module.exports = { createServiceError, withTransaction };
