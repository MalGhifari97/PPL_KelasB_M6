const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatRupiah = (value) => `Rp ${toNumber(value).toLocaleString('id-ID')}`;

const formatDateTime = (value) => {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  });
};

// Normalisasi item dari backend ({ product, quantity, unit_price }) sekaligus
// tetap mendukung bentuk lokal lama ({ name, qty, price }).
const toDisplayItem = (item = {}) => {
  const quantity = toNumber(item.quantity ?? item.qty);
  const unitPrice = toNumber(item.unit_price ?? item.price ?? item.product?.price);

  return {
    id: item.id ?? item.product_id ?? item.name,
    name: item.product?.name ?? item.name ?? 'Produk',
    qty: quantity,
    price: unitPrice,
    subtotal: toNumber(item.subtotal, unitPrice * quantity),
  };
};

const PaymentSuccessModal = ({ transactionData = {}, onNewTransaction }) => {
  // Payload utama berasal dari POST /api/transactions/pay/cash:
  // { transaction, payment, items }. Fallback dipakai untuk bentuk data lama.
  const transaction = transactionData.transaction ?? {};
  const payment = transactionData.payment ?? {};

  const totalAmount = toNumber(transaction.total ?? transactionData.totalAmount);
  const cashGiven = toNumber(payment.amount_received ?? transactionData.cashGiven);
  const changeAmount = toNumber(payment.change_amount ?? transactionData.changeAmount);
  const transactionNumber =
    transaction.transaction_number ?? transactionData.transactionNumber ?? '-';
  const cashierName = transaction.cashier_name ?? transactionData.cashierName ?? '-';
  const paidAt =
    payment.confirmed_at ?? transaction.paid_at ?? transactionData.paidAt ?? null;
  const referenceNumber = payment.reference_number ?? null;
  const paymentMethod =
    payment.method === 'cash' || !payment.method ? '💵 Tunai (Cash)' : payment.method;

  const rawItems = Array.isArray(transactionData.items)
    ? transactionData.items
    : Array.isArray(transactionData.cart)
      ? transactionData.cart
      : [];
  const items = rawItems.map(toDisplayItem);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '420px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Icon & Status */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            backgroundColor: '#dcfce7',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto'
          }}>
            <svg style={{ width: '24px', height: '24px', color: '#16a34a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Pembayaran Berhasil</h3>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Nomor Transaksi: <strong>{transactionNumber}</strong> • Waktu: <strong>{formatDateTime(paidAt)}</strong>
          </div>
          <span style={{ display: 'inline-block', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', marginTop: '6px' }}>
            ● LUNAS
          </span>
        </div>

        {/* Ringkasan Pembayaran */}
        <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Total Tagihan</span>
            <span style={{ fontWeight: '700', color: '#0f172a' }}>{formatRupiah(totalAmount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Metode Pembayaran</span>
            <span style={{ fontWeight: '600', color: '#334155' }}>{paymentMethod}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Uang Diterima</span>
            <span style={{ color: '#334155' }}>{formatRupiah(cashGiven)}</span>
          </div>
          {/* Nomor referensi dibuat backend pada kolom payments.reference_number. */}
          {referenceNumber && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: '#94a3b8' }}>No. Referensi</span>
              <span style={{ fontWeight: '600', color: '#475569' }}>{referenceNumber}</span>
            </div>
          )}
        </div>

        {/* Highlight Uang Kembalian */}
        <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b' }}>UANG KEMBALIAN</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Kembalikan kepada pelanggan</div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
            {formatRupiah(changeAmount)}
          </div>
        </div>

        {/* Rincian Item Belanja */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>
            <span>RINCIAN ITEM ({items.length} BARANG)</span>
            <span>Kasir: {cashierName}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <div>
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>{item.name}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.qty}x @ {formatRupiah(item.price)}</div>
                </div>
                <div style={{ fontWeight: '600', color: '#0f172a' }}>
                  {formatRupiah(item.subtotal)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tombol Transaksi Baru */}
        <button
          onClick={onNewTransaction}
          style={{
            width: '100%',
            backgroundColor: '#1e3a8a',
            color: '#ffffff',
            fontWeight: '600',
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          ⊕ Transaksi Baru (F10 / Enter)
        </button>
      </div>
    </div>
  );
};

export default PaymentSuccessModal;
