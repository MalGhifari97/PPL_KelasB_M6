const test = require('node:test');
const assert = require('node:assert/strict');

// SCRUM-52: memastikan kode INSUFFICIENT_PAYMENT tetap terbawa melewati
// payCash -> withTransaction (rollback) dan tidak ada pembayaran tersimpan.
// Database diganti pool palsu sehingga test berjalan tanpa koneksi.

const dbPath = require.resolve('../config/db');
const dbTransactionPath = require.resolve('../utils/dbTransaction');
const cartServicePath = require.resolve('../services/cartService');
const paymentServicePath = require.resolve('../services/paymentService');

function createFakePool(transactionRow) {
  const executed = [];
  const state = { released: false };

  const client = {
    async query(sql, params) {
      const statement = sql.trim().split('\n')[0].trim().toUpperCase();
      const fullStatement = sql.trim().replace(/\s+/g, ' ').toUpperCase();
      executed.push({ statement, fullStatement, params });

      // Query header transaksi memakai FOR UPDATE dan FROM pada baris berikutnya.
      if (/^SELECT\b/.test(fullStatement) && /FROM TRANSACTIONS\b/.test(fullStatement)) {
        return { rows: [transactionRow] };
      }
      if (/COUNT\(\*\)/.test(fullStatement)) {
        return { rows: [{ item_count: 2 }] };
      }
      if (/^INSERT INTO PAYMENTS/.test(fullStatement)) {
        return {
          rows: [
            {
              id: 99,
              method: 'cash',
              amount_received: params[1],
              change_amount: params[2],
              confirmed_at: new Date('2026-11-13T10:00:00.000Z'),
              reference_number: params[3]
            }
          ]
        };
      }
      return { rows: [] };
    },
    release() {
      state.released = true;
    }
  };

  return {
    pool: { connect: async () => client, query: async () => ({ rows: [] }), end: async () => {} },
    executed,
    state
  };
}

async function runPayCash(transactionRow, nominal) {
  const fake = createFakePool(transactionRow);

  // dbTransaction.js menyimpan referensi pool saat pertama kali dimuat, jadi
  // module itu ikut dihapus agar setiap skenario memakai pool palsu yang baru.
  const modulePaths = [dbPath, dbTransactionPath, cartServicePath, paymentServicePath];
  const previousModules = modulePaths.map((modulePath) => [modulePath, require.cache[modulePath]]);

  const restoreModules = () => {
    for (const [modulePath, cachedModule] of previousModules) {
      if (cachedModule) require.cache[modulePath] = cachedModule;
      else delete require.cache[modulePath];
    }
  };

  for (const modulePath of modulePaths) delete require.cache[modulePath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: fake.pool
  };

  try {
    const { payCash } = require(paymentServicePath);
    const result = { settled: null, failed: null };

    try {
      result.settled = await payCash(7, nominal);
    } catch (error) {
      result.failed = error;
    }

    return { ...result, executed: fake.executed, released: fake.state.released };
  } finally {
    restoreModules();
  }
}

const unpaidTransaction = {
  id: 7,
  transaction_number: 'TRX-TEST-1',
  payment_status: 'unpaid',
  subtotal: '85000.00',
  discount_amount: '0.00',
  total: '85000.00'
};

test('SCRUM-52: payCash meneruskan INSUFFICIENT_PAYMENT dari calculateChange', async () => {
  const result = await runPayCash(unpaidTransaction, 84000);

  assert.equal(result.settled, null);
  assert.equal(result.failed.statusCode, 400);
  assert.equal(result.failed.errorCode, 'INSUFFICIENT_PAYMENT');
  assert.match(result.failed.message, /total Rp85000, diterima Rp84000/);
});

test('SCRUM-52: pembayaran kurang tidak menyimpan baris payments dan di-rollback', async () => {
  const result = await runPayCash(unpaidTransaction, 84000);
  const statements = result.executed.map((entry) => entry.statement);

  assert.equal(
    statements.some((statement) => statement.startsWith('INSERT INTO PAYMENTS')),
    false
  );
  assert.equal(
    statements.some((statement) => statement.startsWith("UPDATE TRANSACTIONS")),
    false
  );
  assert.equal(statements.includes('ROLLBACK'), true);
  assert.equal(result.released, true);
});

test('SCRUM-52: nominal kurang dari total pada transaksi 85000 selalu berkode sama', async () => {
  for (const nominal of [0, 1, 84999, '84999.99']) {
    const result = await runPayCash(unpaidTransaction, nominal);

    assert.equal(
      result.failed?.errorCode,
      'INSUFFICIENT_PAYMENT',
      `nominal ${String(nominal)} seharusnya INSUFFICIENT_PAYMENT`
    );
  }
});

test('SCRUM-52: uang pas tetap tercatat sebagai cash dengan kembalian 0', async () => {
  const result = await runPayCash(unpaidTransaction, 85000);
  const insertPayment = result.executed.find((entry) =>
    entry.statement.startsWith('INSERT INTO PAYMENTS')
  );

  assert.equal(result.failed, null);
  assert.ok(insertPayment, 'INSERT INTO payments seharusnya dijalankan');
  assert.equal(insertPayment.params[1], 85000);
  assert.equal(insertPayment.params[2], 0);
});
