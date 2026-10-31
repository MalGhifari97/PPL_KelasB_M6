const db = require('../config/db');
const { searchProducts } = require('../services/productService');

// Search produk aktif berdasarkan nama atau kode
exports.searchProducts = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const products = await searchProducts(search);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan',
        data: []
      });
    }

    return res.json({
      success: true,
      message: 'Produk berhasil ditemukan',
      data: products
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Gagal mencari produk',
      data: null
    });
  }
};

// Buat keranjang/draft transaksi baru (status unpaid)
exports.createDraftTransaction = async (req, res) => {
  try {
    const { cashier_name, payment_timing = 'upfront', items = [] } = req.body;

    if (!items.length) {
      return res.status(400).json({ success: false, message: 'Keranjang belanja tidak boleh kosong' });
    }

    // Generate transaction_number unik
    const trxNumber = `TRX-${Date.now()}`;

    // Validasi stok & kalkulasi total
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const [products] = await db.query('SELECT price, stock FROM products WHERE id = ? AND is_active = TRUE', [item.product_id]);
      if (!products.length) {
        return res.status(404).json({ success: false, message: `Produk ID ${item.product_id} tidak ditemukan atau tidak aktif` });
      }

      const product = products[0];
      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Stok produk ID ${item.product_id} tidak mencukupi (Tersedia: ${product.stock})` });
      }

      const itemSubtotal = parseFloat(product.price) * item.quantity;
      subtotal += itemSubtotal;
      validatedItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.price
      });
    }

    // Insert transaksi
    const [trxResult] = await db.query(
      'INSERT INTO transactions (transaction_number, cashier_name, payment_timing, payment_status, subtotal, total) VALUES (?, ?, ?, "unpaid", ?, ?)',
      [trxNumber, cashier_name || 'Kasir Utama', payment_timing, subtotal, subtotal]
    );

    const transactionId = trxResult.insertId;

    // Insert items
    for (const item of validatedItems) {
      await db.query(
        'INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [transactionId, item.product_id, item.quantity, item.unit_price]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Transaksi/Keranjang berhasil dibuat',
      data: {
        transaction_id: transactionId,
        transaction_number: trxNumber,
        subtotal,
        total: subtotal
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};