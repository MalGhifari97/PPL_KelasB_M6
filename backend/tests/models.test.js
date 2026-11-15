const test = require('node:test');
const assert = require('node:assert/strict');

const Product = require('../models/Product');
const CartItem = require('../models/CartItem');

const beras = {
  id: '1',
  code: 'KLT001',
  name: 'Beras Premium 5 kg',
  category: 'Sembako',
  product_type: 'retail',
  is_cafe_menu: false,
  price: '68000.00',
  stock: '25',
  expired_date: null,
  is_active: true
};

test('Product.toJSON mengubah price dan stock menjadi angka', () => {
  const product = new Product(beras);
  const json = product.toJSON();

  assert.equal(json.price, 68000);
  assert.equal(typeof json.price, 'number');
  assert.equal(json.stock, 25);
  assert.equal(json.id, 1);
});

test('Product tidak lagi membawa kolom unit yang sudah dihapus dari skema', () => {
  const product = new Product(beras);

  assert.equal('unit' in product, false);
  assert.equal('unit' in product.toJSON(), false);
});

test('CartItem.toJSON menyertakan subtotal (AC-01 M6-US1)', () => {
  const item = new CartItem(new Product(beras), 2);
  const json = item.toJSON();

  assert.equal(json.subtotal, 136000);
  assert.equal(typeof json.subtotal, 'number');
  assert.equal(json.unit_price, 68000);
  assert.equal(json.quantity, 2);
  assert.equal(json.product.name, 'Beras Premium 5 kg');
});

test('subtotal tetap muncul setelah serialisasi JSON seperti res.json()', () => {
  const item = new CartItem(new Product(beras), 1);
  const serialized = JSON.parse(JSON.stringify(item));

  assert.equal(serialized.subtotal, 68000);
  assert.equal(serialized.quantity, 1);
});

test('CartItem memakai subtotal generated column bila tersedia', () => {
  const item = new CartItem(new Product(beras), 2, { subtotal: '136000.00' });

  assert.equal(item.subtotal, 136000);
});

test('CartItem menghitung ulang subtotal saat kuantitas berubah (AC-02 M6-US1)', () => {
  const product = new Product(beras);
  const awal = new CartItem(product, 1);
  const diubah = new CartItem(product, 3);

  assert.equal(awal.subtotal, 68000);
  assert.equal(diubah.subtotal, 204000);
});
