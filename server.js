const express = require('express');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database
const dbPath = path.join(__dirname, 'chio_chio.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    secret_key TEXT NOT NULL,
    name TEXT DEFAULT 'Управляющий',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT '',
    visits_count INTEGER DEFAULT 0,
    free_haircuts_received INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_visit_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS masters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    specialization TEXT DEFAULT 'Барбер-стилист',
    phone TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    total_earnings REAL DEFAULT 0,
    current_balance REAL DEFAULT 0,
    cuts_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    duration_min INTEGER DEFAULT 15,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT 'scissors',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    client_phone TEXT NOT NULL,
    client_name TEXT DEFAULT '',
    master_id INTEGER NOT NULL,
    master_name TEXT NOT NULL,
    service_id INTEGER NOT NULL,
    service_name TEXT NOT NULL,
    original_price REAL NOT NULL,
    discount_amount REAL DEFAULT 0,
    final_price REAL NOT NULL,
    master_share REAL NOT NULL,
    salon_share REAL NOT NULL,
    is_free INTEGER DEFAULT 0,
    payment_method TEXT DEFAULT 'sbp_qr',
    payment_status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    master_id INTEGER NOT NULL,
    master_name TEXT NOT NULL,
    amount REAL NOT NULL,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default data if empty
function seedDatabase() {
  // 1. Admin account
  const adminCheck = db.prepare('SELECT COUNT(*) as count FROM admins').get();
  if (adminCheck.count === 0) {
    db.prepare('INSERT INTO admins (username, secret_key, name) VALUES (?, ?, ?)')
      .run('admin', 'chio2026', 'Главный администратор');
    console.log('✅ Default admin created: login=admin, secret_key=chio2026');
  }

  // 2. Settings
  const settingCheck = db.prepare('SELECT COUNT(*) as count FROM settings').get();
  if (settingCheck.count === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('salon_name', 'ЧИО ЧИО — Экспресс-парикмахерская');
    insertSetting.run('master_commission_percent', '50');
    insertSetting.run('subsidize_free_cut_for_master', 'true'); // Salon pays master 50% of nominal price even if client has 3rd free cut!
    insertSetting.run('loyalty_frequency', '3'); // Every 3rd haircut is free
  }

  // 3. Masters
  const mastersCheck = db.prepare('SELECT COUNT(*) as count FROM masters').get();
  if (mastersCheck.count === 0) {
    const insertMaster = db.prepare(`
      INSERT INTO masters (name, specialization, phone, avatar_url, active, total_earnings, current_balance, cuts_count)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `);

    insertMaster.run('Артем Волков', 'Топ-Барбер • Скоростной фейд', '+7 (999) 111-22-33', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80', 12500, 3500, 42);
    insertMaster.run('Даниил Ким', 'Мастер экспресс-стрижек', '+7 (999) 222-33-44', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80', 9800, 2400, 36);
    insertMaster.run('Елена Соколова', 'Стилист-универсал • Модельные стрижки', '+7 (999) 333-44-55', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80', 14200, 4100, 48);
    insertMaster.run('Тимур Алиев', 'Барбер • Бороды и геометрия', '+7 (999) 444-55-66', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80', 8600, 1900, 29);
    console.log('✅ Default masters seeded');
  }

  // 4. Services
  const servicesCheck = db.prepare('SELECT COUNT(*) as count FROM services').get();
  if (servicesCheck.count === 0) {
    const insertService = db.prepare(`
      INSERT INTO services (name, price, duration_min, description, icon, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    insertService.run('Мужская экспресс-стрижка', 500, 15, 'Классическая, модельная или спортивная стрижка за 15 минут по японской технологии', 'scissors');
    insertService.run('Стрижка машинкой (1-2 насадки)', 350, 10, 'Быстрая однородная стрижка под насадку с чистой окантовкой', 'zap');
    insertService.run('Оформление бороды и усов', 400, 15, 'Четкие контуры, снятие длины, бритье шеи шейвером и масло для ухода', 'smile');
    insertService.run('Комплекс: Стрижка + Борода', 800, 25, 'Полный образ: фирменная стрижка волос и детальное оформление бороды', 'sparkles');
    insertService.run('Детская стрижка (до 12 лет)', 450, 15, 'Быстрая и комфортная стрижка без слез в специальном кресле', 'heart');
    insertService.run('Премиум комплекс с мытьем и укладкой', 1000, 30, 'Мытье головы, модельная стрижка, распаривание, окантовка и стайлинг', 'crown');
    console.log('✅ Default services seeded');
  }

  // 5. Sample client for demonstration
  const clientCheck = db.prepare('SELECT COUNT(*) as count FROM clients').get();
  if (clientCheck.count === 0) {
    const insertClient = db.prepare(`
      INSERT INTO clients (phone, name, visits_count, free_haircuts_received, last_visit_at)
      VALUES (?, ?, ?, ?, datetime('now', '-2 days'))
    `);
    // Sample client with 2 visits -> next is 3rd (FREE!)
    insertClient.run('+7 (900) 123-45-67', 'Максим Иванов', 2, 0);
    // Sample client with 0 visits
    insertClient.run('+7 (911) 777-88-99', 'Александр', 0, 0);
    // Sample client with 3 visits (already had 1 free)
    insertClient.run('+7 (922) 555-44-33', 'Дмитрий', 3, 1);
    console.log('✅ Demo clients seeded');
  }
}

seedDatabase();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Helper to sanitize phone strictly to 11 digits
function sanitizePhone(raw) {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '7' + digits;
  } else if (digits.length === 11 && digits[0] === '8') {
    digits = '7' + digits.slice(1);
  } else if (digits.length === 11 && digits[0] === '7') {
    // Valid 11 digits with 7
  } else {
    return null;
  }
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

// Admin Auth Middleware
function requireAdmin(req, res, next) {
  const secretKey = req.headers['x-admin-key'] || req.query.admin_key || req.body.admin_key;
  if (!secretKey) {
    return res.status(401).json({ error: 'Требуется секретный ключ администратора' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE secret_key = ?').get(secretKey);
  if (!admin) {
    return res.status(403).json({ error: 'Неверный секретный ключ' });
  }

  req.admin = admin;
  next();
}

/* ==========================================================================
   PUBLIC & CLIENT APIS
   ========================================================================== */

// 1. Get Public Salon Info
app.get('/api/salon/info', (req, res) => {
  const settingsRows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  settingsRows.forEach(row => { settings[row.key] = row.value; });

  const totalCuts = db.prepare('SELECT COUNT(*) as total FROM orders').get();
  const freeCuts = db.prepare('SELECT COUNT(*) as free FROM orders WHERE is_free = 1').get();

  res.json({
    name: settings.salon_name || 'ЧИО ЧИО — Экспресс-парикмахерская',
    loyaltyFrequency: parseInt(settings.loyalty_frequency || '3', 10),
    totalCuts: totalCuts.total + 155, // Including offline baseline
    freeCuts: freeCuts.free + 51,
  });
});

// 2. Get active services
app.get('/api/services', (req, res) => {
  const services = db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY price ASC').all();
  res.json(services);
});

// 3. Get active masters
app.get('/api/masters', (req, res) => {
  const masters = db.prepare('SELECT id, name, specialization, avatar_url, cuts_count FROM masters WHERE active = 1 ORDER BY cuts_count DESC').all();
  res.json(masters);
});

// 4. Client Search / Register by Phone
app.post('/api/client/lookup', (req, res) => {
  let { phone, name } = req.body;
  const formattedPhone = sanitizePhone(phone);

  if (!formattedPhone) {
    return res.status(400).json({ error: 'Пожалуйста, введите полный номер телефона из 11 цифр (+7 XXX XXX-XX-XX)' });
  }

  let client = db.prepare('SELECT * FROM clients WHERE phone = ?').get(formattedPhone);

  if (!client) {
    // Register new client
    const insertStmt = db.prepare('INSERT INTO clients (phone, name, visits_count) VALUES (?, ?, 0)');
    const result = insertStmt.run(formattedPhone, name || '');
    client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
  } else if (name && !client.name) {
    db.prepare('UPDATE clients SET name = ? WHERE id = ?').run(name, client.id);
    client.name = name;
  }

  const visits = client.visits_count;
  // Loyalty cycle: 1, 2, 3 -> visit 3 is free!
  // visits = 0 -> current is visit #1
  // visits = 1 -> current is visit #2
  // visits = 2 -> current is visit #3 (FREE!)
  const cycleStep = (visits % 3) + 1; // 1, 2, or 3
  const isNextFree = (cycleStep === 3);

  // Get past orders
  const orders = db.prepare(`
    SELECT id, service_name, master_name, final_price, is_free, payment_method, created_at
    FROM orders
    WHERE client_phone = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(formattedPhone);

  res.json({
    client: {
      ...client,
      cycleStep, // 1, 2, or 3
      isNextFree, // true if this haircut will be free (3rd)
      remainingToFree: isNextFree ? 0 : (3 - cycleStep)
    },
    history: orders
  });
});

// 5. Checkout & Payment Flow
app.post('/api/checkout', (req, res) => {
  let { phone, name, serviceId, masterId, paymentMethod } = req.body;
  const formattedPhone = sanitizePhone(phone);

  if (!formattedPhone) {
    return res.status(400).json({ error: 'Пожалуйста, введите полный номер телефона из 11 цифр (+7 XXX XXX-XX-XX)' });
  }
  if (!serviceId) {
    return res.status(400).json({ error: 'Выберите стрижку / услугу' });
  }
  if (!masterId) {
    return res.status(400).json({ error: 'Выберите мастера, который выполнил стрижку' });
  }

  // Get service
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  if (!service) {
    return res.status(404).json({ error: 'Услуга не найдена' });
  }

  // Get master
  const master = db.prepare('SELECT * FROM masters WHERE id = ?').get(masterId);
  if (!master) {
    return res.status(404).json({ error: 'Мастер не найден' });
  }

  // Find or create client
  let client = db.prepare('SELECT * FROM clients WHERE phone = ?').get(formattedPhone);
  if (!client) {
    const insert = db.prepare('INSERT INTO clients (phone, name, visits_count) VALUES (?, ?, 0)');
    const r = insert.run(formattedPhone, name || '');
    client = db.prepare('SELECT * FROM clients WHERE id = ?').get(r.lastInsertRowid);
  } else if (name && !client.name) {
    db.prepare('UPDATE clients SET name = ? WHERE id = ?').run(name, client.id);
  }

  // Check 3rd haircut rule:
  // If visits_count % 3 === 2 (e.g. 2 visits done, this is 3rd!)
  const isFree = (client.visits_count % 3 === 2);
  const originalPrice = service.price;
  let finalPrice = originalPrice;
  let discountAmount = 0;

  if (isFree) {
    discountAmount = originalPrice;
    finalPrice = 0; // Completely free for the customer!
  }

  // Master share calculation:
  // "50% этой суммы приходило на мастера который подстригал"
  // For free haircuts: salon subsidizes master 50% of the normal price so the master is rewarded!
  const subsidizeRow = db.prepare("SELECT value FROM settings WHERE key = 'subsidize_free_cut_for_master'").get();
  const shouldSubsidize = (subsidizeRow && subsidizeRow.value === 'true');

  let masterShare = 0;
  let salonShare = 0;

  if (isFree) {
    if (shouldSubsidize) {
      masterShare = originalPrice * 0.50; // Salon pays master their 50%
      salonShare = -(originalPrice * 0.50); // Promotional investment by salon
    } else {
      masterShare = 0;
      salonShare = 0;
    }
  } else {
    masterShare = finalPrice * 0.50;
    salonShare = finalPrice * 0.50;
  }

  // Insert order
  const orderInsert = db.prepare(`
    INSERT INTO orders (
      client_id, client_phone, client_name,
      master_id, master_name,
      service_id, service_name,
      original_price, discount_amount, final_price,
      master_share, salon_share,
      is_free, payment_method, payment_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
  `);

  const orderResult = orderInsert.run(
    client.id,
    formattedPhone,
    name || client.name || 'Клиент',
    master.id,
    master.name,
    service.id,
    service.name,
    originalPrice,
    discountAmount,
    finalPrice,
    masterShare,
    salonShare,
    isFree ? 1 : 0,
    paymentMethod || 'sbp_qr'
  );

  const orderId = orderResult.lastInsertRowid;

  // Update client visit count
  const newVisits = client.visits_count + 1;
  const newFreeCount = client.free_haircuts_received + (isFree ? 1 : 0);
  db.prepare(`
    UPDATE clients
    SET visits_count = ?,
        free_haircuts_received = ?,
        last_visit_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newVisits, newFreeCount, client.id);

  // Update master balance & stats (50% credited to master)
  db.prepare(`
    UPDATE masters
    SET total_earnings = total_earnings + ?,
        current_balance = current_balance + ?,
        cuts_count = cuts_count + 1
    WHERE id = ?
  `).run(masterShare, masterShare, master.id);

  const updatedMaster = db.prepare('SELECT id, name, current_balance, total_earnings, cuts_count FROM masters WHERE id = ?').get(master.id);

  res.json({
    success: true,
    orderId,
    receipt: {
      orderId,
      date: new Date().toISOString(),
      clientPhone: formattedPhone,
      clientName: name || client.name || 'Клиент',
      serviceName: service.name,
      originalPrice,
      discountAmount,
      finalPrice,
      isFree,
      paymentMethod: paymentMethod || 'sbp_qr',
      masterName: master.name,
      masterShare,
      salonShare,
      visitsCount: newVisits,
      nextCycleStep: (newVisits % 3) + 1,
      celebrationMessage: isFree
        ? '🎉 Ваша 3-я стрижка в ЧИО ЧИО совершенно БЕСПЛАТНАЯ! Спасибо за вашу верность!'
        : `✂️ Спасибо за визит! Это ваша стрижка #${newVisits}. До следующей бесплатной осталось: ${3 - ((newVisits % 3) || 3)}.`
    },
    masterInfo: {
      name: updatedMaster.name,
      earnedFromThisCut: masterShare,
      newBalance: updatedMaster.current_balance
    }
  });
});

// 6. Master Self-Service Portal (view own earnings by phone or ID)
app.get('/api/master/cabinet', (req, res) => {
  const { id, phone } = req.query;
  let master = null;

  if (id) {
    master = db.prepare('SELECT * FROM masters WHERE id = ?').get(id);
  } else if (phone) {
    const formatted = sanitizePhone(phone);
    master = db.prepare('SELECT * FROM masters WHERE phone = ?').get(formatted);
  }

  if (!master) {
    return res.status(404).json({ error: 'Мастер не найден' });
  }

  // Get master's recent orders
  const recentOrders = db.prepare(`
    SELECT id, client_phone, service_name, original_price, final_price, master_share, is_free, created_at
    FROM orders
    WHERE master_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(master.id);

  // Today's earnings
  const today = db.prepare(`
    SELECT COALESCE(SUM(master_share), 0) as today_earnings, COUNT(*) as today_cuts
    FROM orders
    WHERE master_id = ? AND date(created_at) = date('now')
  `).get(master.id);

  res.json({
    master: {
      id: master.id,
      name: master.name,
      specialization: master.specialization,
      avatar_url: master.avatar_url,
      cuts_count: master.cuts_count,
      total_earnings: master.total_earnings,
      current_balance: master.current_balance,
      today_earnings: today.today_earnings,
      today_cuts: today.today_cuts
    },
    orders: recentOrders
  });
});

/* ==========================================================================
   ADMIN APIS (Protected by Secret Key & Login)
   ========================================================================== */

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, secret_key } = req.body;

  if (!username || !secret_key) {
    return res.status(400).json({ error: 'Введите логин и секретный ключ' });
  }

  const admin = db.prepare('SELECT id, username, name FROM admins WHERE username = ? AND secret_key = ?').get(username, secret_key);

  if (!admin) {
    return res.status(401).json({ error: 'Неверный логин или секретный ключ' });
  }

  res.json({
    success: true,
    admin: {
      id: admin.id,
      username: admin.username,
      name: admin.name
    },
    secret_key: secret_key
  });
});

// Admin Dashboard Summary
app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
  const totalRevenue = db.prepare('SELECT COALESCE(SUM(final_price), 0) as total FROM orders').get();
  const totalMasterShare = db.prepare('SELECT COALESCE(SUM(master_share), 0) as total FROM orders').get();
  const totalSalonShare = db.prepare('SELECT COALESCE(SUM(salon_share), 0) as total FROM orders').get();
  const totalOrders = db.prepare('SELECT COUNT(*) as total FROM orders').get();
  const freeOrders = db.prepare('SELECT COUNT(*) as total FROM orders WHERE is_free = 1').get();

  const todayRevenue = db.prepare("SELECT COALESCE(SUM(final_price), 0) as total FROM orders WHERE date(created_at) = date('now')").get();
  const todayCuts = db.prepare("SELECT COUNT(*) as total FROM orders WHERE date(created_at) = date('now')").get();

  const totalClients = db.prepare('SELECT COUNT(*) as total FROM clients').get();
  const mastersCount = db.prepare('SELECT COUNT(*) as total FROM masters WHERE active = 1').get();

  // Top masters
  const topMasters = db.prepare(`
    SELECT id, name, cuts_count, total_earnings, current_balance, avatar_url
    FROM masters
    ORDER BY total_earnings DESC
    LIMIT 5
  `).all();

  // Recent 10 orders
  const recentOrders = db.prepare(`
    SELECT * FROM orders ORDER BY created_at DESC LIMIT 10
  `).all();

  res.json({
    summary: {
      totalRevenue: totalRevenue.total,
      totalMasterShare: totalMasterShare.total,
      totalSalonShare: totalSalonShare.total,
      totalOrders: totalOrders.total,
      freeOrders: freeOrders.total,
      todayRevenue: todayRevenue.total,
      todayCuts: todayCuts.total,
      totalClients: totalClients.total,
      mastersCount: mastersCount.total
    },
    topMasters,
    recentOrders
  });
});

// Admin Masters: List All
app.get('/api/admin/masters', requireAdmin, (req, res) => {
  const masters = db.prepare('SELECT * FROM masters ORDER BY id DESC').all();
  res.json(masters);
});

// Admin Masters: Add New
app.post('/api/admin/masters', requireAdmin, (req, res) => {
  const { name, specialization, phone, avatar_url } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Укажите ФИО мастера' });
  }

  const defaultAvatar = `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80`;

  const stmt = db.prepare(`
    INSERT INTO masters (name, specialization, phone, avatar_url, active)
    VALUES (?, ?, ?, ?, 1)
  `);

  const result = stmt.run(
    name.trim(),
    specialization || 'Барбер-стилист',
    sanitizePhone(phone),
    avatar_url || defaultAvatar
  );

  const newMaster = db.prepare('SELECT * FROM masters WHERE id = ?').get(result.lastInsertRowid);
  res.json(newMaster);
});

// Admin Masters: Update
app.put('/api/admin/masters/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, specialization, phone, avatar_url, active } = req.body;

  const master = db.prepare('SELECT * FROM masters WHERE id = ?').get(id);
  if (!master) {
    return res.status(404).json({ error: 'Мастер не найден' });
  }

  db.prepare(`
    UPDATE masters
    SET name = COALESCE(?, name),
        specialization = COALESCE(?, specialization),
        phone = COALESCE(?, phone),
        avatar_url = COALESCE(?, avatar_url),
        active = COALESCE(?, active)
    WHERE id = ?
  `).run(
    name !== undefined ? name.trim() : null,
    specialization !== undefined ? specialization.trim() : null,
    phone !== undefined ? sanitizePhone(phone) : null,
    avatar_url !== undefined ? avatar_url.trim() : null,
    active !== undefined ? Number(active) : null,
    id
  );

  const updated = db.prepare('SELECT * FROM masters WHERE id = ?').get(id);
  res.json(updated);
});

// Admin Masters: Payout to Master
app.post('/api/admin/masters/:id/payout', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { amount, notes } = req.body;

  const master = db.prepare('SELECT * FROM masters WHERE id = ?').get(id);
  if (!master) {
    return res.status(404).json({ error: 'Мастер не найден' });
  }

  const payoutAmount = amount ? parseFloat(amount) : master.current_balance;

  if (payoutAmount <= 0) {
    return res.status(400).json({ error: 'Сумма выплаты должна быть больше 0' });
  }
  if (payoutAmount > master.current_balance) {
    return res.status(400).json({ error: `Сумма выплаты превышает текущий баланс мастера (${master.current_balance} ₽)` });
  }

  // Deduct from balance
  db.prepare('UPDATE masters SET current_balance = current_balance - ? WHERE id = ?').run(payoutAmount, id);

  // Record payout
  db.prepare(`
    INSERT INTO payouts (master_id, master_name, amount, notes)
    VALUES (?, ?, ?, ?)
  `).run(master.id, master.name, payoutAmount, notes || 'Выплата 50% доли за стрижки');

  const updated = db.prepare('SELECT * FROM masters WHERE id = ?').get(id);

  res.json({
    success: true,
    message: `Выплачено ${payoutAmount} ₽ мастеру ${master.name}`,
    master: updated
  });
});

// Admin Masters: Delete / Deactivate
app.delete('/api/admin/masters/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE masters SET active = 0 WHERE id = ?').run(id);
  res.json({ success: true, message: 'Мастер деактивирован' });
});

// Admin Services: List All
app.get('/api/admin/services', requireAdmin, (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY id DESC').all();
  res.json(services);
});

// Admin Services: Add New
app.post('/api/admin/services', requireAdmin, (req, res) => {
  const { name, price, duration_min, description, icon } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Укажите название стрижки/услуги' });
  }
  if (!price || isNaN(price) || Number(price) < 0) {
    return res.status(400).json({ error: 'Укажите корректную стоимость услуги' });
  }

  const stmt = db.prepare(`
    INSERT INTO services (name, price, duration_min, description, icon, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  const result = stmt.run(
    name.trim(),
    parseFloat(price),
    duration_min ? parseInt(duration_min, 10) : 15,
    description || '',
    icon || 'scissors'
  );

  const newService = db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid);
  res.json(newService);
});

// Admin Services: Update
app.put('/api/admin/services/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, price, duration_min, description, icon, active } = req.body;

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (!service) {
    return res.status(404).json({ error: 'Услуга не найдена' });
  }

  db.prepare(`
    UPDATE services
    SET name = COALESCE(?, name),
        price = COALESCE(?, price),
        duration_min = COALESCE(?, duration_min),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon),
        active = COALESCE(?, active)
    WHERE id = ?
  `).run(
    name !== undefined ? name.trim() : null,
    price !== undefined ? parseFloat(price) : null,
    duration_min !== undefined ? parseInt(duration_min, 10) : null,
    description !== undefined ? description.trim() : null,
    icon !== undefined ? icon.trim() : null,
    active !== undefined ? Number(active) : null,
    id
  );

  const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  res.json(updated);
});

// Admin Services: Delete / Deactivate
app.delete('/api/admin/services/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(id);
  res.json({ success: true, message: 'Услуга деактивирована' });
});

// Admin Orders: All orders list with filters
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const { master_id, phone } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (master_id) {
    sql += ' AND master_id = ?';
    params.push(master_id);
  }
  if (phone) {
    sql += ' AND client_phone LIKE ?';
    params.push(`%${phone}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT 100';

  const orders = db.prepare(sql).all(...params);
  res.json(orders);
});

// Admin Clients: All clients list
app.get('/api/admin/clients', requireAdmin, (req, res) => {
  const { query } = req.query;
  let sql = 'SELECT * FROM clients';
  const params = [];

  if (query) {
    sql += ' WHERE phone LIKE ? OR name LIKE ?';
    params.push(`%${query}%`, `%${query}%`);
  }

  sql += ' ORDER BY last_visit_at DESC, id DESC LIMIT 100';

  const clients = db.prepare(sql).all(...params);
  res.json(clients);
});

// Admin Payouts list
app.get('/api/admin/payouts', requireAdmin, (req, res) => {
  const payouts = db.prepare('SELECT * FROM payouts ORDER BY created_at DESC LIMIT 50').all();
  res.json(payouts);
});

// Admin Settings: Get & Update
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const settingsRows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  settingsRows.forEach(row => { settings[row.key] = row.value; });
  res.json(settings);
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const updates = req.body;
  const updateStmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  for (const [key, value] of Object.entries(updates)) {
    updateStmt.run(key, String(value));
  }

  res.json({ success: true, message: 'Настройки обновлены' });
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`💈 ЧИО ЧИО Сервер экспресс-парикмахерской запущен на http://localhost:${PORT}`);
  console.log(`🔐 Админ-панель: Логин: admin | Ключ: chio2026`);
});
