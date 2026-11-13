// Uji end-to-end M6-US1 & M6-US2 terhadap database Supabase sungguhan.
// Jalankan dengan: npm run test:e2e
// Data uji tidak dihapus kecuali variabel E2E_CLEANUP=true.
const { once } = require('node:events');
const app = require('../index');
const pool = require('../backend/config/db');

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
    return;
  }
  failures.push(`${name}${detail ? ` -> ${detail}` : ''}`);
  console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
}

async function main() {
  const server = app.listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const createdTransactionIds = [];

  const api = async (method, path, body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await response.json().catch(() => null);
    return { status: response.status, body: json };
  };

  const findProduct = async (code) => {
    const result = await api('GET', `/api/products?search=${encodeURIComponent(code)}`);
    return result.body?.data?.[0] ?? null;
  };

  try {
    console.log('\n[M6-US1 AC-01] Cari produk & tambah ke keranjang');
    const beras = await findProduct('KLT001');
    const gula = await findProduct('KLT003');
    const air = await findProduct('MNM001');

    check('produk KLT001 ditemukan dengan harga numerik 68000', beras?.price === 68000, JSON.stringify(beras));
    check('produk KLT003 ditemukan dengan harga numerik 17000', gula?.price === 17000);
    check('id produk bertipe angka, bukan string', typeof beras?.id === 'number');

    console.log('\n[M6-US1 AC-03] Produk tidak ditemukan');
    const notFound = await api('GET', '/api/products?search=zzz-tidak-ada-999');
    check('status 404', notFound.status === 404);
    check('pesan "Produk tidak ditemukan"', notFound.body?.message === 'Produk tidak ditemukan');
    check('data kosong', Array.isArray(notFound.body?.data) && notFound.body.data.length === 0);

    const draft = await api('POST', '/api/transactions', {
      cashier_name: 'Kasir Uji E2E',
      payment_timing: 'upfront'
    });
    check(
      'draft transaksi dibuat (201, unpaid)',
      draft.status === 201 && draft.body?.data?.payment_status === 'unpaid'
    );
    const trxId = draft.body?.data?.id;
    createdTransactionIds.push(trxId);

    const afterAdd = await api('POST', `/api/transactions/${trxId}/items`, { product_id: beras.id });
    const firstItem = afterAdd.body?.data?.items?.[0];
    check('kuantitas awal satu unit', firstItem?.quantity === 1);
    check('nama produk tampil', firstItem?.product?.name === beras.name);
    check('harga satuan tampil', firstItem?.unit_price === 68000);
    check('subtotal tampil dan bernilai 68000', firstItem?.subtotal === 68000, String(firstItem?.subtotal));

    console.log('\n[M6-US1 AC-02] Ubah kuantitas & hapus item');
    const withGula = await api('POST', `/api/transactions/${trxId}/items`, { product_id: gula.id });
    check('total transaksi 85000', withGula.body?.data?.total === 85000, String(withGula.body?.data?.total));

    const itemId = withGula.body.data.items[0].id;
    const qty2 = await api('PATCH', `/api/transactions/${trxId}/items/${itemId}`, { quantity: 2 });
    check('subtotal item dihitung ulang jadi 136000', qty2.body?.data?.items?.[0]?.subtotal === 136000);
    check('total dihitung ulang jadi 153000', qty2.body?.data?.total === 153000);

    const qty1 = await api('PATCH', `/api/transactions/${trxId}/items/${itemId}`, { quantity: 1 });
    check('total kembali 85000', qty1.body?.data?.total === 85000);

    const withAir = await api('POST', `/api/transactions/${trxId}/items`, { product_id: air.id });
    check('total bertambah sesuai harga produk baru', withAir.body?.data?.total === 85000 + air.price);

    const airItem = withAir.body.data.items.find((item) => item.product_id === air.id);
    const afterDelete = await api('DELETE', `/api/transactions/${trxId}/items/${airItem.id}`);
    check('item terhapus', afterDelete.body?.data?.items?.length === 2);
    check('total dihitung ulang setelah hapus', afterDelete.body?.data?.total === 85000);

    console.log('\n[M6-US2 AC-01] Pembayaran uang lebih');
    const pay = await api('POST', '/api/transactions/pay/cash', {
      transaction_id: trxId,
      cash_received: 100000
    });
    check('status 200', pay.status === 200, JSON.stringify(pay.body));
    check(
      'kembalian 15000',
      pay.body?.data?.payment?.change_amount === 15000,
      String(pay.body?.data?.payment?.change_amount)
    );
    check('metode pembayaran cash', pay.body?.data?.payment?.method === 'cash');
    check('uang diterima tercatat 100000', pay.body?.data?.payment?.amount_received === 100000);
    check('status transaksi menjadi paid', pay.body?.data?.transaction?.payment_status === 'paid');
    check('paid_at terisi', Boolean(pay.body?.data?.transaction?.paid_at));
    check('reference_number terisi', Boolean(pay.body?.data?.payment?.reference_number));

    const payAgain = await api('POST', '/api/transactions/pay/cash', {
      transaction_id: trxId,
      cash_received: 100000
    });
    check('pembayaran ganda ditolak 409', payAgain.status === 409, JSON.stringify(payAgain.body));

    console.log('\n[M6-US2 AC-02] Pembayaran uang pas');
    const draft2 = await api('POST', '/api/transactions', { cashier_name: 'Kasir Uji E2E' });
    const trx2 = draft2.body?.data?.id;
    createdTransactionIds.push(trx2);
    await api('POST', `/api/transactions/${trx2}/items`, { product_id: beras.id });
    const cart2 = await api('POST', `/api/transactions/${trx2}/items`, { product_id: gula.id });
    check('total transaksi kedua 85000', cart2.body?.data?.total === 85000);

    const pay2 = await api('POST', '/api/transactions/pay/cash', {
      transaction_id: trx2,
      cash_received: cart2.body.data.total
    });
    check(
      'kembalian 0',
      pay2.body?.data?.payment?.change_amount === 0,
      String(pay2.body?.data?.payment?.change_amount)
    );
    check('status transaksi kedua paid', pay2.body?.data?.transaction?.payment_status === 'paid');

    console.log('\n[Validasi tambahan] Uang kurang & view ringkasan');
    const draft3 = await api('POST', '/api/transactions', { cashier_name: 'Kasir Uji E2E' });
    const trx3 = draft3.body?.data?.id;
    createdTransactionIds.push(trx3);
    await api('POST', `/api/transactions/${trx3}/items`, { product_id: beras.id });

    const kurang = await api('POST', '/api/transactions/pay/cash', {
      transaction_id: trx3,
      cash_received: 50000
    });
    check('uang kurang ditolak 400', kurang.status === 400, JSON.stringify(kurang.body));
    check(
      'kode error INSUFFICIENT_PAYMENT',
      kurang.body?.code === 'INSUFFICIENT_PAYMENT',
      JSON.stringify(kurang.body)
    );

    const cart3 = await api('GET', `/api/transactions/${trx3}`);
    check('transaksi tetap unpaid setelah gagal bayar', cart3.body?.data?.payment_status === 'unpaid');

    const { rows } = await pool.query(
      'SELECT total_received, payment_status FROM v_transaction_summary WHERE id = $1',
      [trxId]
    );
    check('view v_transaction_summary total_received = 100000', Number(rows[0]?.total_received) === 100000);
    check('view v_transaction_summary payment_status = paid', rows[0]?.payment_status === 'paid');
  } finally {
    if (String(process.env.E2E_CLEANUP).toLowerCase() === 'true' && createdTransactionIds.length) {
      await pool.query('DELETE FROM transactions WHERE id = ANY($1::bigint[])', [createdTransactionIds]);
      console.log(`\nData uji dihapus: ${createdTransactionIds.join(', ')}`);
    } else if (createdTransactionIds.length) {
      console.log(`\nTransaksi uji tersimpan dengan id: ${createdTransactionIds.join(', ')}`);
    }

    server.close();
    await pool.end();
  }

  console.log(`\nHasil: ${passed} pass, ${failures.length} fail`);
  if (failures.length) {
    failures.forEach((failure) => console.log(` - ${failure}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('E2E gagal dijalankan:', error);
  process.exitCode = 1;
});
