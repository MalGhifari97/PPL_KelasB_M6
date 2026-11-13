const test = require('node:test');
const assert = require('node:assert/strict');

const { ERROR_CODES, createServiceError } = require('../utils/dbTransaction');
const { calculateChange } = require('../services/paymentService');

// SCRUM-52: kekurangan pembayaran harus membawa kode INSUFFICIENT_PAYMENT
// pada format error API. Test di bawah tidak membutuhkan koneksi database.

const paymentServicePath = require.resolve('../services/paymentService');
const controllerPath = require.resolve('../controllers/transactionController');

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

// Mengganti payCash pada module cache sebelum controller dimuat, sehingga
// mapping error di controller dapat diuji tanpa database.
async function withStubbedPayCash(payCashStub, run) {
  const serviceModule = require.cache[paymentServicePath];
  const realExports = serviceModule.exports;

  serviceModule.exports = { payCash: payCashStub };
  delete require.cache[controllerPath];

  try {
    return await run(require(controllerPath));
  } finally {
    serviceModule.exports = realExports;
    delete require.cache[controllerPath];
  }
}

function isInsufficientPaymentError(error) {
  return (
    error.statusCode === 400 &&
    error.errorCode === ERROR_CODES.INSUFFICIENT_PAYMENT &&
    /kurang dari total tagihan/.test(error.message)
  );
}

test('SCRUM-52: createServiceError menyimpan errorCode tanpa menimpa error.code milik pg', () => {
  const error = createServiceError('contoh', 400, ERROR_CODES.INSUFFICIENT_PAYMENT);

  assert.equal(error.statusCode, 400);
  assert.equal(error.errorCode, 'INSUFFICIENT_PAYMENT');
  assert.equal(error.code, undefined);
});

test('SCRUM-52: createServiceError tanpa errorCode tetap null (kompatibel dengan pemanggil lama)', () => {
  const error = createServiceError('Produk tidak ditemukan', 404);

  assert.equal(error.statusCode, 404);
  assert.equal(error.errorCode, null);
});

test('SCRUM-52: kode error INSUFFICIENT_PAYMENT bernilai stabil dan tidak dapat diubah', () => {
  assert.equal(ERROR_CODES.INSUFFICIENT_PAYMENT, 'INSUFFICIENT_PAYMENT');
  assert.equal(Object.isFrozen(ERROR_CODES), true);
});

test('SCRUM-52: total 85.000 dibayar 84.000 melempar INSUFFICIENT_PAYMENT', () => {
  assert.throws(() => calculateChange(85000, 84000), isInsufficientPaymentError);
});

test('SCRUM-52: kekurangan satu sen pun tetap INSUFFICIENT_PAYMENT', () => {
  assert.throws(() => calculateChange(85000, 84999.99), isInsufficientPaymentError);
});

test('SCRUM-52: nominal berbentuk string tetap divalidasi sebagai kekurangan bayar', () => {
  assert.throws(() => calculateChange('85000.00', '84000'), isInsufficientPaymentError);
});

test('SCRUM-52: pesan error menyebutkan total tagihan dan uang diterima', () => {
  assert.throws(
    () => calculateChange(85000, 84000),
    (error) =>
      error.message === 'Uang tunai kurang dari total tagihan (total Rp85000, diterima Rp84000)'
  );
});

test('SCRUM-52: pembayaran cukup tetap tidak menghasilkan kode error (AC-01 & AC-02 M6-US2)', () => {
  assert.equal(calculateChange(85000, 100000), 15000);
  assert.equal(calculateChange(85000, 85000), 0);
});

test('SCRUM-52: controller mengirim code INSUFFICIENT_PAYMENT pada response 400', async () => {
  const serviceError = createServiceError(
    'Uang tunai kurang dari total tagihan (total Rp85000, diterima Rp84000)',
    400,
    ERROR_CODES.INSUFFICIENT_PAYMENT
  );

  await withStubbedPayCash(
    async () => {
      throw serviceError;
    },
    async (controller) => {
      const req = { body: { transaction_id: 12, cash_received: 84000 }, params: {} };
      const res = createResponseMock();

      await controller.processCashPayment(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'INSUFFICIENT_PAYMENT');
      assert.equal(res.body.message, serviceError.message);
      assert.equal(res.body.data, null);
    }
  );
});

test('SCRUM-52: error bisnis lain di luar kekurangan bayar memakai code null', async () => {
  await withStubbedPayCash(
    async () => {
      throw createServiceError('Transaksi sudah lunas', 409);
    },
    async (controller) => {
      const req = { body: { transaction_id: 12, cash_received: 100000 }, params: {} };
      const res = createResponseMock();

      await controller.processCashPayment(req, res);

      assert.equal(res.statusCode, 409);
      assert.equal(res.body.code, null);
      assert.equal(res.body.message, 'Transaksi sudah lunas');
    }
  );
});

test('SCRUM-52: kesalahan server tidak membocorkan pesan internal dan code null', async () => {
  await withStubbedPayCash(
    async () => {
      throw new Error('koneksi database terputus');
    },
    async (controller) => {
      const req = { body: { transaction_id: 12, cash_received: 100000 }, params: {} };
      const res = createResponseMock();

      await controller.processCashPayment(req, res);

      assert.equal(res.statusCode, 500);
      assert.equal(res.body.code, null);
      assert.equal(res.body.message, 'Gagal memproses pembayaran');
    }
  );
});

test('SCRUM-52: response sukses tidak menambahkan field code', async () => {
  await withStubbedPayCash(
    async () => ({ transaction: { payment_status: 'paid' }, payment: { change_amount: 15000 }, items: [] }),
    async (controller) => {
      const req = { body: { transaction_id: 12, cash_received: 100000 }, params: {} };
      const res = createResponseMock();

      await controller.processCashPayment(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal('code' in res.body, false);
      assert.equal(res.body.data.payment.change_amount, 15000);
    }
  );
});
