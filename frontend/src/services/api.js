// Client API frontend -> backend Express (POS/Kasir M6).
// Semua response backend memakai envelope yang sama:
//   sukses : { success: true,  message, data }
//   gagal  : { success: false, code, message, data: null }
// Karena itu seluruh pemanggilan cukup lewat satu helper `request`.

const DEFAULT_BASE_URL = 'http://localhost:5000';

// VITE_API_BASE_URL bisa diisi di frontend/.env (lihat .env.example).
export const API_BASE_URL = String(
  import.meta.env?.VITE_API_BASE_URL || DEFAULT_BASE_URL
).replace(/\/+$/, '');

// Error yang membawa status HTTP dan kode bisnis backend (mis. INSUFFICIENT_PAYMENT).
export class ApiError extends Error {
  constructor(message, { status = 0, code = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    // fetch melempar TypeError saat backend mati / CORS ditolak.
    throw new ApiError(
      'Tidak dapat terhubung ke server. Pastikan backend berjalan di ' + API_BASE_URL,
      { status: 0 }
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload || payload.success === false) {
    throw new ApiError(payload?.message || 'Terjadi kesalahan pada server', {
      status: response.status,
      code: payload?.code ?? null
    });
  }

  return payload;
}

// M6-US2: mencatat pembayaran tunai, server menghitung kembalian & set status paid.
// Response `data`: { transaction, payment, items }.
export async function payCash(transactionId, cashReceived) {
  const payload = await request('/api/transactions/pay/cash', {
    method: 'POST',
    body: {
      transaction_id: Number(transactionId),
      cash_received: Number(cashReceived)
    }
  });

  return payload.data;
}

// M6-US1 AC-03: backend membalas 404 dengan `data: []` bila tidak ada yang cocok.
export async function searchProducts(keyword = '') {
  try {
    const payload = await request(`/api/products?search=${encodeURIComponent(keyword)}`);
    return Array.isArray(payload.data) ? payload.data : [];
  } catch (error) {
    if (error.status === 404) return [];
    throw error;
  }
}

export async function createDraftTransaction({
  cashierName = 'Kasir Utama',
  paymentTiming = 'upfront',
  orderType = 'retail',
  tableNumber = null
} = {}) {
  const payload = await request('/api/transactions', {
    method: 'POST',
    body: {
      cashier_name: cashierName,
      payment_timing: paymentTiming,
      order_type: orderType,
      table_number: tableNumber
    }
  });

  return payload.data;
}

export async function getTransaction(transactionId) {
  const payload = await request(`/api/transactions/${Number(transactionId)}`);
  return payload.data;
}

export async function addItem(transactionId, productId) {
  const payload = await request(`/api/transactions/${Number(transactionId)}/items`, {
    method: 'POST',
    body: { product_id: Number(productId) }
  });

  return payload.data;
}

export async function updateItemQty(transactionId, itemId, quantity) {
  const payload = await request(
    `/api/transactions/${Number(transactionId)}/items/${Number(itemId)}`,
    {
      method: 'PATCH',
      body: { quantity: Number(quantity) }
    }
  );

  return payload.data;
}

export async function removeItem(transactionId, itemId) {
  const payload = await request(
    `/api/transactions/${Number(transactionId)}/items/${Number(itemId)}`,
    { method: 'DELETE' }
  );

  return payload.data;
}

// Item keranjang backend -> bentuk yang dipakai komponen tampilan.
// `id` adalah id transaction_items (dipakai untuk PATCH/DELETE), bukan id produk.
export function normalizeCartItem(item = {}) {
  const product = item.product ?? {};
  const quantity = Number(item.quantity ?? 1);
  const unitPrice = Number(item.unit_price ?? product.price ?? 0);

  return {
    id: item.id ?? null,
    productId: item.product_id ?? product.id ?? null,
    name: product.name ?? 'Produk',
    code: product.code ?? '-',
    price: unitPrice,
    qty: quantity,
    subtotal: Number(item.subtotal ?? unitPrice * quantity)
  };
}

export function normalizeCart(cart = {}) {
  const items = Array.isArray(cart.items) ? cart.items : [];
  return items.map(normalizeCartItem);
}
