const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = require('./db');
const { initDb } = require('./schema');

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'mahjong-pos-secret-jwt-key-2026';
const JWT_TTL = parseInt(process.env.JWT_TTL || '480', 10); // minutes

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
const publicDir = path.join(__dirname, 'backend', 'public');
app.use(express.static(publicDir));

// Serve storage if uploaded files exist
const storageDir = path.join(__dirname, 'backend', 'storage', 'app', 'public');
app.use('/storage', express.static(storageDir));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'playhub-pos', time: new Date().toISOString() });
});

// Helpers
const getAuthUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const [users] = await pool.query(
      `SELECT u.*, r.name as role_name, r.description as role_description 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ? AND u.status = 'active'`,
      [decoded.sub || decoded.id]
    );
    if (!users.length) return null;
    const user = users[0];
    return {
      id: user.id,
      role_id: user.role_id,
      name: user.name,
      username: user.username,
      status: user.status,
      role: {
        id: user.role_id,
        name: user.role_name,
        description: user.role_description
      }
    };
  } catch (e) {
    return null;
  }
};

const requireAuth = async (req, res, next) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }
  req.user = user;
  next();
};

const requireRole = (roles) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role.name)) {
      return res.status(403).json({ message: 'Anda tidak memiliki izin untuk aksi ini.' });
    }
    next();
  };
};

const logActivity = async (userId, action, moduleName, req, payload = null) => {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, module, ip_address, user_agent, payload, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId || null,
        action,
        moduleName,
        req.ip || '127.0.0.1',
        req.get('User-Agent') || null,
        payload ? JSON.stringify(payload) : null
      ]
    );
  } catch (e) {
    console.error('Failed to log activity:', e.message);
  }
};

