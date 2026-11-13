function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toId(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

class Product {
  constructor({
    id,
    code,
    name,
    category,
    product_type,
    is_cafe_menu,
    price,
    stock,
    expired_date,
    is_active,
    created_at
  }) {
    this.id = toId(id);
    this.code = code;
    this.name = name;
    this.category = category;
    this.product_type = product_type ?? 'retail';
    this.is_cafe_menu = Boolean(is_cafe_menu);
    this.price = toNumber(price);
    this.stock = toNumber(stock);
    this.expired_date = expired_date ?? null;
    this.is_active = Boolean(is_active);
    this.created_at = created_at ?? null;
  }

  // Dipertahankan sebagai objek plain agar price/stock selalu numerik di response JSON.
  toJSON() {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      category: this.category,
      product_type: this.product_type,
      is_cafe_menu: this.is_cafe_menu,
      price: this.price,
      stock: this.stock,
      expired_date: this.expired_date,
      is_active: this.is_active,
      created_at: this.created_at
    };
  }
}

module.exports = Product;
