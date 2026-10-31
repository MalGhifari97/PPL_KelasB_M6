const db = require('../config/db');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const { randomBytes } = require('crypto');

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function withTransaction(callback) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function lockDraftTransaction(connection, transactionId) {
  const [rows] = await connection.execute(
    'SELECT id, payment_status FROM transactions WHERE id = ? FOR UPDATE',
    [transactionId]
  );

  if (!rows.length) {
    throw createServiceError('Transaksi tidak ditemukan', 404);
  }

  if (rows[0].payment_status !== 'unpaid') {
    throw createServiceError('Keranjang hanya dapat diubah saat transaksi belum dibayar', 409);
  }
}

async function recalculateTotals(connection, transactionId) {
  const [subtotalRows] = await connection.execute(
    `SELECT COALESCE(SUM(quantity * unit_price), 0) AS subtotal
     FROM transaction_items
     WHERE transaction_id = ?`,
    [transactionId]
  );
  const subtotal = subtotalRows[0].subtotal;

  await connection.execute(
    `UPDATE transactions
     SET subtotal = ?, total = GREATEST(0, ? - COALESCE(discount_amount, 0))
     WHERE id = ?`,
    [subtotal, subtotal, transactionId]
  );
}

async function getCart(connection, transactionId) {
  const [transactionRows] = await connection.execute(
    `SELECT id, transaction_number, payment_status, subtotal, discount_amount, total
     FROM transactions
     WHERE id = ?`,
    [transactionId]
  );

  if (!transactionRows.length) {
    throw createServiceError('Transaksi tidak ditemukan', 404);
  }

  const [itemRows] = await connection.execute(
        `SELECT ti.id, ti.transaction_id, ti.product_id, ti.quantity, ti.unit_price,
          p.code, p.name, p.category, p.unit, p.price, p.stock, p.is_active
     FROM transaction_items ti
         LEFT JOIN products p ON p.id = ti.product_id AND p.is_active = TRUE
     WHERE ti.transaction_id = ?
     ORDER BY ti.id ASC`,
    [transactionId]
  );

  const items = itemRows.map((row) => {
    const product = new Product({
      id: row.product_id,
      code: row.code,
      name: row.name || 'Produk tidak aktif',
      category: row.category,
      unit: row.unit,
      price: row.price ?? row.unit_price,
      stock: row.stock ?? 0,
      is_active: row.is_active ?? false
    });

    return new CartItem(product, row.quantity, {
      id: row.id,
      transaction_id: row.transaction_id,
      product_id: row.product_id,
      unit_price: row.unit_price
    });
  });

  return {
    ...transactionRows[0],
    items
  };
}

async function createDraftTransaction({ cashier_name = 'Kasir Utama', payment_timing = 'upfront' } = {}) {
  if (!['upfront', 'end'].includes(payment_timing)) {
    throw createServiceError('payment_timing harus bernilai upfront atau end', 400);
  }

  return withTransaction(async (connection) => {
    const transactionNumber = `TRX-${Date.now()}-${randomBytes(3).toString('hex')}`;
    const [result] = await connection.execute(
      `INSERT INTO transactions
         (transaction_number, cashier_name, payment_timing, payment_status,
          subtotal, discount_amount, total)
       VALUES (?, ?, ?, 'unpaid', 0, 0, 0)`,
      [transactionNumber, cashier_name, payment_timing]
    );

    return getCart(connection, result.insertId);
  });
}

async function getDraftTransaction(transactionId) {
  return getCart(db, transactionId);
}

async function addToCart(transactionId, productId) {
  return withTransaction(async (connection) => {
    await lockDraftTransaction(connection, transactionId);

    const [productRows] = await connection.execute(
      `SELECT id, code, name, category, unit, price, stock, is_active
       FROM products
       WHERE id = ? AND is_active = TRUE
       FOR UPDATE`,
      [productId]
    );

    if (!productRows.length) {
      throw createServiceError('Produk tidak ditemukan', 404);
    }

    const product = new Product(productRows[0]);
    const [itemRows] = await connection.execute(
      `SELECT id, quantity
       FROM transaction_items
       WHERE transaction_id = ? AND product_id = ?
       FOR UPDATE`,
      [transactionId, productId]
    );

    const quantity = (itemRows[0]?.quantity || 0) + 1;
    if (quantity > Number(product.stock)) {
      throw createServiceError('Stok produk tidak mencukupi', 400);
    }

    if (itemRows.length) {
      await connection.execute(
        'UPDATE transaction_items SET quantity = ? WHERE id = ?',
        [quantity, itemRows[0].id]
      );
    } else {
      await connection.execute(
        `INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price)
         VALUES (?, ?, 1, ?)`,
        [transactionId, productId, product.price]
      );
    }

    await recalculateTotals(connection, transactionId);
    return getCart(connection, transactionId);
  });
}

async function updateQty(transactionId, itemId, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw createServiceError('Kuantitas harus berupa bilangan bulat minimal 1', 400);
  }

  return withTransaction(async (connection) => {
    await lockDraftTransaction(connection, transactionId);

    const [itemRows] = await connection.execute(
      `SELECT id, product_id
       FROM transaction_items
       WHERE id = ? AND transaction_id = ?
       FOR UPDATE`,
      [itemId, transactionId]
    );

    if (!itemRows.length) {
      throw createServiceError('Item keranjang tidak ditemukan', 404);
    }

    const [productRows] = await connection.execute(
      `SELECT stock
       FROM products
       WHERE id = ? AND is_active = TRUE
       FOR UPDATE`,
      [itemRows[0].product_id]
    );

    if (!productRows.length) {
      throw createServiceError('Produk tidak ditemukan atau tidak aktif', 404);
    }

    if (quantity > Number(productRows[0].stock)) {
      throw createServiceError('Stok produk tidak mencukupi', 400);
    }

    await connection.execute(
      'UPDATE transaction_items SET quantity = ? WHERE id = ?',
      [quantity, itemId]
    );
    await recalculateTotals(connection, transactionId);
    return getCart(connection, transactionId);
  });
}

async function removeItem(transactionId, itemId) {
  return withTransaction(async (connection) => {
    await lockDraftTransaction(connection, transactionId);

    const [result] = await connection.execute(
      'DELETE FROM transaction_items WHERE id = ? AND transaction_id = ?',
      [itemId, transactionId]
    );

    if (!result.affectedRows) {
      throw createServiceError('Item keranjang tidak ditemukan', 404);
    }

    await recalculateTotals(connection, transactionId);
    return getCart(connection, transactionId);
  });
}

module.exports = {
  createDraftTransaction,
  getDraftTransaction,
  addToCart,
  updateQty,
  removeItem
};