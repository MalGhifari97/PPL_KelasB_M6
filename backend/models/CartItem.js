const Product = require('./Product');

class CartItem {
  constructor(product, quantity = 1) {
    this.product = product instanceof Product ? product : new Product(product);
    this.product_id = this.product.id;
    this.quantity = quantity;
    this.unit_price = this.product.price;
  }

  get subtotal() {
    return Number(this.unit_price) * this.quantity;
  }
}

module.exports = CartItem;