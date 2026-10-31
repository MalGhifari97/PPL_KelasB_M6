const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

router.post('/pay/cash', transactionController.processCashPayment);

module.exports = router;