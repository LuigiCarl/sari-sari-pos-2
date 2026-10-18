const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/db');
const { setFlash } = require('../middleware/flash');

async function dashboard(req, res, next) {
  try {
    const [todayTotal, weekTotal, monthTotal, trend, topProducts, lowStock, recentSales] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
         FROM sales WHERE created_at::date = CURRENT_DATE`
      ).then((r) => r.rows[0]),
      query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
         FROM sales WHERE created_at >= NOW() - INTERVAL '6 days'`
      ).then((r) => r.rows[0]),
      query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
         FROM sales WHERE to_char(created_at, 'YYYY-MM') = to_char(NOW(), 'YYYY-MM')`
      ).then((r) => r.rows[0]),
      query(
        `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COALESCE(SUM(total_amount), 0) AS total
         FROM sales
         WHERE created_at >= NOW() - INTERVAL '6 days'
         GROUP BY day
         ORDER BY day`
      ).then((r) => r.rows),
      query(
        `SELECT sale_items.product_name, SUM(sale_items.quantity) AS units_sold, SUM(sale_items.subtotal) AS revenue
         FROM sale_items
         JOIN sales ON sales.id = sale_items.sale_id
         WHERE sales.created_at >= NOW() - INTERVAL '29 days'
         GROUP BY sale_items.product_id, sale_items.product_name
         ORDER BY revenue DESC
         LIMIT 5`
      ).then((r) => r.rows),
      query(
        `SELECT name, stock_quantity, reorder_level, unit FROM products
         WHERE active = TRUE AND stock_quantity <= reorder_level ORDER BY stock_quantity ASC`
      ).then((r) => r.rows),
      query(
        `SELECT sales.id, receipt_no, total_amount, sales.created_at, users.full_name AS cashier
         FROM sales JOIN users ON users.id = sales.user_id
         ORDER BY sales.created_at DESC LIMIT 8`
      ).then((r) => r.rows),
    ]);

    // Fill in missing days with zero so the trend chart has a full 7-day axis.
    const trendByDay = Object.fromEntries(trend.map((r) => [r.day, r.total]));
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trendData.push({ day: key, total: trendByDay[key] || 0 });
    }

    res.render('admin/dashboard', {
      title: 'Dashboard',
      todayTotal,
      weekTotal,
      monthTotal,
      trendData,
      topProducts,
      lowStock,
      recentSales,
    });
  } catch (err) {
    next(err);
  }
}

// ---- Products ----

async function listProducts(req, res, next) {
  try {
    const [products, categories] = await Promise.all([
      query(
        `SELECT products.*, categories.name AS category_name
         FROM products LEFT JOIN categories ON categories.id = products.category_id
         ORDER BY products.active DESC, products.name ASC`
      ).then((r) => r.rows),
      query('SELECT * FROM categories ORDER BY name').then((r) => r.rows),
    ]);
    res.render('admin/products', { title: 'Products', products, categories });
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  const { name, barcode, category_id, unit, cost_price, selling_price, stock_quantity, reorder_level } = req.body;
  try {
    await query(
      `INSERT INTO products (name, barcode, category_id, unit, cost_price, selling_price, stock_quantity, reorder_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        name,
        barcode || null,
        category_id || null,
        unit || 'pc',
        Number(cost_price) || 0,
        Number(selling_price) || 0,
        Number(stock_quantity) || 0,
        Number(reorder_level) || 5,
      ]
    );
    setFlash(req, 'success', `Product "${name}" added.`);
    res.redirect('/admin/products');
  } catch (err) {
    setFlash(req, 'error', `Could not add product: ${err.message}`);
    res.redirect('/admin/products');
  }
}

async function updateProduct(req, res, next) {
  const { id } = req.params;
  const { name, barcode, category_id, unit, cost_price, selling_price, stock_quantity, reorder_level, active } = req.body;
  try {
    await query(
      `UPDATE products SET name = $1, barcode = $2, category_id = $3, unit = $4, cost_price = $5, selling_price = $6,
       stock_quantity = $7, reorder_level = $8, active = $9, updated_at = NOW()
       WHERE id = $10`,
      [
        name,
        barcode || null,
        category_id || null,
        unit || 'pc',
        Number(cost_price) || 0,
        Number(selling_price) || 0,
        Number(stock_quantity) || 0,
        Number(reorder_level) || 5,
        Boolean(active),
        id,
      ]
    );
    setFlash(req, 'success', `Product "${name}" updated.`);
    res.redirect('/admin/products');
  } catch (err) {
    setFlash(req, 'error', `Could not update product: ${err.message}`);
    res.redirect('/admin/products');
  }
}

async function createCategory(req, res, next) {
  const { name } = req.body;
  try {
    if (name && name.trim()) {
      await query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name.trim()]);
    }
    res.redirect('/admin/products');
  } catch (err) {
    next(err);
  }
}

// ---- Users ----

