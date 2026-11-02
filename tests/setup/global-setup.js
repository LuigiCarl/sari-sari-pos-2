require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('../../src/config/db');

module.exports = async function globalSetup() {
  console.log('[Test Setup] Preparing database for Playwright tests...');

  // 1. Ensure admin and cashier users
  const adminHash = bcrypt.hashSync('admin123', 10);
  const cashierHash = bcrypt.hashSync('cashier123', 10);

  await query(`
    INSERT INTO users (username, password_hash, full_name, role)
    VALUES 
      ('admin', $1, 'Store Owner', 'admin'),
      ('cashier1', $2, 'Juana Cruz', 'sales_rep')
    ON CONFLICT (username) DO NOTHING
  `, [adminHash, cashierHash]);

  const { rows: cashierRows } = await query('SELECT id FROM users WHERE username = $1', ['cashier1']);
  const cashierId = cashierRows[0]?.id;

  // 2. Ensure categories
  await query("INSERT INTO categories (name) VALUES ('Snacks'), ('Beverages') ON CONFLICT (name) DO NOTHING");
  const { rows: catRows } = await query("SELECT id FROM categories WHERE name = 'Snacks'");
  const catId = catRows[0]?.id;

  // 3. Ensure products (including one with low stock)
  await query(`
    INSERT INTO products (name, barcode, category_id, unit, cost_price, selling_price, stock_quantity, reorder_level)
    VALUES 
      ('Instant Noodles', '4800016641234', $1, 'pack', 8.00, 12.00, 50, 10),
      ('Low Stock Item', '4800016649999', $1, 'can', 10.00, 20.00, 2, 8)
    ON CONFLICT (barcode) DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity
  `, [catId]);

  // 4. Ensure at least one sale exists for sales history tests
  const { rows: existingSales } = await query('SELECT id FROM sales LIMIT 1');
  if (existingSales.length === 0 && cashierId) {
    const { rows: prodRows } = await query('SELECT id, name, selling_price FROM products LIMIT 1');
    const prod = prodRows[0];
    if (prod) {
      const saleRes = await query(`
        INSERT INTO sales (receipt_no, user_id, total_amount, amount_paid, change_amount)
        VALUES ('RCPT-TEST-001', $1, $2, 100.00, 100.00 - $2)
        RETURNING id
      `, [cashierId, prod.selling_price]);

      const saleId = saleRes.rows[0].id;
      await query(`
        INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity, subtotal)
        VALUES ($1, $2, $3, $4, 1, $4)
      `, [saleId, prod.id, prod.name, prod.selling_price]);
    }
  }

  console.log('[Test Setup] Database is ready for automated tests.');
  await pool.end();
};

