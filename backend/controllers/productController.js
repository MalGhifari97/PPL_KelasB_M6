const { searchProducts } = require('../services/productService');

// M6-US1 AC-03: mencari produk aktif berdasarkan nama atau kode.
exports.searchProducts = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const products = await searchProducts(search);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        code: null,
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
      code: null,
      message: 'Gagal mencari produk',
      data: null
    });
  }
};
