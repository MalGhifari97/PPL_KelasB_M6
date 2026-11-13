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
      fontFamily: 'var(--font-body)'
    }}>
      <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        maxWidth: '420px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-float)'
      }}>
        {/* Icon & Status */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            backgroundColor: 'var(--success-bg)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto'
          }}>
            <svg style={{ width: '24px', height: '24px', color: 'var(--success-solid)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: 'var(--text)' }}>Pembayaran Berhasil</h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Nomor Transaksi: <strong>{transactionNumber}</strong> • Waktu: <strong>{formatDateTime(paidAt)}</strong>
          </div>
          <span style={{ display: 'inline-block', backgroundColor: 'var(--success-bg)', color: 'var(--success-fg)', fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: 'var(--radius-full)', marginTop: '6px' }}>
            ● LUNAS
          </span>
        </div>

        {/* Ringkasan Pembayaran */}
        <div style={{ backgroundColor: 'var(--surface-2)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Total Tagihan</span>
            <span style={{ fontWeight: '700', color: 'var(--text)' }}>{formatRupiah(totalAmount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Metode Pembayaran</span>
            <span style={{ fontWeight: '600', color: 'var(--neutral-fg)' }}>{paymentMethod}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Uang Diterima</span>
            <span style={{ color: 'var(--neutral-fg)' }}>{formatRupiah(cashGiven)}</span>
          </div>
          {/* Nomor referensi dibuat backend pada kolom payments.reference_number. */}
          {referenceNumber && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>No. Referensi</span>
              <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{referenceNumber}</span>
            </div>
          )}
        </div>

        {/* Highlight Uang Kembalian */}
        <div style={{ backgroundColor: 'var(--surface-2)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>UANG KEMBALIAN</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kembalikan kepada pelanggan</div>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: '800', color: 'var(--text)' }}>
            {formatRupiah(changeAmount)}
          </div>
        </div>

        {/* Rincian Item Belanja */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span>RINCIAN ITEM ({items.length} BARANG)</span>
            <span>Kasir: {cashierName}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text)' }}>{item.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.qty}x @ {formatRupiah(item.price)}</div>
                </div>
                <div style={{ fontWeight: '600', color: 'var(--text)' }}>
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
            backgroundColor: 'var(--primary)',
            color: 'var(--surface)',
            fontWeight: '600',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          ⊕ Transaksi Baru (F10 / Enter)
        </button>
      </div>
    </div>
  );
};

export default PaymentSuccessModal;
