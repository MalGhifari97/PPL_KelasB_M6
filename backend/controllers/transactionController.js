const {
  createDraftTransaction,
  getDraftTransaction,
  addToCart,
  updateQty,
  removeItem
} = require('../services/cartService');
const { processCashPayment } = require('../services/paymentService');

function isPositiveId(value) {
  return /^[1-9]\d*$/.test(String(value));
}

function parseAmount(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value.trim());
  return Number.NaN;
}

async function sendCartResponse(
  res,
  message,
  operation,
  successStatus = 200,
  fallbackMessage = 'Gagal memproses keranjang'
) {
  try {
    const data = await operation();
    return res.status(successStatus).json({ success: true, message, data });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? fallbackMessage : error.message,
      data: null
    });
  }
}

exports.createDraftTransaction = async (req, res) => {
  const {
    cashier_name = 'Kasir Utama',
    payment_timing = 'upfront',
    order_type = 'retail',
    table_number = null
  } = req.body || {};

  if (typeof cashier_name !== 'string' || cashier_name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'cashier_name harus berupa teks dan tidak boleh kosong',
      data: null
    });
  }

  return sendCartResponse(
    res,
    'Keranjang berhasil dibuat',
    () =>
      createDraftTransaction({
        cashier_name: cashier_name.trim(),
        payment_timing,
        order_type,
        table_number
      }),
    201
  );
};

exports.getDraftTransaction = async (req, res) => {
  const { transactionId } = req.params;

  if (!isPositiveId(transactionId)) {
    return res.status(400).json({
      success: false,
      message: 'transactionId harus berupa ID positif',
      data: null
    });
  }

  return sendCartResponse(res, 'Keranjang berhasil dimuat', () =>
    getDraftTransaction(Number(transactionId))
  );
};

exports.addToCart = async (req, res) => {
  const { transactionId } = req.params;
  const { product_id: productId } = req.body || {};

  if (!isPositiveId(transactionId) || !isPositiveId(productId)) {
    return res.status(400).json({
      success: false,
      message: 'transactionId dan product_id harus berupa ID positif',
      data: null
    });
  }

  return sendCartResponse(res, 'Produk berhasil ditambahkan ke keranjang', () =>
    addToCart(Number(transactionId), Number(productId))
  );
};

exports.updateQty = async (req, res) => {
  const { transactionId, itemId } = req.params;
  const { quantity } = req.body || {};

  if (!isPositiveId(transactionId) || !isPositiveId(itemId)) {
    return res.status(400).json({
      success: false,
      message: 'transactionId dan itemId harus berupa ID positif',
      data: null
    });
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return res.status(400).json({
      success: false,
      message: 'Kuantitas harus berupa bilangan bulat minimal 1',
      data: null
    });
  }

  return sendCartResponse(res, 'Kuantitas item berhasil diperbarui', () =>
    updateQty(Number(transactionId), Number(itemId), quantity)
  );
};

exports.removeItem = async (req, res) => {
  const { transactionId, itemId } = req.params;

  if (!isPositiveId(transactionId) || !isPositiveId(itemId)) {
    return res.status(400).json({
      success: false,
      message: 'transactionId dan itemId harus berupa ID positif',
      data: null
    });
  }

  return sendCartResponse(res, 'Item berhasil dihapus dari keranjang', () =>
    removeItem(Number(transactionId), Number(itemId))
  );
};

// M6-US2: pembayaran tunai dan kembalian.
exports.processCashPayment = async (req, res) => {
  const { transaction_id: transactionId, cash_received: cashReceived } = req.body || {};

  if (!isPositiveId(transactionId)) {
    return res.status(400).json({
      success: false,
      message: 'transaction_id harus berupa ID positif',
      data: null
    });
  }

  const amount = parseAmount(cashReceived);

  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({
      success: false,
      message: 'cash_received harus berupa angka minimal 0',
      data: null
    });
  }

  return sendCartResponse(
    res,
    'Pembayaran tunai berhasil',
    () => processCashPayment({ transaction_id: Number(transactionId), cash_received: amount }),
    200,
    'Gagal memproses pembayaran'
  );
};
