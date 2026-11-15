const express = require('express');
const cors = require('cors');
require('dotenv').config();

const productRoutes = require('./backend/routes/productRoutes');
const transactionRoutes = require('./backend/routes/transactionRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Main Routes
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);

// Endpoint tidak dikenal
app.use((req, res) => {
  res.status(404).json({ success: false, code: null, message: 'Endpoint tidak ditemukan', data: null });
});

// Error handler terakhir agar body JSON rusak tetap dibalas dalam bentuk JSON.
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, code: null, message: 'Body request bukan JSON valid', data: null });
  }

  console.error('[server]', error.message);
  return res.status(500).json({ success: false, code: null, message: 'Terjadi kesalahan pada server', data: null });
});

const PORT = process.env.PORT || 5000;

// Hanya listen saat dijalankan langsung (npm start), sehingga app bisa di-require untuk pengujian.
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server POS Backend running di port ${PORT}`);
  });

  // Tanpa handler ini, nodemon hanya menampilkan stack trace "app crashed" yang
  // membingungkan. Kedua kode error di bawah paling sering terjadi saat server
  // dijalankan dua kali atau port direservasi service lain di Windows.
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[server] Port ${PORT} sudah dipakai. Kemungkinan server ini masih berjalan di terminal lain.`
      );
      console.error(
        '[server] Tutup terminal tersebut, atau ubah PORT di .env lalu samakan VITE_API_BASE_URL di frontend/.env.'
      );
    } else if (error.code === 'EACCES') {
      console.error(
        `[server] Port ${PORT} tidak boleh dipakai proses biasa (direservasi Windows/http.sys).`
      );
      console.error(
        '[server] Ubah PORT di .env ke port lain (mis. 5001) lalu samakan VITE_API_BASE_URL di frontend/.env.'
      );
    } else {
      console.error('[server] Gagal menjalankan server:', error.message);
    }

    process.exit(1);
  });
}

module.exports = app;
