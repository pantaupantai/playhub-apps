const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seed() {
  console.log('Running seeder...');

  // Ensure permission_role table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS permission_role (
      permission_id BIGINT UNSIGNED NOT NULL,
      role_id BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (permission_id, role_id),
      CONSTRAINT fk_pr_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
      CONSTRAINT fk_pr_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 1. Roles
  const rolesData = [
    { name: 'Super Admin', description: 'Mengelola seluruh sistem' },
    { name: 'Admin', description: 'Mengelola operasional dan laporan' },
    { name: 'Kasir', description: 'Menjalankan transaksi kasir' }
  ];

  const roleMap = {};
  for (const r of rolesData) {
    const [existing] = await pool.query('SELECT id FROM roles WHERE name = ?', [r.name]);
    if (existing.length > 0) {
      await pool.query('UPDATE roles SET description = ?, updated_at = NOW() WHERE id = ?', [r.description, existing[0].id]);
      roleMap[r.name] = existing[0].id;
    } else {
      const [res] = await pool.query('INSERT INTO roles (name, description, created_at, updated_at) VALUES (?, ?, NOW(), NOW())', [r.name, r.description]);
      roleMap[r.name] = res.insertId;
    }
  }

  // 2. Permissions
  const permissionsData = [
    { name: 'manage_system', module: 'system', description: 'Konfigurasi sistem' },
    { name: 'manage_users', module: 'users', description: 'Kelola user dan password' },
    { name: 'manage_products', module: 'products', description: 'Kelola produk dan kategori' },
    { name: 'manage_transactions', module: 'transactions', description: 'Kelola transaksi' },
    { name: 'view_reports', module: 'reports', description: 'Lihat laporan' },
    { name: 'operate_cashier', module: 'pos', description: 'Operasi kasir' }
  ];

  const permMap = {};
  for (const p of permissionsData) {
    const [existing] = await pool.query('SELECT id FROM permissions WHERE name = ?', [p.name]);
    if (existing.length > 0) {
      await pool.query('UPDATE permissions SET module = ?, description = ?, updated_at = NOW() WHERE id = ?', [p.module, p.description, existing[0].id]);
      permMap[p.name] = existing[0].id;
    } else {
      const [res] = await pool.query('INSERT INTO permissions (name, module, description, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [p.name, p.module, p.description]);
      permMap[p.name] = res.insertId;
    }
  }

  // Sync role permissions
  await pool.query('DELETE FROM permission_role');
  for (const pId of Object.values(permMap)) {
    await pool.query('INSERT IGNORE INTO permission_role (permission_id, role_id) VALUES (?, ?)', [pId, roleMap['Super Admin']]);
  }
  for (const pName of ['manage_products', 'manage_transactions', 'view_reports']) {
    await pool.query('INSERT IGNORE INTO permission_role (permission_id, role_id) VALUES (?, ?)', [permMap[pName], roleMap['Admin']]);
  }
  for (const pName of ['operate_cashier', 'view_reports']) {
    await pool.query('INSERT IGNORE INTO permission_role (permission_id, role_id) VALUES (?, ?)', [permMap[pName], roleMap['Kasir']]);
  }

  // 3. Users
  const usersData = [
    { username: 'superadmin', role_id: roleMap['Super Admin'], name: 'Owner POS BILLING', password: 'SuperAdminPW666', status: 'active' },
    { username: 'admin', role_id: roleMap['Admin'], name: 'Admin Operasional', password: 'IniADMIN333', status: 'active' },
    { username: 'kasir1', role_id: roleMap['Kasir'], name: 'Sinta Kasir', password: 'password', status: 'active' },
    { username: 'kasir2', role_id: roleMap['Kasir'], name: 'Raka Kasir', password: 'password', status: 'active' }
  ];

  for (const u of usersData) {
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [u.username]);
    const hash = await bcrypt.hash(u.password, 10);
    if (existing.length > 0) {
      await pool.query('UPDATE users SET role_id = ?, name = ?, password = ?, status = ?, updated_at = NOW() WHERE id = ?', [u.role_id, u.name, hash, u.status, existing[0].id]);
    } else {
      await pool.query('INSERT INTO users (username, role_id, name, password, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())', [u.username, u.role_id, u.name, hash, u.status]);
    }
  }

  // 4. Catalog Products & Categories (ProductCatalogSeeder)
  // Harga di seeder adalah harga NETT (sudah termasuk Tax 10% dan Service 5%).
  // Base price (DPP) = nett / 1.155
  const catalog = [
    { category: 'Mahjong Room', sku: 'MJ-1H', name: 'Sewa Mahjong 1 Jam', nett: 85000 },
    { category: 'Cafe', sku: 'CF-LATTE', name: 'Iced Latte', nett: 35000, cost_price: 18000, track_stock: 1, stock: 42 },
    { category: 'Cafe', sku: 'CF-SNACK', name: 'Platter Snack', nett: 65000, cost_price: 32000, track_stock: 1, stock: 24 },
    { category: 'Bowling', sku: 'BW-LANE', name: 'Bowling Lane 1 Game', nett: 55000 },
    { category: 'Mahjong Room', sku: 'QR-ROOM', name: 'Private Room 2 Jam', nett: 180000 },
    { category: 'Mahjong', sku: 'PLAYHUB-01-WEEKEND', name: 'PlayHub 1 Weekend', nett: 30000 },
    { category: 'Board Game', sku: 'PLAYHUB-02-WEEKDAY', name: 'PlayHub 2', nett: 25000 },
    { category: 'Board Game', sku: 'PLAYHUB-02-WEEKEND', name: 'PlayHub 2 Weekend', nett: 30000 },
    { category: 'Board Game Premium', sku: 'PLAYHUB-03-WEEKDAY', name: 'PlayHub 3', nett: 40000 },
    { category: 'Board Game Premium', sku: 'PLAYHUB-03-WEEKEND', name: 'PlayHub 3 Weekend', nett: 50000 },
    { category: 'Billiard', sku: 'PLAYHUB-04-WEEKDAY', name: 'PlayHub 4', nett: 50000 },
    { category: 'Billiard', sku: 'PLAYHUB-04-WEEKEND', name: 'PlayHub 4 Weekend', nett: 60000 },
    { category: 'Domino', sku: 'PLAYHUB-05-WEEKDAY', name: 'PlayHub 5', nett: 20000 },
    { category: 'Domino', sku: 'PLAYHUB-05-WEEKEND', name: 'PlayHub 5 Weekend', nett: 20000 },
    { category: 'Bridge', sku: 'PLAYHUB-06-WEEKDAY', name: 'PlayHub 6', nett: 40000 },
    { category: 'Bridge', sku: 'PLAYHUB-06-WEEKEND', name: 'PlayHub 6 Weekend', nett: 40000 },
    { category: 'VIP Room', sku: 'PLAYHUB-07-WEEKDAY', name: 'PlayHub 7', nett: 200000 },
    { category: 'VIP Room', sku: 'PLAYHUB-07-WEEKEND', name: 'PlayHub 7 Weekend', nett: 250000 },
    { category: 'Mahjong Package 3 Jam', sku: 'PACKAGE-PLAYHUB-01-WEEKEND', name: 'Paket PlayHub 1 Weekend', nett: 70000 },
    { category: 'Billiard Package 2 Jam', sku: 'PACKAGE-PLAYHUB-02-WEEKDAY', name: 'Paket PlayHub 2', nett: 90000 },
    { category: 'Billiard Package 2 Jam', sku: 'PACKAGE-PLAYHUB-02-WEEKEND', name: 'Paket PlayHub 2 Weekend', nett: 110000 }
  ];

  const categoryMap = {};
  for (const item of catalog) {
    if (!categoryMap[item.category]) {
      const [existing] = await pool.query('SELECT id FROM categories WHERE name = ?', [item.category]);
      if (existing.length > 0) {
        categoryMap[item.category] = existing[0].id;
      } else {
        const [res] = await pool.query('INSERT INTO categories (name, description, is_active, created_at, updated_at) VALUES (?, NULL, 1, NOW(), NOW())', [item.category]);
        categoryMap[item.category] = res.insertId;
      }
    }
  }

  for (const item of catalog) {
    const catId = categoryMap[item.category];
    const sellPrice = parseFloat((item.nett / 1.155).toFixed(2));
    const costPrice = item.cost_price || 0;
    const trackStock = item.track_stock || 0;
    const stock = item.stock || 0;

    const [existing] = await pool.query('SELECT id FROM products WHERE sku = ?', [item.sku]);
    if (existing.length > 0) {
      await pool.query(`
        UPDATE products 
        SET category_id = ?, name = ?, sell_price = ?, cost_price = ?, track_stock = ?, is_active = 1, updated_at = NOW() 
        WHERE id = ?
      `, [catId, item.name, sellPrice, costPrice, trackStock, existing[0].id]);
    } else {
      await pool.query(`
        INSERT INTO products (category_id, sku, barcode, name, photo, cost_price, sell_price, stock, track_stock, is_active, created_at, updated_at)
        VALUES (?, ?, NULL, ?, NULL, ?, ?, ?, ?, 1, NOW(), NOW())
      `, [catId, item.sku, item.name, costPrice, sellPrice, stock, trackStock]);
    }
  }

  // 5. Tables (18 Tables A01 - C06)
  for (let index = 0; index < 18; index++) {
    const col = index % 6;
    const row = Math.floor(index / 6);
    const number = String.fromCharCode(65 + row) + String(col + 1).padStart(2, '0');
    const name = 'Table ' + number;
    const posX = 40 + (col * 128);
    const posY = 42 + (row * 116);
    const notes = index % 5 === 0 ? 'Dekat VIP lounge' : null;

    const [existing] = await pool.query('SELECT id FROM tables WHERE number = ?', [number]);
    if (existing.length === 0) {
      await pool.query(`
        INSERT INTO tables (name, number, position_x, position_y, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'available', ?, NOW(), NOW())
      `, [name, number, posX, posY, notes]);
    }
  }

  console.log('Seeding completed successfully with Laravel parity!');
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Seeding Error:', err);
    process.exit(1);
  });
