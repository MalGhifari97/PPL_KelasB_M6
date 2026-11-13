const pool = require('../config/db');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const { randomBytes } = require('crypto');
const { createServiceError, withTransaction } = require('../utils/dbTransaction');

const PAYMENT_TIMINGS = ['upfront', 'end'];
const ORDER_TYPES = ['retail', 'dine_in', 'take_away'];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoString(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

// Mengunci baris transaksi agar tidak ada perubahan keranjang bersamaan.
async function lockDraftTransaction(client, transactionId) {
  const { rows } = await client.query(
    'SELECT id, payment_status FROM transactions WHERE id = $1 FOR UPDATE',
    [transactionId]
  );

  if (!rows.length) {
    throw createServiceError('Transaksi tidak ditemukan', 404);
  }

  if (rows[0].payment_status !== 'unpaid') {
    throw createServiceError('Keranjang hanya dapat diubah saat transaksi belum dibayar', 409);
  }
}

// Menghitung ulang subtotal & total dari generated column transaction_items.subtotal.
async function recalculateTotals(client, transactionId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(subtotal), 0) AS subtotal
     FROM transaction_items
     WHERE transaction_id = $1`,
    [transactionId]
  );
  const subtotal = toNumber(rows[0].subtotal);

  await client.query(
    `UPDATE transactions
     SET subtotal = $1,
         total = GREATEST(0, $1::numeric - COALESCE(discount_amount, 0))
     WHERE id = $2`,
    [subtotal, transactionId]
  );
}

async function getCart(client, transactionId) {
  const { rows: transactionRows } = await client.query(
    `SELECT id, transaction_number, cashier_name, order_type, table_number,
            payment_timing, payment_status, subtotal, discount_amount, total,
            created_at, paid_at
     FROM transactions
     WHERE id = $1`,
    [transactionId]
  );

  if (!transactionRows.length) {
    throw createServiceError('Transaksi tidak ditemukan', 404);
  }

  const { rows: itemRows } = await client.query(
    `SELECT ti.id, ti.transaction_id, ti.product_id, ti.quantity, ti.unit_price,
            ti.note, ti.subtotal,
            p.code, p.name, p.category, p.product_type, p.is_cafe_menu,
            p.price, p.stock, p.expired_date, p.is_active
     FROM transaction_items ti
     LEFT JOIN products p ON p.id = ti.product_id AND p.is_active = TRUE
     WHERE ti.transaction_id = $1
     ORDER BY ti.id ASC`,
    [transactionId]
  );

  const items = itemRows.map((row) => {
    const product = new Product({
      id: row.product_id,
      code: row.code,
      name: row.name || 'Produk tidak aktif',
      category: row.category,
      product_type: row.product_type,
      is_cafe_menu: row.is_cafe_menu,
      price: row.price ?? row.unit_price,
      stock: row.stock ?? 0,
      expired_date: row.expired_date,
      is_active: row.is_active ?? false
    });

    return new CartItem(product, row.quantity, {
      id: row.id,
      transaction_id: row.transaction_id,
      product_id: row.product_id,
      unit_price: row.unit_price,
      note: row.note,
      subtotal: row.subtotal
    });
  });

  const transaction = transactionRows[0];

  return {
    id: transaction.id,
    transaction_number: transaction.transaction_number,
    cashier_name: transaction.cashier_name,
    order_type: transaction.order_type,
    table_number: transaction.table_number,
    payment_timing: transaction.payment_timing,
    payment_status: transaction.payment_status,
    subtotal: toNumber(transaction.subtotal),
    discount_amount: toNumber(transaction.discount_amount),
    total: toNumber(transaction.total),
    created_at: toIsoString(transaction.created_at),
    paid_at: toIsoString(transaction.paid_at),
    items
  };
}

async function createDraftTransaction({
  cashier_name = 'Kasir Utama',
  payment_timing = 'upfront',
  order_type = 'retail',
  table_number = null
} = {}) {
  if (!PAYMENT_TIMINGS.includes(payment_timing)) {
    throw createServiceError('payment_timing harus bernilai upfront atau end', 400);
  }

  if (!ORDER_TYPES.includes(order_type)) {
    throw createServiceError('order_type harus bernilai retail, dine_in, atau take_away', 400);
  }

  const normalizedTableNumber =
    table_number === null || table_number === undefined ? null : String(table_number).trim();

  // CHECK constraint di database akan menolak nilai tidak valid, jadi divalidasi lebih dulu.
  if (order_type === 'dine_in') {
    if (!normalizedTableNumber) {
      throw createServiceError('table_number wajib diisi untuk order_type dine_in', 400);
    }
    if (normalizedTableNumber.length > 10) {
      throw createServiceError('table_number maksimal 10 karakter', 400);
    }
  } else if (normalizedTableNumber) {
    throw createServiceError('table_number hanya boleh diisi untuk order_type dine_in', 400);
  }

  return withTransaction(async (client) => {
    const transactionNumber = `TRX-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const { rows } = await client.query(
      `INSERT INTO transactions
         (transaction_number, cashier_name, order_type, table_number, payment_timing,
          payment_status, subtotal, discount_amount, total)
       VALUES ($1, $2, $3, $4, $5, 'unpaid', 0, 0, 0)
       RETURNING id`,
      [transactionNumber, cashier_name, order_type, normalizedTableNumber, payment_timing]
    );

    return getCart(client, rows[0].id);
  });
}

