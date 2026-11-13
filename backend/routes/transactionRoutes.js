const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// Route statis diletakkan sebelum route dinamis agar tidak tertutup oleh /:transactionId.
router.post('/pay/cash', transactionController.processCashPayment);

router.post('/', transactionController.createDraftTransaction);
router.get('/:transactionId', transactionController.getDraftTransaction);
router.post('/:transactionId/items', transactionController.addToCart);
router.patch('/:transactionId/items/:itemId', transactionController.updateQty);
router.delete('/:transactionId/items/:itemId', transactionController.removeItem);

module.exports = router;
