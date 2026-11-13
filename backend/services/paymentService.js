const { randomBytes } = require('crypto');
const { createServiceError, withTransaction } = require('../utils/dbTransaction');
const { getCart } = require('./cartService');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toIsoString(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

// Kembalian = uang diterima - total tagihan.
// Fungsi murni agar mudah diuji tanpa database.
function calculateChange(total, cashReceived) {
  const totalAmount = roundMoney(toNumber(total));
  const received = roundMoney(toNumber(cashReceived));

  if (!Number.isFinite(received) || received < 0) {
    throw createServiceError('cash_received harus berupa angka minimal 0', 400);
  }

  if (received < totalAmount) {
    throw createServiceError(
      `Uang tunai kurang dari total tagihan (total Rp${totalAmount}, diterima Rp${received})`,
      400
    );
  }

  return roundMoney(received - totalAmount);
}

// Mencatat pembayaran tunai, menyimpan kembalian, dan menandai transaksi lunas.
async function processCashPayment({ transaction_id: transactionId, cash_received: cashReceived }) {
  const parsedTransactionId = Number(transactionId);
  const parsedCashReceived = Number(cashReceived);

  if (!Number.isSafeInteger(parsedTransactionId) || parsedTransactionId < 1) {
    throw createServiceError('transaction_id harus berupa ID positif', 400);
  }

  if (!Number.isFinite(parsedCashReceived) || parsedCashReceived < 0) {
    throw createServiceError('cash_received harus berupa angka minimal 0', 400);
  }

  return withTransaction(async (client) => {
    // Lock baris transaksi agar pembayaran ganda tidak dapat terjadi bersamaan.
    const { rows: transactionRows } = await client.query(
      `SELECT id, transaction_number, payment_status, subtotal, discount_amount, total
       FROM transactions
       WHERE id = $1
       FOR UPDATE`,
      [parsedTransactionId]
    );

    if (!transactionRows.length) {
      throw createServiceError('Transaksi tidak ditemukan', 404);
    }

    const transaction = transactionRows[0];

    if (transaction.payment_status === 'cancelled') {
      throw createServiceError('Transaksi telah dibatalkan', 409);
    }

    if (transaction.payment_status === 'paid') {
      throw createServiceError('Transaksi sudah lunas', 409);
    }

    const { rows: itemCountRows } = await client.query(
      'SELECT COUNT(*)::int AS item_count FROM transaction_items WHERE transaction_id = $1',
      [parsedTransactionId]
    );

    if (itemCountRows[0].item_count === 0) {
      throw createServiceError('Keranjang masih kosong', 400);
    }

    const total = toNumber(transaction.total);
    const changeAmount = calculateChange(total, parsedCashReceived);
    const referenceNumber = `PAY-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    const { rows: paymentRows } = await client.query(
      `INSERT INTO payments
         (transaction_id, method, amount_received, change_amount, reference_number)
       VALUES ($1, 'cash', $2, $3, $4)
       RETURNING id, method, amount_received, change_amount, confirmed_at, reference_number`,
      [parsedTransactionId, roundMoney(parsedCashReceived), changeAmount, referenceNumber]
    );

    await client.query(
      `UPDATE transactions
       SET payment_status = 'paid', paid_at = NOW()
       WHERE id = $1`,
      [parsedTransactionId]
    );

    const cart = await getCart(client, parsedTransactionId);
    const payment = paymentRows[0];

    return {
      transaction: {
        id: cart.id,
        transaction_number: cart.transaction_number,
        cashier_name: cart.cashier_name,
        order_type: cart.order_type,
        table_number: cart.table_number,
        payment_timing: cart.payment_timing,
        payment_status: cart.payment_status,
        subtotal: cart.subtotal,
        discount_amount: cart.discount_amount,
        total: cart.total,
        created_at: cart.created_at,
        paid_at: cart.paid_at
      },
      payment: {
        id: payment.id,
        method: payment.method,
        amount_received: toNumber(payment.amount_received),
        change_amount: toNumber(payment.change_amount),
        confirmed_at: toIsoString(payment.confirmed_at),
        reference_number: payment.reference_number
      },
      items: cart.items
    };
  });
}

module.exports = { calculateChange, processCashPayment };