async function getDraftTransaction(transactionId) {
  return getCart(pool, transactionId);
}

async function addToCart(transactionId, productId) {
  return withTransaction(async (client) => {
    await lockDraftTransaction(client, transactionId);

    const { rows: productRows } = await client.query(
      `SELECT id, code, name, category, product_type, is_cafe_menu,
              price, stock, expired_date, is_active
       FROM products
       WHERE id = $1 AND is_active = TRUE
       FOR UPDATE`,
      [productId]
    );

    if (!productRows.length) {
      throw createServiceError('Produk tidak ditemukan', 404);
    }

    const product = new Product(productRows[0]);
    const { rows: itemRows } = await client.query(
      `SELECT id, quantity
       FROM transaction_items
       WHERE transaction_id = $1 AND product_id = $2
       FOR UPDATE`,
      [transactionId, productId]
    );

    // Kuantitas awal satu unit untuk produk yang belum ada di keranjang.
    const quantity = (itemRows.length ? toNumber(itemRows[0].quantity) : 0) + 1;
    if (quantity > product.stock) {
      throw createServiceError('Stok produk tidak mencukupi', 400);
    }

    if (itemRows.length) {
      await client.query('UPDATE transaction_items SET quantity = $1 WHERE id = $2', [
        quantity,
        itemRows[0].id
      ]);
    } else {
      await client.query(
        `INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price)
         VALUES ($1, $2, 1, $3)`,
        [transactionId, productId, product.price]
      );
    }

    await recalculateTotals(client, transactionId);
    return getCart(client, transactionId);
  });
}

async function updateQty(transactionId, itemId, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw createServiceError('Kuantitas harus berupa bilangan bulat minimal 1', 400);
  }

  return withTransaction(async (client) => {
    await lockDraftTransaction(client, transactionId);

    const { rows: itemRows } = await client.query(
      `SELECT id, product_id
       FROM transaction_items
       WHERE id = $1 AND transaction_id = $2
       FOR UPDATE`,
      [itemId, transactionId]
    );

    if (!itemRows.length) {
      throw createServiceError('Item keranjang tidak ditemukan', 404);
    }

    const { rows: productRows } = await client.query(
      `SELECT stock
       FROM products
       WHERE id = $1 AND is_active = TRUE
       FOR UPDATE`,
      [itemRows[0].product_id]
    );

    if (!productRows.length) {
      throw createServiceError('Produk tidak ditemukan atau tidak aktif', 404);
    }

    if (quantity > toNumber(productRows[0].stock)) {
      throw createServiceError('Stok produk tidak mencukupi', 400);
    }

    await client.query('UPDATE transaction_items SET quantity = $1 WHERE id = $2', [
      quantity,
      itemId
    ]);
    await recalculateTotals(client, transactionId);
    return getCart(client, transactionId);
  });
}

async function removeItem(transactionId, itemId) {
  return withTransaction(async (client) => {
    await lockDraftTransaction(client, transactionId);

    const result = await client.query(
      'DELETE FROM transaction_items WHERE id = $1 AND transaction_id = $2',
      [itemId, transactionId]
    );

    if (!result.rowCount) {
      throw createServiceError('Item keranjang tidak ditemukan', 404);
    }

    await recalculateTotals(client, transactionId);
    return getCart(client, transactionId);
  });
}

module.exports = {
  createDraftTransaction,
  getDraftTransaction,
  getCart,
  addToCart,
  updateQty,
  removeItem
};