async function listUsers(req, res, next) {
  try {
    const { rows: users } = await query(
      'SELECT id, username, full_name, role, active, created_at FROM users ORDER BY role, username'
    );
    res.render('admin/users', { title: 'Users', users });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = req.body.role === 'admin' ? 'admin' : 'sales_rep';

  try {
    if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username)) {
      setFlash(req, 'error', 'Username must be 3-50 characters and use only letters, numbers, dots, underscores, or hyphens.');
      return res.redirect('/admin/users');
    }
    if (!fullName || fullName.length > 100) {
      setFlash(req, 'error', 'Full name is required and must be 100 characters or fewer.');
      return res.redirect('/admin/users');
    }
    if (password.length < 6 || password.length > 72) {
      setFlash(req, 'error', 'Password must be between 6 and 72 characters.');
      return res.redirect('/admin/users');
    }

    const hash = bcrypt.hashSync(password, 10);
    await query('INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)', [
      username,
      hash,
      fullName,
      role,
    ]);
    setFlash(req, 'success', `User "${username}" created.`);
    res.redirect('/admin/users');
  } catch (err) {
    setFlash(
      req,
      'error',
      err.code === '23505' ? 'That username is already taken.' : 'Could not create the user. Please try again.'
    );
    res.redirect('/admin/users');
  }
}

async function toggleUserActive(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).render('error', { title: 'Bad Request', message: 'Invalid user ID.' });
  }

  if (id === req.session.user.id) {
    setFlash(req, 'error', 'You cannot deactivate your own account.');
    return res.redirect('/admin/users');
  }

  let client;
  let transactionStarted = false;
  try {
    client = await getClient();
    await client.query('BEGIN');
    transactionStarted = true;
    // Serialize admin status changes so two concurrent requests cannot both
    // deactivate what each believes is a non-final active administrator.
    await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');

    const { rows } = await client.query('SELECT id, username, role, active FROM users WHERE id = $1', [id]);
    const target = rows[0];
    if (!target) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).render('error', { title: 'Not Found', message: 'User not found.' });
    }

    if (target.active && target.role === 'admin') {
      const { rows: countRows } = await client.query(
        "SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND active = TRUE"
      );
      if (countRows[0].count <= 1) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        setFlash(req, 'error', 'The last active admin cannot be deactivated.');
        return res.redirect('/admin/users');
      }
    }

    await client.query('UPDATE users SET active = NOT active WHERE id = $1', [id]);
    await client.query('COMMIT');
    transactionStarted = false;
    setFlash(req, 'success', `User "${target.username}" ${target.active ? 'deactivated' : 'activated'}.`);
    res.redirect('/admin/users');
  } catch (err) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Failed to roll back user status update:', rollbackErr);
      }
    }
    next(err);
  } finally {
    if (client) client.release();
  }
}

// ---- Sales ----

async function listSales(req, res, next) {
  const { from, to } = req.query;
  try {
    let text = `SELECT sales.id, receipt_no, total_amount, amount_paid, change_amount, sales.created_at, users.full_name AS cashier
                FROM sales JOIN users ON users.id = sales.user_id`;
    const conditions = [];
    const params = [];
    if (from) {
      params.push(from);
      conditions.push(`sales.created_at::date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      conditions.push(`sales.created_at::date <= $${params.length}::date`);
    }
    if (conditions.length) text += ' WHERE ' + conditions.join(' AND ');
    text += ' ORDER BY sales.created_at DESC LIMIT 200';

    const { rows: sales } = await query(text, params);
    res.render('admin/sales', { title: 'Sales', sales, from: from || '', to: to || '' });
  } catch (err) {
    next(err);
  }
}

async function viewSale(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT sales.*, users.full_name AS cashier FROM sales JOIN users ON users.id = sales.user_id WHERE sales.id = $1`,
      [req.params.id]
    );
    const sale = rows[0];
    if (!sale) return res.status(404).render('error', { title: 'Not Found', message: 'Sale not found.' });
    const { rows: items } = await query('SELECT * FROM sale_items WHERE sale_id = $1', [sale.id]);
    res.render('admin/sale_detail', { title: 'Sale Detail', sale, items });
  } catch (err) {
    next(err);
  }
}

// ---- Inventory reports (submitted by sales reps) ----

async function listInventoryReports(req, res, next) {
  try {
    const { rows: reports } = await query(
      `SELECT inventory_reports.*, products.name AS product_name, users.full_name AS reported_by
       FROM inventory_reports
       JOIN products ON products.id = inventory_reports.product_id
       JOIN users ON users.id = inventory_reports.user_id
       ORDER BY inventory_reports.created_at DESC LIMIT 200`
    );
    res.render('admin/inventory_reports', { title: 'Inventory Reports', reports });
  } catch (err) {
    next(err);
  }
}

// ---- JSON API for dashboard chart ----

async function salesChartData(req, res, next) {
  try {
    const days = Math.min(Number(req.query.days) || 7, 90);
    const { rows } = await query(
      `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COALESCE(SUM(total_amount), 0) AS total
       FROM sales
       WHERE created_at >= NOW() - ($1::text || ' days')::interval
       GROUP BY day ORDER BY day`,
      [String(days - 1)]
    );
    const byDay = Object.fromEntries(rows.map((r) => [r.day, r.total]));
    const labels = [];
    const totals = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      labels.push(key);
      totals.push(byDay[key] || 0);
    }
    res.json({ labels, totals });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboard,
  listProducts,
  createProduct,
  updateProduct,
  createCategory,
  listUsers,
  createUser,
  toggleUserActive,
  listSales,
  viewSale,
  listInventoryReports,
  salesChartData,
};
