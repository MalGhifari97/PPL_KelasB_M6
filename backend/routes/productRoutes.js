const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/', productController.searchProducts);
router.post('/cart', productController.createDraftTransaction);

module.exports = router;