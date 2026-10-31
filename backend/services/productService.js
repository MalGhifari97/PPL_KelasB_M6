const db = require('../config/db');
const Product = require('../models/Product');

async function searchProducts(keyword) {
  try {
    const searchTerm = `%${String(keyword ?? '').trim()}%`;
    const [rows] = await db.execute(
      `SELECT id, code, name, category, unit, price, stock, is_active
       FROM products
       WHERE is_active = TRUE AND (name LIKE ? OR code LIKE ?)
       ORDER BY name ASC`,
      [searchTerm, searchTerm]
    );

    return rows.map((row) => new Product(row));
  } catch (error) {
    throw error;
  }
}

module.exports = { searchProducts };