const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

router.post('/', transactionController.createDraftTransaction);
router.get('/:transactionId', transactionController.getDraftTransaction);
router.post('/:transactionId/items', transactionController.addToCart);
router.patch('/:transactionId/items/:itemId', transactionController.updateQty);
router.delete('/:transactionId/items/:itemId', transactionController.removeItem);
router.post('/pay/cash', transactionController.processCashPayment);

module.exports = router;