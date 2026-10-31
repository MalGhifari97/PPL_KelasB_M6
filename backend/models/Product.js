class Product {
  constructor({ id, code, name, category, unit, price, stock, is_active }) {
    this.id = id;
    this.code = code;
    this.name = name;
    this.category = category;
    this.unit = unit;
    this.price = price;
    this.stock = stock;
    this.is_active = is_active;
  }
}

module.exports = Product;