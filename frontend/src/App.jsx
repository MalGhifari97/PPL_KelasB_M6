import { useEffect, useMemo, useState } from "react";
import "./App.css";
import CashPaymentForm from "./components/CashPaymentForm";
import PaymentSuccessModal from "./components/PaymentSuccessModal";
import {
  addItem,
  createDraftTransaction,
  getTransaction,
  normalizeCart,
  removeItem,
  searchProducts,
  updateItemQty,
} from "./services/api";

// Kasir yang dipakai saat draft transaksi dibuat (ikut tersimpan di backend).
const CASHIER_NAME = "Budi Santoso";

// Keranjang awal: belum ada draft transaksi di server.
const EMPTY_CART = {
  transactionId: null,
  transactionNumber: null,
  total: 0,
  items: [],
};

// Notifikasi ringan untuk error API (mis. backend belum berjalan) dan info keranjang.
const FeedbackBanner = ({ feedback, onDismiss }) => {
  if (!feedback) return null;

  const palette = {
    error: { background: "#fee2e2", border: "#fecaca", color: "#b91c1c" },
    warning: { background: "#fef3c7", border: "#fde68a", color: "#b45309" },
    info: { background: "#e0f2fe", border: "#bae6fd", color: "#0369a1" },
  };
  const tone = palette[feedback.type] ?? palette.info;

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        background: tone.background,
        border: `1px solid ${tone.border}`,
        color: tone.color,
        borderRadius: "8px",
        padding: "10px 14px",
        fontSize: "12px",
        fontWeight: "600",
        marginBottom: "10px",
      }}
    >
      <span>{feedback.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Tutup notifikasi"
        style={{
          border: "none",
          background: "transparent",
          color: tone.color,
          cursor: "pointer",
          fontSize: "14px",
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
};


function App() {
  // Katalog produk bersumber dari GET /api/products (bukan data hardcoded).
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Semua Produk");

  // Satu draft transaksi aktif (payment_status = unpaid) dipakai bersama oleh
  // keranjang dan form pembayaran tunai.
  const [cartState, setCartState] = useState(EMPTY_CART);

  // Mode Halaman: "pos" | "transaksi" | "success"
  const [pageMode, setPageMode] = useState("pos");
  const [transactionData, setTransactionData] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const cart = cartState.items;
  const total = cartState.total;

  // Setiap response backend memuat keranjang terbaru (data.total + data.items),
  // sehingga tampilan selalu memakai hasil hitung server.
  const applyCartResponse = (data) => {
    setCartState({
      transactionId: data?.id ?? null,
      transactionNumber: data?.transaction_number ?? null,
      total: Number(data?.total ?? 0),
      items: normalizeCart(data),
    });
  };

  useEffect(() => {
    let isCancelled = false;

    const loadProducts = async () => {
      setIsLoadingProducts(true);

      try {
        const list = await searchProducts("");
        if (isCancelled) return;

        setProducts(
          list.map((product) => ({
            id: product.id,
            name: product.name,
            code: product.code,
            category: product.category,
            price: Number(product.price ?? 0),
          })),
        );
      } catch (error) {
        if (isCancelled) return;
        setProducts([]);
        setFeedback({ type: "error", message: error.message });
      } finally {
        if (!isCancelled) setIsLoadingProducts(false);
      }
    };

    loadProducts();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Tab kategori mengikuti kategori produk yang benar-benar ada di database.
  const tabs = useMemo(() => {
    const categories = [
      ...new Set(products.map((product) => product.category).filter(Boolean)),
    ];
    return ["Semua Produk", ...categories];
  }, [products]);

  const currentTab = tabs.includes(activeTab) ? activeTab : "Semua Produk";

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const keyword = search.toLowerCase();

      const matchesSearch =
        product.name.toLowerCase().includes(keyword) ||
        product.code.toLowerCase().includes(keyword);

      const matchesTab =
        currentTab === "Semua Produk" || product.category === currentTab;

      return matchesSearch && matchesTab;
    });
  }, [products, search, currentTab]);

  // Draft dibuat sekali (lazy) lalu dipakai ulang sampai "Transaksi Baru".
  const ensureDraftTransaction = async (existingId = cartState.transactionId) => {
    if (existingId) return { id: existingId };

    const draft = await createDraftTransaction({ cashierName: CASHIER_NAME });
    applyCartResponse(draft);
    return draft;
  };

  const addToCart = async (product) => {
    if (isBusy) return;

    setIsBusy(true);
    setFeedback(null);

    try {
      const draft = await ensureDraftTransaction();
      const data = await addItem(draft.id, product.id);
      applyCartResponse(data);
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setIsBusy(false);
    }
  };

  const updateQty = async (itemId, delta) => {
    if (isBusy || !cartState.transactionId) return;

    const item = cart.find((entry) => entry.id === itemId);
    if (!item) return;

    const nextQty = item.qty + delta;
    setIsBusy(true);
    setFeedback(null);

    try {
      // Kuantitas < 1 dihapus dari keranjang, sama seperti perilaku backend.
      const data =
        nextQty < 1
          ? await removeItem(cartState.transactionId, itemId)
          : await updateItemQty(cartState.transactionId, itemId, nextQty);
      applyCartResponse(data);
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setIsBusy(false);
    }
  };

  // Masuk ke form pembayaran tunai. Draft dipastikan ada dan total diambil
  // ulang dari server agar cocok dengan nilai yang divalidasi saat pay/cash.
  const handleGoToPayment = async () => {
    if (isBusy) return;

    if (!cart.length) {
      setFeedback({ type: "warning", message: "Keranjang masih kosong." });
      return;
    }

    setIsBusy(true);
    setFeedback(null);

    try {
      const transaction = cartState.transactionId
        ? await getTransaction(cartState.transactionId)
        : await createDraftTransaction({ cashierName: CASHIER_NAME });

      applyCartResponse(transaction);
      setPageMode("transaksi");
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setIsBusy(false);
    }
  };

  const handleBackToCart = () => {
    if (isBusy) return;

    // Transaksi yang sudah lunas tidak dapat diubah lagi di backend (409),
    // jadi keluar dari mode sukses berarti mulai transaksi baru.
    if (pageMode === "success") {
      setTransactionData(null);
      setCartState(EMPTY_CART);
      setFeedback(null);
    }

    setPageMode("pos");
  };

  // KETIKA KLIK "KONFIRMASI PEMBAYARAN" (F9):
  // `data` adalah response POST /api/transactions/pay/cash
  // ({ transaction, payment, items }) yang dipakai modal sukses.
  const handlePaymentSubmit = (data) => {
    setTransactionData(data);
    setPageMode("success");
  };

  // KETIKA KLIK "TRANSAKSI BARU" (F10 / Enter):
  // Reset keranjang & draft; draft baru dibuat saat produk berikutnya ditambah.
  const handleNewTransaction = () => {
    setTransactionData(null);
    setCartState(EMPTY_CART);
    setPageMode("pos");
    setFeedback(null);
  };

  return (
    <div className="pos-app">
      {/* TOPBAR / HEADER KASIR PERSIS FIGMA */}
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">ERP</div>
          <span className="brand-text">POS KASIR</span>
        </div>

        <div className="topbar-right">
          <div className="status-pill">
            <span className="dot" />
            Online
          </div>
          <div className="user-box">
            <span className="user-label">Kasir:</span>
            <span>{CASHIER_NAME}</span>
          </div>
          <button
            className="avatar-button"
            type="button"
            aria-label="User profile"
          >
            ☰
          </button>
        </div>
      </header>

      <div className="content-shell">
        {/* SIDEBAR DENGAN SOROTAN PERSIS FIGMA */}
        <aside className="sidebar">
          <div className="side-section-title">MODUL KASIR</div>
          <nav className="nav-list">
            <button
              type="button"
              className={`nav-item ${pageMode === "pos" ? "active" : ""}`}
              onClick={handleBackToCart}
            >
              <span className="nav-icon">◫</span>
              Point of Sale / Kasir
            </button>
            <button
              type="button"
              className={`nav-item ${pageMode === "transaksi" ? "active" : ""}`}
              onClick={() => {
                if (cart.length > 0) handleGoToPayment();
              }}
            >
              <span className="nav-icon">▣</span>
              Transaksi Aktif
            </button>
            <button
              type="button"
              className={`nav-item ${pageMode === "success" ? "active" : ""}`}
            >
              <span className="nav-icon">◌</span>
              Riwayat Kasir
            </button>
          </nav>

          <div className="terminal-box">
            <div className="terminal-title">Terminal #01</div>
            <div className="terminal-sub">V2.4.0 ERP POS Desktop</div>
          </div>
        </aside>

        {/* AREA UTAMA DI SEBELAH KANAN SIDEBAR */}
        <main className="main-panel">
          {pageMode === "transaksi" && (
            /* HALAMAN FORM PEMBAYARAN TUNAI (Screenshot 2026-11-01 132510.png) */
            <div style={{ width: "100%", padding: "12px" }}>
              <FeedbackBanner
                feedback={feedback}
                onDismiss={() => setFeedback(null)}
              />
              <CashPaymentForm
                cart={cart}
                totalAmount={total}
                transactionId={cartState.transactionId}
                transactionNumber={cartState.transactionNumber}
                onBack={handleBackToCart}
                onSubmitSuccess={handlePaymentSubmit}
              />
            </div>
          )}

          {pageMode === "pos" && (
            /* HALAMAN KATALOG KASIR UTAMA */
            <>
              <section className="catalog-panel">
                <FeedbackBanner
                  feedback={feedback}
                  onDismiss={() => setFeedback(null)}
                />

                <div className="search-box">
                  <span className="search-icon">⌕</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari nama atau kode produk..."
                  />
                </div>

                <div className="category-row">
                  {tabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={tab === currentTab ? "tab active" : "tab"}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="catalog-header">
                  <h2>Katalog Produk</h2>
                  <span className="badge">
                    {filteredProducts.length} Item Tersedia
                  </span>
                </div>

                <div className="product-list">
                  {isLoadingProducts ? (
                    <div className="empty-state">
                      <div className="empty-icon">⏳</div>
                      <div className="empty-title">Memuat produk...</div>
                      <p>Mengambil daftar produk aktif dari server.</p>
                    </div>
                  ) : filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <div key={product.id} className="product-card">
                        <div className="product-info">
                          <div className="product-name">{product.name}</div>
                          <div className="product-price">
                            Rp {product.price.toLocaleString("id-ID")}
                          </div>
                        </div>
                        <div className="product-meta">
                          <span className="product-code">{product.code}</span>
                          <button
                            type="button"
                            className="add-button"
                            disabled={isBusy}
                            onClick={() => addToCart(product)}
                          >
                            ➕ Tambah
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">⌕</div>
                      <div className="empty-title">produk tidak ditemukan</div>
                      <p>
                        Coba ubah kata kunci atau pilih kategori lain untuk
                        menampilkan hasil pencarian.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <aside className="cart-panel">
                <div className="cart-header">
                  <div className="cart-title">Keranjang Belanja</div>
                  <span className="cart-count">
                    {cart.length} Produk (
                    {cart.reduce((sum, item) => sum + item.qty, 0)} Pcs)
                  </span>
                </div>

                <div className="cart-items">
                  {cart.length > 0 ? (
                    cart.map((item) => (
                      <div key={item.id} className="cart-item">
                        <div className="cart-item-main">
                          <div className="cart-item-name">{item.name}</div>
                          <div className="cart-item-code">{item.code}</div>
                        </div>
                        <div className="cart-item-controls">
                          <div className="price">
                            Rp {item.price.toLocaleString("id-ID")}
                          </div>
                          <div className="qty-box">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => updateQty(item.id, -1)}
                            >
                              -
                            </button>
                            <span>{item.qty}</span>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => updateQty(item.id, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="cart-empty">
                      Belum ada produk di dalam keranjang
                    </div>
                  )}
                </div>

                <div className="date-row">
                  <button type="button" className="date-box active">
                    Pembayaran di Awal
                  </button>
                  <button type="button" className="date-box">
                    Pembayaran di Akhir
                  </button>
                </div>

                <div className="payment-summary">
                  <div className="summary-label-row">
                    <span>Ringkasan Pembayaran</span>
                    <span>Faktur Otomatis</span>
                  </div>

                  <div className="grand-total-box">
                    <div className="total-text">TOTAL TAGIHAN</div>
                    <div className="amount">
                      Rp {total.toLocaleString("id-ID")}
                    </div>
                    <div className="tax-note">Sudah termasuk PPN 11%</div>
                  </div>

                  <button
                    type="button"
                    className="checkout-button"
                    disabled={cart.length === 0 || isBusy}
                    onClick={handleGoToPayment}
                  >
                    {isBusy ? "Menyiapkan transaksi..." : "Lanjut ke pembayaran →"}
                  </button>
                </div>
              </aside>
            </>
          )}

          {pageMode === "success" && (
            /* HALAMAN BERSIH POLOS SAAT MODAL SUKSES DITAMPILKAN (Screenshot 2026-11-01 132551.png) */
            <div style={{ width: "100%", height: "100%", backgroundColor: "#f8fafc" }} />
          )}
        </main>
      </div>

      {/* POP-UP MODAL PEMBAYARAN BERHASIL (Sesuai Screenshot 2026-11-01 132551.png) */}
      {transactionData && pageMode === "success" && (
        <PaymentSuccessModal
          transactionData={transactionData}
          onNewTransaction={handleNewTransaction}
        />
      )}
    </div>
  );
}

export default App;