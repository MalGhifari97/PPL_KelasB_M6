import { useMemo, useState } from "react";
import "./App.css";

const products = [
  {
    id: 1,
    name: "Beras Pandan Wangi 5kg",
    price: 75000,
    code: "KOD-001",
    category: "Semua Produk",
  },
  {
    id: 2,
    name: "Minyak Goreng Sawit 2L",
    price: 34000,
    code: "KOD-002",
    category: "Semua Produk",
  },
  {
    id: 3,
    name: "Gula Pasir Putih 1kg",
    price: 17500,
    code: "KOD-003",
    category: "Semua Produk",
  },
  {
    id: 4,
    name: "Kopi Bubuk Robusta 250g",
    price: 25000,
    code: "KOD-004",
    category: "Semua Produk",
  },
  {
    id: 5,
    name: "Teh Celup Kotak 25s",
    price: 8500,
    code: "KOD-005",
    category: "Semua Produk",
  },
  {
    id: 6,
    name: "Susu UHT Cokelat 1L",
    price: 21000,
    code: "KOD-006",
    category: "Semua Produk",
  },
];

const tabs = ["Semua Produk", "Bahan Pokok", "Minuman & Kopi", "Susu"];

function App() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Semua Produk");
  const [cart, setCart] = useState([
    {
      id: 4,
      name: "Kopi Bubuk Robusta",
      code: "KOD-004",
      price: 25000,
      qty: 2,
    },
    { id: 3, name: "Gula Pasir Putih", code: "KOD-003", price: 17500, qty: 2 },
  ]);

  // Filter produk berdasarkan kata kunci dan tab aktif.
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesTab =
        activeTab === "Semua Produk" || product.category === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [search, activeTab]);

  // Tambah produk ke keranjang dan hindari duplikasi item.
  const addToCart = (product) => {
    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === product.id);

      if (existingItem) {
        return currentCart.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item,
        );
      }

      return [...currentCart, { ...product, qty: 1 }];
    });
  };

  // Ubah jumlah item di keranjang sesuai tombol + / -.
  const updateQty = (id, delta) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === id
            ? { ...item, qty: Math.max(0, item.qty + delta) }
            : item,
        )
        .filter((item) => item.qty > 0),
    );
  };

  // Hitung total belanja untuk panel summary.
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="pos-app">
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
            <span>Budi Santoso</span>
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
        <aside className="sidebar">
          <div className="side-section-title">MODUL KASIR</div>
          <nav className="nav-list">
            <button type="button" className="nav-item active">
              <span className="nav-icon">◫</span>
              Point of Sale / Kasir
            </button>
            <button type="button" className="nav-item">
              <span className="nav-icon">▣</span>
              Transaksi Aktif
            </button>
            <button type="button" className="nav-item">
              <span className="nav-icon">◌</span>
              Riwayat Kasir
            </button>
          </nav>

          <div className="terminal-box">
            <div className="terminal-title">Terminal #01</div>
            <div className="terminal-sub">V2.4.0 ERP POS Desktop</div>
          </div>
        </aside>

        <main className="main-panel">
          <section className="catalog-panel">
            {/* Search bar utama untuk mencari produk berdasarkan nama. */}
            <div className="search-box">
              <span className="search-icon">⌕</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama atau kode produk..."
              />
            </div>

            {/* Tab kategori memudahkan memfilter produk sesuai kelompok. */}
            <div className="category-row">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={tab === activeTab ? "tab active" : "tab"}
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

            {/* Produk ditampilkan sebagai kartu yang bisa ditambah ke keranjang. */}
            <div className="product-list">
              {filteredProducts.length > 0 ? (
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

            {/* Panel keranjang menampilkan item aktif yang dipilih user. */}
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
                          onClick={() => updateQty(item.id, -1)}
                        >
                          -
                        </button>
                        <span>{item.qty}</span>
                        <button
                          type="button"
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
                <div className="amount">Rp {total.toLocaleString("id-ID")}</div>
                <div className="tax-note">Sudah termasuk PPN 11%</div>
              </div>

              <button type="button" className="checkout-button">
                Lanjut ke pembayaran →
              </button>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;
