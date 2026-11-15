-- =============================================================================
-- Skema database M6 (POS/Kasir) - PostgreSQL / Supabase
-- Status: SUDAH DITERAPKAN pada project Supabase (ref: mopswiuveqmlftbffjoe).
-- File ini disimpan sebagai dokumentasi versi skema di repository.
-- =============================================================================

-- Tabel Produk (Barang Kelontong & Menu Cafe)
CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(80) NOT NULL,
    product_type VARCHAR(10) NOT NULL DEFAULT 'retail' CHECK (product_type IN ('retail', 'cafe', 'both')),
    is_cafe_menu BOOLEAN NOT NULL DEFAULT FALSE,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    expired_date DATE NULL, -- Tambahan untuk produk kelontong
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabel Transaksi (Header)
CREATE TABLE transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transaction_number VARCHAR(40) NOT NULL UNIQUE,
    cashier_name VARCHAR(100) NOT NULL,
    order_type VARCHAR(10) NOT NULL DEFAULT 'retail' CHECK (order_type IN ('retail', 'dine_in', 'take_away')),
    table_number VARCHAR(10) NULL, -- Hanya untuk Cafe
    payment_timing VARCHAR(10) NOT NULL CHECK (payment_timing IN ('upfront', 'end')),
    payment_status VARCHAR(10) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'cancelled')),
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ NULL
);

-- Tabel Item Transaksi (Detail Keranjang)
CREATE TABLE transaction_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    note VARCHAR(200) NULL, -- Contoh: "Less Sugar", "Pedas"
    subtotal NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- Tabel Pembayaran
CREATE TABLE payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    method VARCHAR(10) NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'qris', 'debit', 'transfer')),
    amount_received NUMERIC(12,2) NOT NULL CHECK (amount_received >= 0),
    change_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reference_number VARCHAR(100) NULL
);

CREATE OR REPLACE VIEW v_transaction_summary
WITH (security_invoker = true) AS
SELECT
    t.id,
    t.transaction_number,
    t.cashier_name,
    t.order_type,
    t.table_number,
    t.payment_status,
    t.total,
    COALESCE(SUM(p.amount_received), 0) AS total_received,
    t.created_at
FROM transactions t
LEFT JOIN payments p ON p.transaction_id = t.id
GROUP BY t.id;

-- =============================================================================
-- Catatan implementasi backend
-- =============================================================================
-- 1. transaction_items.subtotal adalah GENERATED column: backend tidak pernah
--    meng-INSERT kolom ini, hanya membacanya.
-- 2. transactions.order_type/table_number wajib divalidasi di backend karena
--    CHECK constraint akan melempar error 500 bila menerima nilai tidak valid.
-- 3. Tabel payments menyimpan amount_received & change_amount sebagai bukti
--    pembayaran tunai (M6-US2).
-- 4. Hapus transaksi akan meng-cascade transaction_items dan payments.