const generateInvoice = async () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `INV-${y}${m}${d}-`;

  const [rows] = await pool.query(
    `SELECT invoice FROM transactions WHERE invoice LIKE ? ORDER BY invoice DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let seq = 1;
  if (rows.length > 0) {
    const last = rows[0].invoice;
    seq = parseInt(last.slice(-4), 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

const formatTimerResponse = (tm) => {
  if (!tm) return null;
  return {
    ...tm,
    started_at: tm.started_at ? new Date(tm.started_at).toISOString() : null,
    ends_at: tm.ends_at ? new Date(tm.ends_at).toISOString() : null,
    acknowledged_at: tm.acknowledged_at ? new Date(tm.acknowledged_at).toISOString() : null
  };
};

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'POS BILLING (Express)',
    time: new Date().toISOString()
  });
});

// Auth
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(422).json({ message: 'Username atau password wajib diisi.' });
  }

  const [users] = await pool.query(
    `SELECT u.*, r.name as role_name, r.description as role_description 
     FROM users u 
     JOIN roles r ON u.role_id = r.id 
     WHERE u.username = ?`,
    [username]
  );

  if (!users.length) {
    return res.status(422).json({ message: 'Username atau password tidak valid.' });
  }

  const user = users[0];
  if (user.status !== 'active') {
    return res.status(422).json({ message: 'Akun nonaktif.' });
  }

  // Support bcrypt (Laravel uses bcrypt $2y$)
  let validPassword = false;
  try {
    const formattedHash = user.password.replace(/^\$2y\$/, '$2a$');
    validPassword = await bcrypt.compare(password, formattedHash);
  } catch (e) {
    validPassword = (password === user.password);
  }

  if (!validPassword) {
    return res.status(422).json({ message: 'Username atau password tidak valid.' });
  }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role_name },
    JWT_SECRET,
    { expiresIn: `${JWT_TTL}m` }
  );

  const userData = {
    id: user.id,
    role_id: user.role_id,
    name: user.name,
    username: user.username,
    status: user.status,
    role: {
      id: user.role_id,
      name: user.role_name,
      description: user.role_description
    }
  };

  await logActivity(user.id, 'Login', 'Auth', req);

  return res.json({
    access_token: token,
    token_type: 'bearer',
    expires_in: JWT_TTL * 60,
    user: userData
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await logActivity(req.user.id, 'Logout', 'Auth', req);
  res.json({ message: 'Logout berhasil.' });
});

app.post('/api/auth/refresh', requireAuth, (req, res) => {
  const token = jwt.sign(
    { sub: req.user.id, username: req.user.username, role: req.user.role.name },
    JWT_SECRET,
    { expiresIn: `${JWT_TTL}m` }
  );
  res.json({
    access_token: token,
    token_type: 'bearer',
    expires_in: JWT_TTL * 60,
    user: req.user
  });
});

// POS STATE (Master synchronization endpoint)
app.get('/api/pos/state', requireAuth, async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.role_id, u.name, u.username, u.status, u.created_at, u.updated_at,
             r.id as r_id, r.name as r_name, r.description as r_description
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.id
    `);

    const mappedUsers = users.map(u => ({
      id: u.id,
      role_id: u.role_id,
      name: u.name,
      username: u.username,
      status: u.status,
      role: {
        id: u.r_id,
        name: u.r_name,
        description: u.r_description
      }
    }));

    const [categories] = await pool.query('SELECT * FROM categories ORDER BY name');
    const [products] = await pool.query('SELECT * FROM products ORDER BY name');
    const [tables] = await pool.query('SELECT * FROM tables ORDER BY id');

    // Transactions with payments & details
    const [transactions] = await pool.query(`
      SELECT t.* FROM transactions t
      WHERE t.status = 'paid'
      ORDER BY t.id DESC
      LIMIT 500
    `);

    const transIds = transactions.map(t => t.id);
    let detailsMap = {};
    let paymentsMap = {};

    if (transIds.length > 0) {
      const [allDetails] = await pool.query(`
        SELECT td.id, td.transaction_id, td.product_id, td.qty, td.discount, td.price, td.subtotal,
               p.name as product_name, p.sku as product_sku
        FROM transaction_details td
        LEFT JOIN products p ON td.product_id = p.id
        WHERE td.transaction_id IN (?)
      `, [transIds]);

      allDetails.forEach(d => {
        if (!detailsMap[d.transaction_id]) detailsMap[d.transaction_id] = [];
        detailsMap[d.transaction_id].push({
          id: d.id,
          transaction_id: d.transaction_id,
          product_id: d.product_id,
          qty: d.qty,
          discount: d.discount,
          price: d.price,
          subtotal: d.subtotal,
          product: { id: d.product_id, name: d.product_name, sku: d.product_sku }
        });
      });

      const [allPayments] = await pool.query(`
        SELECT id, transaction_id, method, amount, paid_at FROM payments WHERE transaction_id IN (?)
      `, [transIds]);

      allPayments.forEach(p => {
        if (!paymentsMap[p.transaction_id]) paymentsMap[p.transaction_id] = [];
        paymentsMap[p.transaction_id].push(p);
      });
    }

    const mappedTransactions = transactions.map(t => ({
      ...t,
      details: detailsMap[t.id] || [],
      payments: paymentsMap[t.id] || []
    }));

    // Open & hold orders
    const [openOrders] = await pool.query(`
      SELECT * FROM transactions
      WHERE status IN ('open', 'hold')
      ORDER BY id DESC
    `);

    const openOrderIds = openOrders.map(o => o.id);
    let openDetailsMap = {};
    if (openOrderIds.length > 0) {
      const [orderDetails] = await pool.query(`
        SELECT id, transaction_id, product_id, qty, discount, price, subtotal
        FROM transaction_details
        WHERE transaction_id IN (?)
      `, [openOrderIds]);
      orderDetails.forEach(d => {
        if (!openDetailsMap[d.transaction_id]) openDetailsMap[d.transaction_id] = [];
        openDetailsMap[d.transaction_id].push(d);
      });
    }

    const mappedOpenOrders = openOrders.map(o => ({
      ...o,
      details: openDetailsMap[o.id] || []
    }));

    // Timers
    const [timers] = await pool.query(`
      SELECT tm.*, r.id as rem_id, r.remind_before_minutes, r.interval_minutes, r.message, r.is_active
      FROM timers tm
      JOIN tables tb ON tb.id = tm.table_id
      LEFT JOIN reminders r ON r.timer_id = tm.id
      WHERE tm.status IN ('running', 'expired') AND tb.status != 'available'
      ORDER BY tm.id DESC
    `);

    const mappedTimers = timers.map(tm => {
      const formatted = formatTimerResponse(tm);
      return {
        ...formatted,
        reminder: tm.rem_id ? {
          id: tm.rem_id,
          timer_id: tm.id,
          remind_before_minutes: tm.remind_before_minutes,
          interval_minutes: tm.interval_minutes,
          message: tm.message,
          is_active: tm.is_active
        } : null
      };
    });

    const [tableHistories] = await pool.query('SELECT * FROM table_histories ORDER BY id DESC LIMIT 300');
    const mappedTableHistories = tableHistories.map(history => {
      let items = history.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      if (!Array.isArray(items) || items.length === 0) {
        items = (detailsMap[history.transaction_id] || []).map(detail => ({
          product_id: detail.product_id,
          sku: detail.product?.sku || '',
          name: detail.product?.name || 'Produk',
          qty: detail.qty
        }));
      }
      return { ...history, items };
    });
    const [cashierShifts] = await pool.query('SELECT * FROM cashier_shifts ORDER BY id DESC LIMIT 100');
    const [backupLogs] = await pool.query('SELECT * FROM backup_logs ORDER BY id DESC LIMIT 50');
    const [activityLogs] = await pool.query('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 100');

    res.json({
      users: mappedUsers,
      categories,
      products,
      tables,
      transactions: mappedTransactions,
      open_orders: mappedOpenOrders,
      timers: mappedTimers,
      table_histories: mappedTableHistories,
      cashier_shifts: cashierShifts,
      backup_logs: backupLogs,
      activity_logs: activityLogs,
      server_time: new Date().toISOString()
    });
  } catch (err) {
    console.error('POS State Error:', err);
    res.status(500).json({ message: 'Failed to retrieve POS state', error: err.message });
  }
});

