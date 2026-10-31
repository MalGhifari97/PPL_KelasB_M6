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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server POS Backend running di port ${PORT}`);
});