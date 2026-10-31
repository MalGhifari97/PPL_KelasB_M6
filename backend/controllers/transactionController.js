const { addToCart, updateQty, removeItem } = require('../services/cartService');

function isPositiveId(value) {
	return /^[1-9]\d*$/.test(String(value));
}

async function sendCartResponse(res, message, operation) {
	try {
		const data = await operation();
		return res.json({ success: true, message, data });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		return res.status(statusCode).json({
			success: false,
			message: statusCode === 500 ? 'Gagal memproses keranjang' : error.message,
			data: null
		});
	}
}

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
