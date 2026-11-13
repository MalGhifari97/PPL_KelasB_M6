import { useState } from 'react';
import { payCash } from '../services/api';

// Waktu pada header memakai jam terminal kasir (WIB), bukan tanggal hardcoded.
const formatDate = (date) =>
  date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });

const formatTime = (date) =>
  `${date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  })} WIB`;

const CashPaymentForm = ({
  cart = [],
  totalAmount = 0,
  transactionId = null,
  transactionNumber = null,
  onSubmitSuccess,
  onBack,
}) => {
  const [cashGiven, setCashGiven] = useState(String(totalAmount));
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now] = useState(() => new Date());

  const paid = Number.parseFloat(cashGiven) || 0;
  const changeAmount = Math.max(0, paid - totalAmount);
  const isEnough = paid >= totalAmount;

  const handleQuickAmount = (amount) => {
    setCashGiven(amount.toString());
    setError('');
  };

  // M6-US2: konfirmasi pembayaran dikirim ke backend. Server yang memvalidasi
  // kekurangan bayar, menghitung kembalian, dan menandai transaksi lunas.
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (paid < totalAmount) {
      setError('Nominal pembayaran kurang dari total tagihan.');
      return;
    }

    if (!transactionId) {
      setError('Transaksi belum tersinkron dengan server. Kembali ke keranjang lalu coba lagi.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const data = await payCash(transactionId, paid);
      onSubmitSuccess?.(data);
    } catch (apiError) {
      // Pesan backend sudah informatif, termasuk saat code = INSUFFICIENT_PAYMENT
      // ("Uang tunai kurang dari total tagihan (total Rp..., diterima Rp...)").
      setError(apiError.message || 'Pembayaran gagal diproses.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', fontFamily: 'sans-serif' }}>
      
      {/* HEADER ATAS PEMBAYARAN (Persis Figma) */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              MODUL PEMBAYARAN KASIR • <span style={{ color: '#2563eb' }}>Jalur Cepat POS</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
              Pelunasan Transaksi Tunai
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#334155' }}>
          <span style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
            📅 {formatDate(now)}
          </span>
          <span style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
            🕒 {formatTime(now)}
          </span>
        </div>
      </div>

      {/* DUA KOLOM UTAMA */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
        
        {/* KOLOM KIRI: RINCIAN TRANSAKSI KASIR */}
        <div style={{
          flex: '1',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          justify: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>Rincian Transaksi Kasir</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Daftar item belanja pelanggan yang siap dibayar</span>
              </div>
              <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px' }}>
                #{transactionNumber || 'BELUM-TERSINKRON'}
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ paddingBottom: '10px', fontWeight: '700' }}>PRODUK</th>
                  <th style={{ paddingBottom: '10px', fontWeight: '700', textAlign: 'center' }}>QTY</th>
                  <th style={{ paddingBottom: '10px', fontWeight: '700', textAlign: 'right' }}>HARGA</th>
                  <th style={{ paddingBottom: '10px', fontWeight: '700', textAlign: 'right' }}>SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '12px 0' }}>
                      <div style={{ fontWeight: '700', color: '#1e293b' }}>{item.name}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>SKU: {item.code}</div>
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'center', fontWeight: '700', color: '#334155' }}>
                      {item.qty} <span style={{ fontWeight: '400', fontSize: '11px' }}>pcs</span>
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', color: '#334155' }}>Rp {item.price.toLocaleString('id-ID')}</td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                      Rp {(item.price * item.qty).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#64748b', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '12px 0', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal Barang ({cart.reduce((sum, i) => sum + i.qty, 0)} pcs)</span>
                <span style={{ fontWeight: '700', color: '#1e293b' }}>Rp {totalAmount.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pajak PPN (11% Termasuk)</span>
                <span style={{ fontWeight: '700', color: '#1e293b' }}>Rp 0</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Diskon Promo Kasir</span>
                <span style={{ fontWeight: '700', color: '#2563eb' }}>Rp 0</span>
              </div>
            </div>
          </div>

          <div>
            <div style={{ backgroundColor: '#eff6ff', padding: '14px 18px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#1e40af', letterSpacing: '0.5px' }}>TOTAL TAGIHAN BERSIH</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#1d4ed8', marginTop: '2px' }}>Rp {totalAmount.toLocaleString('id-ID')}</div>
              </div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', backgroundColor: '#f8fafc' }}>
              <span style={{ fontSize: '18px' }}>👤</span>
              <div>
                <div style={{ fontWeight: '700', color: '#1e293b' }}>Pelanggan Umum (Walk-in)</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Tanpa ID Member • Harga Standar</div>
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: PROSES PEMBAYARAN TUNAI */}
        <div style={{
          flex: '1',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          justify: 'space-between'
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>Proses Pembayaran Tunai</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Pastikan nominal fisik telah dihitung dengan benar di kasir</span>
              </div>
              <span style={{ backgroundColor: '#eff6ff', color: '#1e3a8a', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                💵 Tunai / Cash
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                  Uang diterima (Rp)
                </label>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ketik angka atau klik pecahan cepat</span>
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', fontSize: '20px', color: '#0f172a' }}>Rp</span>
                <input
                  type="number"
                  value={cashGiven}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setCashGiven(e.target.value);
                    setError('');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 36px 12px 48px',
                    fontSize: '22px',
                    fontWeight: '800',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a'
                  }}
                  required
                />
                {cashGiven && (
                  <button
                    type="button"
                    onClick={() => setCashGiven('')}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '16px' }}
                  >
                    ✕
                  </button>
                )}
              </div>
              {error && <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{error}</p>}
            </div>

            <div>
              <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px' }}>PECAHAN CEPAT KASIR</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {[
                  { label: 'Uang Pas', val: totalAmount },
                  { label: 'Pecahan', val: 100000 },
                  { label: 'Pecahan', val: 150000 },
                  { label: 'Pecahan', val: 200000 },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickAmount(item.val)}
                    style={{
                      padding: '10px 4px',
                      fontSize: '11px',
                      backgroundColor: cashGiven === item.val.toString() ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${cashGiven === item.val.toString() ? '#2563eb' : '#e2e8f0'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      color: cashGiven === item.val.toString() ? '#1d4ed8' : '#334155'
                    }}
                  >
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{item.label}</div>
                    <div style={{ fontWeight: '700', marginTop: '2px' }}>Rp {item.val.toLocaleString('id-ID')}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: '#eff6ff', padding: '14px 16px', borderRadius: '8px', border: '1px solid #dbeafe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>Uang Kembalian</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                  Rp {changeAmount.toLocaleString('id-ID')}
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {changeAmount === 0 ? '(Kembalian Tidak Tersedia)' : `Rp ${paid.toLocaleString('id-ID')} - Rp ${totalAmount.toLocaleString('id-ID')} = Rp ${changeAmount.toLocaleString('id-ID')}`}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={onBack}
                disabled={isSubmitting}
                style={{
                  padding: '12px 18px',
                  fontSize: '13px',
                  fontWeight: '700',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.6 : 1
                }}
              >
                ← Kembali ke keranjang
              </button>
              <button
                type="submit"
                disabled={!isEnough || isSubmitting}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  fontSize: '13px',
                  fontWeight: '700',
                  backgroundColor: isEnough && !isSubmitting ? '#1e3a8a' : '#cbd5e1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isEnough && !isSubmitting ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {isSubmitting ? (
                  '⏳ Memproses pembayaran...'
                ) : (
                  <>
                    ✓ Konfirmasi Pembayaran <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>F9</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* FOOTER PERSIS FIGMA */}
          <div style={{
            marginTop: '16px',
            padding: '10px 14px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '11px',
            color: '#64748b',
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center'
          }}>
            <span>🛈 Tekan tombol <strong style={{ color: '#1e293b' }}>Enter</strong> atau <strong style={{ color: '#1e293b' }}>F9</strong> untuk segera mencetak struk kasir</span>
            <span style={{ fontWeight: '700', color: '#1e293b' }}>Mesin Cetak Thermal: Siap</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CashPaymentForm;