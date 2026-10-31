const Product = require('./Product');

class CartItem {
  constructor(product, quantity = 1, options = {}) {
    this.product = product instanceof Product ? product : new Product(product);
    this.id = options.id ?? null;
    this.transaction_id = options.transaction_id ?? null;
    this.product_id = options.product_id ?? this.product.id;
    this.quantity = quantity;
    this.unit_price = options.unit_price ?? this.product.price;
  }

  get subtotal() {
    return Number(this.unit_price) * this.quantity;
  }
}

module.exports = CartItem;