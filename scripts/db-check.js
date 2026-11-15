const pool = require('../backend/config/db');

async function main() {
  const { rows: versionRows } = await pool.query('SELECT version() AS version, current_database() AS database, current_user AS "user"');
  const { rows: productRows } = await pool.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS aktif FROM products');
  const { rows: tableRows } = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name`
  );

  console.log('Terhubung ke PostgreSQL:', versionRows[0].version.split(',')[0]);
  console.log('Database:', versionRows[0].database, '| User:', versionRows[0].user);
  console.log('Tabel/view:', tableRows.map((row) => row.table_name).join(', '));
  console.log(`Produk: ${productRows[0].total} total, ${productRows[0].aktif} aktif`);
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error('Gagal terhubung ke database:', error.message);
    await pool.end().catch(() => {});
    process.exitCode = 1;
  });
