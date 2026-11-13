const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateChange } = require('../services/paymentService');
const transactionController = require('../controllers/transactionController');

function createResponseMock() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('AC-01 M6-US2: total 85.000 dibayar 100.000 menghasilkan kembalian 15.000', () => {
  assert.equal(calculateChange(85000, 100000), 15000);
});

test('AC-02 M6-US2: total 85.000 dibayar 85.000 menghasilkan kembalian 0', () => {
  assert.equal(calculateChange(85000, 85000), 0);
});

test('pembayaran kurang dari total ditolak dengan status 400 dan kode INSUFFICIENT_PAYMENT', () => {
  assert.throws(
    () => calculateChange(85000, 84000),
    (error) =>
      error.statusCode === 400 &&
      error.errorCode === 'INSUFFICIENT_PAYMENT' &&
      /kurang dari total tagihan/.test(error.message)
  );
});

test('kembalian dihitung dengan pembulatan dua desimal', () => {
  assert.equal(calculateChange('85000.50', 100000), 14999.5);
  assert.equal(calculateChange(85000, '100000'), 15000);
});

test('controller menolak transaction_id yang tidak valid', async () => {
  const req = { body: { transaction_id: 'abc', cash_received: 100000 }, params: {} };
  const res = createResponseMock();

  await transactionController.processCashPayment(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, 'transaction_id harus berupa ID positif');
});

test('controller menolak cash_received yang bukan angka', async () => {
  const req = { body: { transaction_id: 1, cash_received: 'seratus ribu' }, params: {} };
  const res = createResponseMock();

  await transactionController.processCashPayment(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, 'cash_received harus berupa angka minimal 0');
});

test('controller menolak cash_received negatif', async () => {
  const req = { body: { transaction_id: 1, cash_received: -1 }, params: {} };
  const res = createResponseMock();

  await transactionController.processCashPayment(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'cash_received harus berupa angka minimal 0');
});
