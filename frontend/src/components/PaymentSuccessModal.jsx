import React from 'react';

const PaymentSuccessModal = ({ transactionData, onNewTransaction }) => {
  const { totalAmount, cashGiven, changeAmount, cart = [] } = transactionData;

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
            Nomor Transaksi: <strong>TRX-20250524-0089</strong> • Waktu: <strong>24 Mei 2025, 14:32 WIB</strong>
          </div>
          <span style={{ display: 'inline-block', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', marginTop: '6px' }}>
            ● LUNAS
          </span>
        </div>

        {/* Ringkasan Pembayaran */}
        <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Total Tagihan</span>
            <span style={{ fontWeight: '700', color: '#0f172a' }}>Rp {totalAmount.toLocaleString('id-ID')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Metode Pembayaran</span>
            <span style={{ fontWeight: '600', color: '#334155' }}>💵 Tunai (Cash)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Uang Diterima</span>
            <span style={{ color: '#334155' }}>Rp {cashGiven.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Highlight Uang Kembalian */}
        <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b' }}>UANG KEMBALIAN</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Kembalikan kepada pelanggan</div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
            Rp {changeAmount.toLocaleString('id-ID')}
          </div>
        </div>

        {/* Rincian Item Belanja */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>
            <span>RINCIAN ITEM ({cart.length} BARANG)</span>
            <span>Kasir: Budi S.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {cart.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <div>
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>{item.name}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.qty}x @ Rp {item.price.toLocaleString('id-ID')}</div>
                </div>
                <div style={{ fontWeight: '600', color: '#0f172a' }}>
                  Rp {(item.price * item.qty).toLocaleString('id-ID')}
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