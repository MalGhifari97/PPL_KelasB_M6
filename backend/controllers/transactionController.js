const {
	createDraftTransaction,
	getDraftTransaction,
	addToCart,
	updateQty,
	removeItem
} = require('../services/cartService');

function isPositiveId(value) {
	return /^[1-9]\d*$/.test(String(value));
}

async function sendCartResponse(res, message, operation, successStatus = 200) {
	try {
		const data = await operation();
		return res.status(successStatus).json({ success: true, message, data });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		return res.status(statusCode).json({
			success: false,
			message: statusCode === 500 ? 'Gagal memproses keranjang' : error.message,
			data: null
		});
	}
}

exports.createDraftTransaction = async (req, res) => {
	const { cashier_name = 'Kasir Utama', payment_timing = 'upfront' } = req.body || {};

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
		() => createDraftTransaction({ cashier_name: cashier_name.trim(), payment_timing }),
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
		getDraftTransaction(transactionId)
	);
};

exports.addToCart = async (req, res) => {
	const { transactionId } = req.params;
	const { product_id: productId } = req.body;

	if (!isPositiveId(transactionId) || !isPositiveId(productId)) {
		return res.status(400).json({
			success: false,
			message: 'transactionId dan product_id harus berupa ID positif',
			data: null
		});
	}

	return sendCartResponse(res, 'Produk berhasil ditambahkan ke keranjang', () =>
		addToCart(transactionId, productId)
	);
};

exports.updateQty = async (req, res) => {
	const { transactionId, itemId } = req.params;
	const { quantity } = req.body;

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
		updateQty(transactionId, itemId, quantity)
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
		removeItem(transactionId, itemId)
	);
};

exports.processCashPayment = async (req, res) => res.status(501).json({
	success: false,
	message: 'Pembayaran belum tersedia pada scope M6-US1',
	data: null
});
