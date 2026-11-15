const Product = require('./Product');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

class CartItem {
  constructor(product, quantity = 1, options = {}) {
    this.product = product instanceof Product ? product : new Product(product);
    this.id = options.id ?? null;
    this.transaction_id = options.transaction_id ?? null;
    this.product_id = options.product_id ?? this.product.id;
    this.quantity = toNumber(quantity, 1);
    this.unit_price = toNumber(options.unit_price ?? this.product.price);
    this.note = options.note ?? null;
    // Subtotal memakai nilai generated column dari database bila tersedia.
    this.subtotal = roundMoney(options.subtotal ?? this.unit_price * this.quantity);
  }

  // Getter pada prototype tidak ikut terserialisasi oleh res.json(), sehingga
  // subtotal wajib diekspos sebagai properti biasa lewat toJSON().
  toJSON() {
    return {
      id: this.id,
      transaction_id: this.transaction_id,
      product_id: this.product_id,
      quantity: this.quantity,
      unit_price: this.unit_price,
      subtotal: roundMoney(this.subtotal),
      note: this.note,
      product: this.product.toJSON ? this.product.toJSON() : this.product
    };
  }
}

module.exports = CartItem;