// Reset Operational (Super Admin)
app.post('/api/pos/reset-operational', requireAuth, requireRole(['Super Admin']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM reminders');
    await conn.query('DELETE FROM timers');
    await conn.query('DELETE FROM payments');
    await conn.query('DELETE FROM transaction_details');
    await conn.query('DELETE FROM table_histories');
    await conn.query('DELETE FROM transactions');
    await conn.query("UPDATE tables SET status = 'available'");
    await conn.commit();

    await logActivity(req.user.id, 'Reset data operasional', 'System', req);
    res.json({ message: 'Data operasional berhasil direset.' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ message: 'Gagal reset operasional', error: e.message });
  } finally {
    conn.release();
  }
});

// TRANSACTIONS: Open Order (Ultra-fast async pool)
app.post('/api/transactions/open-order', requireAuth, async (req, res) => {
  const { table_id, cashier_id, items = [], status = 'open' } = req.body;
  if (!table_id || !cashier_id) {
    return res.status(422).json({ message: 'table_id dan cashier_id wajib diisi.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let [existing] = await conn.query(
      `SELECT * FROM transactions WHERE table_id = ? AND status IN ('open', 'hold') FOR UPDATE`,
      [table_id]
    );

    let transaction;
    if (existing.length === 0) {
      const invoice = await generateInvoice();
      const [insertResult] = await conn.query(
        `INSERT INTO transactions (invoice, table_id, cashier_id, subtotal, discount, tax, service_charge, grand_total, status, created_at, updated_at)
         VALUES (?, ?, ?, 0, 0, 0, 0, 0, ?, NOW(), NOW())`,
        [invoice, table_id, cashier_id, status]
      );
      transaction = { id: insertResult.insertId, invoice, table_id, cashier_id, status };
    } else {
      transaction = existing[0];
    }

    // Replace details
    await conn.query('DELETE FROM transaction_details WHERE transaction_id = ?', [transaction.id]);

    let subtotal = 0;
    const insertedDetails = [];

    for (const item of items) {
      const [pRows] = await conn.query('SELECT * FROM products WHERE id = ?', [item.product_id]);
      if (!pRows.length) continue;
      const product = pRows[0];
      const qty = parseInt(item.qty, 10) || 1;
      const discount = parseFloat(item.discount || 0);
      const lineSubtotal = parseFloat(((parseFloat(product.sell_price) * qty) - discount).toFixed(2));
      subtotal = parseFloat((subtotal + lineSubtotal).toFixed(2));

      const [detailResult] = await conn.query(
        `INSERT INTO transaction_details (transaction_id, product_id, qty, price, cost_price, discount, subtotal, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [transaction.id, product.id, qty, product.sell_price, product.cost_price, discount, lineSubtotal]
      );

      insertedDetails.push({
        id: detailResult.insertId,
        transaction_id: transaction.id,
        product_id: product.id,
        qty,
        price: product.sell_price,
        cost_price: product.cost_price,
        discount,
        subtotal: lineSubtotal,
        product: { id: product.id, name: product.name }
      });
    }

    await conn.query(
      `UPDATE transactions SET cashier_id = ?, subtotal = ?, discount = 0, tax = 0, grand_total = ?, status = ?, updated_at = NOW() WHERE id = ?`,
      [cashier_id, subtotal, subtotal, status, transaction.id]
    );

    await conn.commit();

    // Async log in background without waiting
    logActivity(cashier_id, `Update order ${transaction.invoice}`, 'POS', req, { transaction_id: transaction.id });

    res.status(201).json({
      id: transaction.id,
      invoice: transaction.invoice,
      table_id,
      cashier_id,
      subtotal,
      discount: 0,
      tax: 0,
      grand_total: subtotal,
      status,
      details: insertedDetails
    });
  } catch (err) {
    await conn.rollback();
    console.error('Open Order Error:', err);
    res.status(500).json({ message: 'Gagal update order', error: err.message });
  } finally {
    conn.release();
  }
});

// Cancel Order
app.post('/api/transactions/cancel-order', requireAuth, async (req, res) => {
  const { table_id } = req.body;
  if (!table_id) return res.status(422).json({ message: 'table_id wajib diisi.' });

  const [orders] = await pool.query(
    `SELECT * FROM transactions WHERE table_id = ? AND status IN ('open', 'hold')`,
    [table_id]
  );

  for (const order of orders) {
    await pool.query('DELETE FROM transactions WHERE id = ?', [order.id]);
    logActivity(req.user?.id, `Batal order ${order.invoice}`, 'POS', req, { transaction_id: order.id });
  }

  res.json({ message: 'Order dibatalkan.' });
});

// Checkout
app.post('/api/transactions/checkout', requireAuth, async (req, res) => {
  const {
    table_id,
    cashier_id,
    payment_method,
    items = [],
    discount = 0,
    service_charge_percent = 5,
    tax_percent = 10,
    duration_minutes,
    reminder_interval_minutes = 5
  } = req.body;

  if (!table_id || !cashier_id || !payment_method || items.length === 0) {
    return res.status(422).json({ message: 'Data checkout tidak lengkap.' });
  }
  const requestedDuration = duration_minutes === undefined || duration_minutes === null
    ? null
    : parseInt(duration_minutes, 10);
  if (requestedDuration !== null && (!Number.isInteger(requestedDuration) || requestedDuration < 1 || requestedDuration > 1440)) {
    return res.status(422).json({ message: 'Durasi penggunaan harus antara 1 dan 1440 menit.' });
  }

  // Kasir shift validation
  if (req.user?.role?.name === 'Kasir') {
    const [shifts] = await pool.query(
      `SELECT * FROM cashier_shifts WHERE cashier_id = ? AND status = 'open'`,
      [cashier_id]
    );
    if (!shifts.length) {
      return res.status(422).json({ message: 'Kasir belum membuka shift. Buka shift dulu sebelum checkout.' });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [tableRows] = await conn.query('SELECT * FROM tables WHERE id = ? FOR UPDATE', [table_id]);
    if (!tableRows.length) {
      throw new Error('Meja tidak ditemukan.');
    }
    let [existing] = await conn.query(
      `SELECT * FROM transactions WHERE table_id = ? AND status IN ('open', 'hold') FOR UPDATE`,
      [table_id]
    );

    let transaction;
    if (existing.length === 0) {
      const invoice = await generateInvoice();
      const [insertResult] = await conn.query(
        `INSERT INTO transactions (invoice, table_id, cashier_id, subtotal, discount, tax, service_charge, grand_total, status, created_at, updated_at)
         VALUES (?, ?, ?, 0, 0, 0, 0, 0, 'open', NOW(), NOW())`,
        [invoice, table_id, cashier_id]
      );
      transaction = { id: insertResult.insertId, invoice, table_id, cashier_id };
    } else {
      transaction = existing[0];
    }

    await conn.query('DELETE FROM transaction_details WHERE transaction_id = ?', [transaction.id]);

    let subtotal = 0;
    const insertedDetails = [];

    for (const item of items) {
      const [pRows] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
      if (!pRows.length) continue;
      const product = pRows[0];
      const qty = parseInt(item.qty, 10) || 1;
      const itemDiscount = parseFloat(item.discount || 0);

      // Decrement stock
      if (product.track_stock) {
        if (product.stock < qty) {
          throw new Error(`Stok ${product.name} tidak cukup.`);
        }
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, product.id]);
      }

      const lineSubtotal = parseFloat(((parseFloat(product.sell_price) * qty) - itemDiscount).toFixed(2));
      subtotal = parseFloat((subtotal + lineSubtotal).toFixed(2));

      const [detailResult] = await conn.query(
        `INSERT INTO transaction_details (transaction_id, product_id, qty, price, cost_price, discount, subtotal, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [transaction.id, product.id, qty, product.sell_price, product.cost_price, itemDiscount, lineSubtotal]
      );

      insertedDetails.push({
        id: detailResult.insertId,
        transaction_id: transaction.id,
        product_id: product.id,
        qty,
        discount: itemDiscount,
        price: product.sell_price,
        subtotal: lineSubtotal,
        product: { id: product.id, name: product.name, sku: product.sku }
      });
    }

    const disc = parseFloat(discount || 0);
    const taxable = parseFloat(Math.max(0, subtotal - disc).toFixed(2));
    const tax = parseFloat((taxable * (parseFloat(tax_percent !== undefined ? tax_percent : 10) / 100)).toFixed(2));
    const serviceBase = parseFloat((taxable + tax).toFixed(2));
    const sPercent = service_charge_percent !== undefined ? parseFloat(service_charge_percent) : 5;
    const serviceCharge = (req.body.service_charge !== undefined && req.body.service_charge !== null)
      ? parseFloat(parseFloat(req.body.service_charge).toFixed(2))
      : parseFloat((serviceBase * (sPercent / 100)).toFixed(2));
    const grandTotal = Math.round(taxable + tax + serviceCharge);

    await conn.query(
      `UPDATE transactions 
       SET table_id = ?, cashier_id = ?, subtotal = ?, discount = ?, tax = ?, service_charge = ?, grand_total = ?, status = 'paid', updated_at = NOW()
       WHERE id = ?`,
      [table_id, cashier_id, subtotal, disc, tax, serviceCharge, grandTotal, transaction.id]
    );

    const [paymentResult] = await conn.query(
      `INSERT INTO payments (transaction_id, method, amount, paid_at, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW(), NOW())`,
      [transaction.id, payment_method.toLowerCase(), grandTotal]
    );

    // Timers logic
    const [existingTimers] = await conn.query(
      `SELECT * FROM timers WHERE table_id = ? AND status IN ('running', 'expired') ORDER BY id DESC LIMIT 1`,
      [table_id]
    );

    let sessionMinutes;
    if (existingTimers.length === 0) {
      if (requestedDuration === null) {
        throw new Error('Durasi penggunaan wajib ditentukan saat membuka meja.');
      }
      sessionMinutes = requestedDuration;
      const [timerRes] = await conn.query(
        `INSERT INTO timers (table_id, transaction_id, duration_minutes, started_at, ends_at, status, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? MINUTE), 'running', NOW(), NOW())`,
        [table_id, transaction.id, sessionMinutes, sessionMinutes]
      );

      await conn.query(
        `INSERT INTO reminders (timer_id, remind_before_minutes, interval_minutes, message, is_active, created_at, updated_at)
         VALUES (?, 59, ?, 'Perhatian, waktu penggunaan {table} akan berakhir dalam {minutes} menit', 1, NOW(), NOW())`,
        [timerRes.insertId, reminder_interval_minutes || 5]
      );
    } else {
      // Checkout tambahan tidak mengubah durasi sesi yang sedang berjalan.
      sessionMinutes = Number(existingTimers[0].duration_minutes);
    }

    await conn.query(`UPDATE tables SET status = 'occupied' WHERE id = ?`, [table_id]);

    // Table histories
    const [activeHistories] = await conn.query(
      `SELECT * FROM table_histories WHERE table_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
      [table_id]
    );

    const checkoutItems = insertedDetails.map(detail => ({
      product_id: detail.product_id,
      sku: detail.product?.sku || '',
      name: detail.product?.name || 'Produk',
      qty: detail.qty
    }));

    if (activeHistories.length > 0) {
      let currentItems = activeHistories[0].items;
      if (typeof currentItems === 'string') {
        try { currentItems = JSON.parse(currentItems); } catch { currentItems = []; }
      }
      if (!Array.isArray(currentItems)) currentItems = [];
      const merged = new Map();
      for (const item of [...currentItems, ...checkoutItems]) {
        const key = String(item.product_id || item.name || '');
        const previous = merged.get(key);
        merged.set(key, previous
          ? { ...previous, qty: Number(previous.qty || 0) + Number(item.qty || 0) }
          : { ...item, qty: Number(item.qty || 0) });
      }
      await conn.query(
        `UPDATE table_histories SET items = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify([...merged.values()]), activeHistories[0].id]
      );
    } else {
      await conn.query(
        `INSERT INTO table_histories (table_id, transaction_id, cashier_id, started_at, duration_minutes, items, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), ?, ?, 'active', ?, NOW(), NOW())`,
        [table_id, transaction.id, cashier_id, sessionMinutes, JSON.stringify(checkoutItems), `Checkout ${transaction.invoice}`]
      );
    }

    await conn.commit();

    logActivity(cashier_id, `Checkout ${transaction.invoice}`, 'Transaksi', req, { transaction_id: transaction.id, grand_total: grandTotal });

    res.status(201).json({
      id: transaction.id,
      invoice: transaction.invoice,
      table_id,
      cashier_id,
      subtotal,
      discount: disc,
      tax,
      service_charge: serviceCharge,
      grand_total: grandTotal,
      status: 'paid',
      created_at: new Date().toISOString(),
      details: insertedDetails,
      payments: [{ id: paymentResult.insertId, method: payment_method.toLowerCase(), amount: grandTotal }]
    });
  } catch (err) {
    await conn.rollback();
    console.error('Checkout Error:', err);
    res.status(422).json({ message: err.message || 'Checkout gagal' });
  } finally {
    conn.release();
  }
});

