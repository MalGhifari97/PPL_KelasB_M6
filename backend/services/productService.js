const pool = require('../config/db');
const Product = require('../models/Product');

// Kolom produk yang dipakai modul POS (products.unit sudah tidak ada di skema baru).
const PRODUCT_COLUMNS = `id, code, name, category, product_type, is_cafe_menu,
  price, stock, expired_date, is_active, created_at`;

async function searchProducts(keyword) {
  // ILIKE dipakai karena LIKE di PostgreSQL bersifat case-sensitive,
  // berbeda dengan MySQL yang mengikuti collation case-insensitive.
  const searchTerm = `%${String(keyword ?? '').trim()}%`;
  const { rows } = await pool.query(
    `SELECT ${PRODUCT_COLUMNS}
     FROM products
     WHERE is_active = TRUE AND (name ILIKE $1 OR code ILIKE $1)
     ORDER BY name ASC`,
    [searchTerm]
  );

  return rows.map((row) => new Product(row));
}

module.exports = { searchProducts, PRODUCT_COLUMNS };
