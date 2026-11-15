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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', fontFamily: 'var(--font-body)' }}>
      
      {/* HEADER ATAS PEMBAYARAN (Persis Figma) */}
      <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        border: '1px solid var(--line)',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        boxShadow: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ backgroundColor: 'var(--primary)', color: 'var(--surface)', padding: '10px', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              MODUL PEMBAYARAN KASIR • <span style={{ color: 'var(--primary)' }}>Jalur Cepat POS</span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: '800', color: 'var(--text)', marginTop: '2px' }}>
              Pelunasan Transaksi Tunai
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', fontSize: '0.875rem', color: 'var(--neutral-fg)' }}>
          <span style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--line)', padding: '6px 14px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
            📅 {formatDate(now)}
          </span>
          <span style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--line)', padding: '6px 14px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
            🕒 {formatTime(now)}
          </span>
        </div>
      </div>

      {/* DUA KOLOM UTAMA */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
        
        {/* KOLOM KIRI: RINCIAN TRANSAKSI KASIR */}
        <div style={{
          flex: '1',
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          border: '1px solid var(--line)',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          justify: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '800', color: 'var(--text)' }}>Rincian Transaksi Kasir</h3>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Daftar item belanja pelanggan yang siap dibayar</span>
              </div>
              <span style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '700', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>
                #{transactionNumber || 'BELUM-TERSINKRON'}
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '16px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ paddingBottom: '10px', fontWeight: '700' }}>PRODUK</th>
                  <th style={{ paddingBottom: '10px', fontWeight: '700', textAlign: 'center' }}>QTY</th>
                  <th style={{ paddingBottom: '10px', fontWeight: '700', textAlign: 'right' }}>HARGA</th>
                  <th style={{ paddingBottom: '10px', fontWeight: '700', textAlign: 'right' }}>SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--surface-2)' }}>
                    <td style={{ padding: '12px 0' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text)' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>SKU: {item.code}</div>
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'center', fontWeight: '700', color: 'var(--neutral-fg)' }}>
                      {item.qty} <span style={{ fontWeight: '400', fontSize: '0.75rem' }}>pcs</span>
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--neutral-fg)' }}>Rp {item.price.toLocaleString('id-ID')}</td>
                    <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: '700', color: 'var(--text)' }}>
                      Rp {(item.price * item.qty).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem', color: 'var(--text-muted)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '12px 0', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal Barang ({cart.reduce((sum, i) => sum + i.qty, 0)} pcs)</span>
                <span style={{ fontWeight: '700', color: 'var(--text)' }}>Rp {totalAmount.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pajak PPN (11% Termasuk)</span>
                <span style={{ fontWeight: '700', color: 'var(--text)' }}>Rp 0</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Diskon Promo Kasir</span>
                <span style={{ fontWeight: '700', color: 'var(--primary)' }}>Rp 0</span>
              </div>
            </div>
          </div>

          <div>
            <div style={{ backgroundColor: 'var(--primary-soft)', padding: '14px 18px', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.5px' }}>TOTAL TAGIHAN BERSIH</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: '800', color: 'var(--primary)', marginTop: '2px' }}>Rp {totalAmount.toLocaleString('id-ID')}</div>
              </div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>

            <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', backgroundColor: 'var(--surface-2)' }}>
              <span style={{ fontSize: '18px' }}>👤</span>
              <div>
                <div style={{ fontWeight: '700', color: 'var(--text)' }}>Pelanggan Umum (Walk-in)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tanpa ID Member • Harga Standar</div>
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: PROSES PEMBAYARAN TUNAI */}
        <div style={{
          flex: '1',
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          border: '1px solid var(--line)',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          justify: 'space-between'
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '800', color: 'var(--text)' }}>Proses Pembayaran Tunai</h3>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Pastikan nominal fisik telah dihitung dengan benar di kasir</span>
              </div>
              <span style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '700', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
                💵 Tunai / Cash
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                  Uang diterima (Rp)
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ketik angka atau klik pecahan cepat</span>
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', fontSize: '20px', color: 'var(--text)' }}>Rp</span>
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
                    fontSize: '1.375rem',
                    fontWeight: '800',
                    border: '1px solid var(--line-strong)',
                    borderRadius: 'var(--radius-sm)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--surface-2)',
                    color: 'var(--text)'
                  }}
                  required
                />
                {cashGiven && (
                  <button
                    type="button"
                    onClick={() => setCashGiven('')}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}
                  >
                    ✕
                  </button>
                )}
              </div>
              {error && <p style={{ color: 'var(--danger-solid)', fontSize: '0.75rem', marginTop: '4px' }}>{error}</p>}
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>PECAHAN CEPAT KASIR</div>
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
                      fontSize: '0.75rem',
                      backgroundColor: cashGiven === item.val.toString() ? 'var(--primary-soft)' : 'var(--surface-2)',
                      border: `1px solid ${cashGiven === item.val.toString() ? 'var(--primary)' : 'var(--line)'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      color: cashGiven === item.val.toString() ? 'var(--primary)' : 'var(--neutral-fg)'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.label}</div>
                    <div style={{ fontWeight: '700', marginTop: '2px' }}>Rp {item.val.toLocaleString('id-ID')}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--primary-soft)', padding: '14px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>Uang Kembalian</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: '800', color: 'var(--text)', marginTop: '2px' }}>
                  Rp {changeAmount.toLocaleString('id-ID')}
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  backgroundColor: 'var(--surface-2)',
                  color: 'var(--neutral-fg)',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 'var(--radius-sm)',
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
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  backgroundColor: isEnough && !isSubmitting ? 'var(--primary)' : 'var(--line-strong)',
                  color: 'var(--surface)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
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
                    ✓ Konfirmasi Pembayaran <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>F9</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* FOOTER PERSIS FIGMA */}
          <div style={{
            marginTop: '16px',
            padding: '10px 14px',
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center'
          }}>
            <span>🛈 Tekan tombol <strong style={{ color: 'var(--text)' }}>Enter</strong> atau <strong style={{ color: 'var(--text)' }}>F9</strong> untuk segera mencetak struk kasir</span>
            <span style={{ fontWeight: '700', color: 'var(--text)' }}>Mesin Cetak Thermal: Siap</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CashPaymentForm;