// Void Transaction
app.post('/api/transactions/:id/void', requireAuth, requireRole(['Super Admin']), async (req, res) => {
  const transId = req.params.id;
  const { reason } = req.body;
  if (!reason) return res.status(422).json({ message: 'Alasan void wajib diisi.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [tRows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [transId]);
    if (!tRows.length) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    const trans = tRows[0];
    if (trans.status === 'cancelled') return res.status(422).json({ message: 'Transaksi sudah dibatalkan.' });

    // Restore stock
    const [details] = await conn.query(`
      SELECT td.*, p.track_stock 
      FROM transaction_details td 
      JOIN products p ON td.product_id = p.id 
      WHERE td.transaction_id = ?
    `, [transId]);

    for (const d of details) {
      if (d.track_stock) {
        await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [d.qty, d.product_id]);
      }
    }

    await conn.query(`
      UPDATE transactions 
      SET status = 'cancelled', void_reason = ?, voided_by = ?, voided_at = NOW(), updated_at = NOW() 
      WHERE id = ?
    `, [reason, req.user.id, transId]);

    // Free table timer if applicable
    const [timers] = await conn.query(`SELECT * FROM timers WHERE transaction_id = ? AND status IN ('running', 'expired', 'acknowledged')`, [transId]);
    if (timers.length > 0) {
      await conn.query(`UPDATE timers SET status = 'cancelled' WHERE id = ?`, [timers[0].id]);
      await conn.query(`UPDATE tables SET status = 'available' WHERE id = ?`, [trans.table_id]);
      await conn.query(`UPDATE table_histories SET status = 'cancelled', ended_at = NOW() WHERE table_id = ? AND status = 'active'`, [trans.table_id]);
    }

    await conn.commit();
    logActivity(req.user.id, `Void ${trans.invoice}`, 'Transaksi', req, { transaction_id: trans.id, reason });

    const [payments] = await pool.query('SELECT * FROM payments WHERE transaction_id = ?', [transId]);
    res.json({
      ...trans,
      status: 'cancelled',
      void_reason: reason,
      details,
      payments
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Gagal void transaksi', error: err.message });
  } finally {
    conn.release();
  }
});

// Refund Transaction
app.post('/api/transactions/:id/refund', requireAuth, requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const transId = req.params.id;
  const { amount, reason } = req.body;
  const numAmount = parseFloat(amount || 0);

  if (numAmount <= 0 || !reason) {
    return res.status(422).json({ message: 'Nominal dan alasan refund wajib diisi.' });
  }

  const [tRows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [transId]);
  if (!tRows.length) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
  const trans = tRows[0];

  const totalRefund = parseFloat(trans.refund_amount || 0) + numAmount;
  if (totalRefund > parseFloat(trans.grand_total)) {
    return res.status(422).json({ message: 'Total refund melebihi total transaksi.' });
  }

  await pool.query(`
    UPDATE transactions 
    SET refund_amount = ?, refund_reason = ?, refunded_by = ?, refunded_at = NOW(), updated_at = NOW() 
    WHERE id = ?
  `, [totalRefund, reason, req.user.id, transId]);

  logActivity(req.user.id, `Refund ${trans.invoice}`, 'Transaksi', req, { transaction_id: trans.id, amount: numAmount, reason });

  const [details] = await pool.query('SELECT * FROM transaction_details WHERE transaction_id = ?', [transId]);
  const [payments] = await pool.query('SELECT * FROM payments WHERE transaction_id = ?', [transId]);

  res.json({
    ...trans,
    refund_amount: totalRefund,
    refund_reason: reason,
    details,
    payments
  });
});

// TIMERS
app.post('/api/timers/:id/acknowledge', requireAuth, async (req, res) => {
  const timerId = req.params.id;
  await pool.query(`UPDATE timers SET status = 'acknowledged', acknowledged_at = NOW() WHERE id = ?`, [timerId]);
  const [tRows] = await pool.query('SELECT * FROM timers WHERE id = ?', [timerId]);
  res.json(formatTimerResponse(tRows[0]));
});

app.post('/api/timers/:id/expire', requireAuth, async (req, res) => {
  const timerId = req.params.id;
  await pool.query(`UPDATE timers SET status = 'expired' WHERE id = ?`, [timerId]);
  const [tRows] = await pool.query('SELECT * FROM timers WHERE id = ?', [timerId]);
  if (tRows.length > 0) {
    await pool.query(`UPDATE tables SET status = 'time_expired' WHERE id = ?`, [tRows[0].table_id]);
  }
  logActivity(req.user?.id, `Timer habis table ${tRows[0]?.table_id}`, 'Timer', req, { timer_id: timerId });
  res.json(formatTimerResponse(tRows[0]));
});

app.post('/api/timers/:id/finish', requireAuth, async (req, res) => {
  const timerId = req.params.id;
  const [tRows] = await pool.query('SELECT * FROM timers WHERE id = ?', [timerId]);
  if (!tRows.length) return res.status(404).json({ message: 'Timer tidak ditemukan.' });
  const timer = tRows[0];

  await pool.query(`UPDATE timers SET status = 'acknowledged', acknowledged_at = NOW() WHERE (id = ? OR table_id = ?)`, [timerId, timer.table_id]);
  await pool.query(`UPDATE tables SET status = 'available' WHERE id = ?`, [timer.table_id]);

  await pool.query(`
    UPDATE table_histories 
    SET ended_at = NOW(), status = 'finished', updated_at = NOW() 
    WHERE table_id = ? AND status = 'active'
  `, [timer.table_id]);

  logActivity(req.user?.id, `Selesaikan table ${timer.table_id}`, 'Timer', req, { timer_id: timerId });
  res.json(timer);
});

app.post('/api/timers/:id/extend', requireAuth, requireRole(['Super Admin']), async (req, res) => {
  const timerId = req.params.id;
  const { minutes } = req.body;
  const numMin = parseInt(minutes, 10);
  if (!numMin || numMin <= 0) return res.status(422).json({ message: 'Menit perpanjangan tidak valid.' });

  const [tRows] = await pool.query('SELECT * FROM timers WHERE id = ?', [timerId]);
  if (!tRows.length) return res.status(404).json({ message: 'Timer tidak ditemukan.' });
  const timer = tRows[0];

  await pool.query(`
    UPDATE timers 
    SET duration_minutes = duration_minutes + ?, 
        ends_at = IF(ends_at > NOW(), DATE_ADD(ends_at, INTERVAL ? MINUTE), DATE_ADD(NOW(), INTERVAL ? MINUTE)), 
        status = 'running', 
        acknowledged_at = NULL, 
        updated_at = NOW() 
    WHERE id = ?
  `, [numMin, numMin, numMin, timerId]);

  await pool.query(`
    UPDATE table_histories SET duration_minutes = duration_minutes + ?, updated_at = NOW() WHERE table_id = ? AND status = 'active'
  `, [numMin, timer.table_id]);

  logActivity(req.user?.id, `Extend timer table ${timer.table_id}`, 'Timer', req, { timer_id: timerId, minutes: numMin });

  const [updated] = await pool.query('SELECT * FROM timers WHERE id = ?', [timerId]);
  res.json(formatTimerResponse(updated[0]));
});

// TABLES CRUD
app.patch('/api/tables/:id/position', requireAuth, async (req, res) => {
  const { position_x, position_y } = req.body;
  await pool.query(`UPDATE tables SET position_x = ?, position_y = ?, updated_at = NOW() WHERE id = ?`, [position_x, position_y, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM tables WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

app.patch('/api/tables/:id', requireAuth, async (req, res) => {
  const { name, number, status, notes, position_x, position_y } = req.body;
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (number !== undefined) { fields.push('number = ?'); values.push(number); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
  if (position_x !== undefined) { fields.push('position_x = ?'); values.push(position_x); }
  if (position_y !== undefined) { fields.push('position_y = ?'); values.push(position_y); }

  if (fields.length > 0) {
    values.push(req.params.id);
    await pool.query(`UPDATE tables SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
  }

  if (status === 'available') {
    await pool.query(`UPDATE timers SET status = 'acknowledged', acknowledged_at = NOW() WHERE table_id = ? AND status IN ('running', 'expired')`, [req.params.id]);
    await pool.query(`UPDATE table_histories SET ended_at = NOW(), status = 'finished', updated_at = NOW() WHERE table_id = ? AND status = 'active'`, [req.params.id]);
  }

  const [rows] = await pool.query('SELECT * FROM tables WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

app.post('/api/tables', requireAuth, async (req, res) => {
  const { name, number, position_x = 24, position_y = 24, status = 'available', notes = '' } = req.body;
  const [result] = await pool.query(
    `INSERT INTO tables (name, number, position_x, position_y, status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [name, number, position_x, position_y, status, notes]
  );
  const [rows] = await pool.query('SELECT * FROM tables WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

app.delete('/api/tables/:id', requireAuth, async (req, res) => {
  const [trans] = await pool.query('SELECT id FROM transactions WHERE table_id = ? LIMIT 1', [req.params.id]);
  if (trans.length > 0) {
    return res.status(422).json({ message: 'Meja tidak bisa dihapus karena sudah memiliki transaksi. Ubah status ke Maintenance bila tidak dipakai.' });
  }
  await pool.query('DELETE FROM tables WHERE id = ?', [req.params.id]);
  res.json({ message: 'Meja dihapus.' });
});

// SHIFTS
app.get('/api/shifts', requireAuth, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT cs.*, u.name as cashier_name 
    FROM cashier_shifts cs
    LEFT JOIN users u ON cs.cashier_id = u.id
    ORDER BY cs.id DESC LIMIT 100
  `);
  res.json(rows);
});

app.post('/api/shifts/open', requireAuth, async (req, res) => {
  const { opening_cash = 0, notes = '' } = req.body;
  const cashierId = req.user.id;

  const [existingOpen] = await pool.query(
    `SELECT id FROM cashier_shifts WHERE cashier_id = ? AND status = 'open'`,
    [cashierId]
  );
  if (existingOpen.length > 0) {
    return res.status(422).json({ message: 'Shift kasir masih terbuka.' });
  }

  const [shiftsToday] = await pool.query(
    `SELECT COUNT(*) as c FROM cashier_shifts WHERE DATE(opened_at) = CURDATE()`
  );
  const count = shiftsToday[0].c;
  if (count >= 2) {
    return res.status(422).json({ message: 'Shift hari ini sudah penuh (maksimal 2 shift per hari).' });
  }

  const shiftNumber = count + 1;
  const [insertRes] = await pool.query(
    `INSERT INTO cashier_shifts (cashier_id, shift_number, opened_at, opening_cash, status, notes, created_at, updated_at)
     VALUES (?, ?, NOW(), ?, 'open', ?, NOW(), NOW())`,
    [cashierId, shiftNumber, opening_cash, notes]
  );

  const [rows] = await pool.query('SELECT * FROM cashier_shifts WHERE id = ?', [insertRes.insertId]);
  logActivity(cashierId, 'Buka shift kasir', 'Shift', req);
  res.status(201).json(rows[0]);
});

app.post('/api/shifts/:id/close', requireAuth, async (req, res) => {
  const shiftId = req.params.id;
  const { closing_cash = 0, notes = '' } = req.body;

  const [sRows] = await pool.query('SELECT * FROM cashier_shifts WHERE id = ?', [shiftId]);
  if (!sRows.length) return res.status(404).json({ message: 'Shift tidak ditemukan.' });
  const shift = sRows[0];
  if (shift.status !== 'open') return res.status(422).json({ message: 'Shift sudah ditutup.' });

  const [salesRows] = await pool.query(`
    SELECT COALESCE(SUM(t.grand_total), 0) as total_cash
    FROM transactions t
    JOIN payments p ON p.transaction_id = t.id
    WHERE t.cashier_id = ? AND t.status = 'paid' AND p.method = 'cash'
      AND t.created_at BETWEEN ? AND NOW()
  `, [shift.cashier_id, shift.opened_at]);

  const [refundRows] = await pool.query(`
    SELECT COALESCE(SUM(t.refund_amount), 0) as total_refund
    FROM transactions t
    JOIN payments p ON p.transaction_id = t.id
    WHERE t.cashier_id = ? AND p.method = 'cash'
      AND t.refunded_at BETWEEN ? AND NOW()
  `, [shift.cashier_id, shift.opened_at]);

  const cashSales = parseFloat(salesRows[0].total_cash || 0);
  const cashRefunds = parseFloat(refundRows[0].total_refund || 0);
  const expectedCash = parseFloat(shift.opening_cash) + cashSales - cashRefunds;
  const closingNum = parseFloat(closing_cash);
  const cashDifference = closingNum - expectedCash;

  await pool.query(`
    UPDATE cashier_shifts 
    SET closed_at = NOW(), closing_cash = ?, expected_cash = ?, cash_difference = ?, status = 'closed', notes = ?, updated_at = NOW()
    WHERE id = ?
  `, [closingNum, expectedCash, cashDifference, notes || shift.notes, shiftId]);

  logActivity(req.user.id, 'Tutup shift kasir', 'Shift', req, { shift_id: shiftId, cash_difference: cashDifference });

  const [updated] = await pool.query('SELECT * FROM cashier_shifts WHERE id = ?', [shiftId]);
  res.json(updated[0]);
});

// CATEGORIES & PRODUCTS
app.post('/api/categories', requireAuth, requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const { name, description = '', is_active = 1 } = req.body;
  const [resInsert] = await pool.query(
    `INSERT INTO categories (name, description, is_active, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
    [name, description, is_active ? 1 : 0]
  );
  const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [resInsert.insertId]);
  res.status(201).json(rows[0]);
});

app.patch('/api/categories/:id', requireAuth, requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const { name, description, is_active } = req.body;
  const fields = [];
  const vals = [];
  if (name !== undefined) { fields.push('name = ?'); vals.push(name); }
  if (description !== undefined) { fields.push('description = ?'); vals.push(description); }
  if (is_active !== undefined) { fields.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
  if (fields.length > 0) {
    vals.push(req.params.id);
    await pool.query(`UPDATE categories SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, vals);
  }
  const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

app.post('/api/products', requireAuth, requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const { category_id, sku, barcode = null, name, photo = null, cost_price = 0, sell_price, stock = 0, track_stock = 1, is_active = 1 } = req.body;
  const [resInsert] = await pool.query(`
    INSERT INTO products (category_id, sku, barcode, name, photo, cost_price, sell_price, stock, track_stock, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, [category_id, sku, barcode, name, photo, cost_price, sell_price, stock, track_stock ? 1 : 0, is_active ? 1 : 0]);
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [resInsert.insertId]);
  res.status(201).json(rows[0]);
});

app.patch('/api/products/:id', requireAuth, requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const fields = [];
  const vals = [];
  const allowed = ['category_id', 'sku', 'barcode', 'name', 'photo', 'cost_price', 'sell_price', 'stock', 'track_stock', 'is_active'];
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      fields.push(`${k} = ?`);
      vals.push(k === 'track_stock' || k === 'is_active' ? (req.body[k] ? 1 : 0) : req.body[k]);
    }
  }
  if (fields.length > 0) {
    vals.push(req.params.id);
    await pool.query(`UPDATE products SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, vals);
  }
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

// USERS
app.post('/api/users', requireAuth, requireRole(['Super Admin']), async (req, res) => {
  const { role_id, name, username, password, status = 'active' } = req.body;
  const hash = await bcrypt.hash(password || 'password', 10);
  const [resInsert] = await pool.query(
    `INSERT INTO users (role_id, name, username, password, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [role_id, name, username, hash, status]
  );
  const [rows] = await pool.query(`
    SELECT u.id, u.role_id, u.name, u.username, u.status, r.name as role_name 
    FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `, [resInsert.insertId]);
  res.status(201).json(rows[0]);
});

app.patch('/api/users/:id', requireAuth, requireRole(['Super Admin']), async (req, res) => {
  const fields = [];
  const vals = [];
  if (req.body.role_id !== undefined) { fields.push('role_id = ?'); vals.push(req.body.role_id); }
  if (req.body.name !== undefined) { fields.push('name = ?'); vals.push(req.body.name); }
  if (req.body.username !== undefined) { fields.push('username = ?'); vals.push(req.body.username); }
  if (req.body.status !== undefined) { fields.push('status = ?'); vals.push(req.body.status); }
  if (req.body.password) {
    const hash = await bcrypt.hash(req.body.password, 10);
    fields.push('password = ?');
    vals.push(hash);
  }
  if (fields.length > 0) {
    vals.push(req.params.id);
    await pool.query(`UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, vals);
  }
  const [rows] = await pool.query(`
    SELECT u.id, u.role_id, u.name, u.username, u.status, r.name as role_name 
    FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `, [req.params.id]);
  res.json(rows[0]);
});

// BACKUPS
app.get('/api/backups', requireAuth, requireRole(['Super Admin']), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM backup_logs ORDER BY id DESC LIMIT 50');
  res.json(rows);
});

// SPA FALLBACK ROUTE
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'Endpoint API tidak ditemukan.' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// START SERVER
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Mahjong POS Express Server running on http://127.0.0.1:${PORT}`);
  });
}).catch(err => {
  console.error('Database initialization warning:', err);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Mahjong POS Express Server running on http://127.0.0.1:${PORT}`);
  });
});
