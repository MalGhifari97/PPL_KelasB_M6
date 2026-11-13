const test = require('node:test');
const assert = require('node:assert/strict');

const { payCash, processCashPayment, calculateChange } = require('../services/paymentService');

// Task 19 (SCRUM-51): kontrak service payCash(transaksiId, nominal).
// Test di bawah hanya menyentuh validasi argumen sehingga tidak butuh koneksi database.

test('Task 19: payCash diekspor sebagai fungsi dengan signature (transactionId, nominal)', () => {
  assert.equal(typeof payCash, 'function');
  assert.equal(payCash.length, 2);
});

test('Task 19: alias processCashPayment tetap tersedia untuk pemanggil lama', () => {
  assert.equal(typeof processCashPayment, 'function');
});

test('Task 19: payCash menolak transactionId tidak valid', async () => {
  for (const transactionId of ['abc', 0, -1, 1.5, null, undefined]) {
    await assert.rejects(
      () => payCash(transactionId, 100000),
      (error) =>
        error.statusCode === 400 && error.message === 'transactionId harus berupa ID positif',
      `transactionId ${String(transactionId)} seharusnya ditolak`
    );
  }
});

test('Task 19: payCash menolak nominal tidak valid', async () => {
  for (const nominal of ['seratus ribu', -1, Number.NaN, undefined]) {
    await assert.rejects(
      () => payCash(1, nominal),
      (error) => error.statusCode === 400 && error.message === 'nominal harus berupa angka minimal 0',
      `nominal ${String(nominal)} seharusnya ditolak`
    );
  }
});

test('Task 19: payCash menolak nominal kosong atau bukan angka', async () => {
  for (const nominal of ['', '   ', {}, []]) {
    await assert.rejects(
      () => payCash(1, nominal),
      (error) => error.statusCode === 400,
      `nominal ${JSON.stringify(nominal)} seharusnya ditolak`
    );
  }
});

test('Task 19: perhitungan kembalian tetap 15000 dan 0 sesuai AC M6-US2', () => {
  assert.equal(calculateChange(85000, 100000), 15000);
  assert.equal(calculateChange(85000, 85000), 0);
});
