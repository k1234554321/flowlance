require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');

const { isDbEnabled, getPool, disableDb } = require('./db');
const { getFallbackOffers, fetchExternalOffers, sanitizeExternalUrl } = require('./services/aggregator');
const { askAi } = require('./services/aiProxy');
const { validateEmail, validatePassword, validateName } = require('./services/validation');
const fs = require('fs').promises;

const SITE_CONTENT_PATH = path.join(__dirname, 'data', 'siteContent.json');
const TICKETS_PATH = path.join(__dirname, 'data', 'tickets.json');
const REVIEWS_PENDING_PATH = path.join(__dirname, 'data', 'reviewsPending.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const inMemoryOffers = new Map();
// In-memory хранилище пользователей для демо-режима (без MySQL)
const inMemoryUsers = new Map(); // key: email, value: { id, name, email, password_hash, role, bio, avatar_url, created_at }
let inMemoryUserIdSeq = 2; // 1 зарезервирован под admin

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
  })
);
app.use(express.static(path.join(__dirname, 'public')));

function formatOffer(offer) {
  return {
    ...offer,
    budget: `${offer.budget_min} - ${offer.budget_max} ${offer.currency}`,
    external_url: sanitizeExternalUrl(offer.external_url, offer.source),
  };
}

async function fillMemoryOffersIfEmpty() {
  if (inMemoryOffers.size > 0) return;
  const external = await fetchExternalOffers(16);
  const fallback = await getFallbackOffers(20);
  [...external, ...fallback].forEach((row) => inMemoryOffers.set(row.id, row));
}

function memoryOffersSorted(limit) {
  return [...inMemoryOffers.values()]
    .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime())
    .slice(0, limit);
}

async function respondOffersFromMemory(limit, res) {
  await fillMemoryOffersIfEmpty();
  res.json(memoryOffersSorted(limit).map(formatOffer));
}

async function getOfferById(id) {
  const sid = String(id || '').trim();
  if (!sid) return null;
  if (inMemoryOffers.has(sid)) return inMemoryOffers.get(sid);
  if (!isDbEnabled()) return null;
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM offers WHERE id = ? LIMIT 1', [sid]);
    return rows[0] || null;
  } catch {
    return null;
  }
}

function ensureFavorites(req) {
  if (!Array.isArray(req.session.favorites)) req.session.favorites = [];
  return req.session.favorites;
}

async function readReviewsPending() {
  try {
    const raw = await fs.readFile(REVIEWS_PENDING_PATH, 'utf8');
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

async function writeReviewsPending(list) {
  await fs.mkdir(path.dirname(REVIEWS_PENDING_PATH), { recursive: true });
  await fs.writeFile(REVIEWS_PENDING_PATH, JSON.stringify(list, null, 2), 'utf8');
}

/** Совместимо с MySQL 5.7 / MariaDB (без ADD COLUMN IF NOT EXISTS). */
async function ensureOffersExternalUrlColumn(pool) {
  try {
    await pool.query(`ALTER TABLE offers ADD COLUMN external_url VARCHAR(500) DEFAULT ''`);
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME' || error.errno === 1060) return;
    throw error;
  }
}

async function ensureDb() {
  // Всегда создаём admin в in-memory хранилище (нужен и при MySQL, и без него)
  const adminEmail = String(process.env.DEFAULT_ADMIN_EMAIL || 'admin@aggregator.local').toLowerCase();
  if (!inMemoryUsers.has(adminEmail)) {
    const passwordHash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin12345', 10);
    inMemoryUsers.set(adminEmail, {
      id: 1,
      name: 'Administrator',
      email: adminEmail,
      password_hash: passwordHash,
      role: 'admin',
      bio: 'Главный администратор платформы',
      avatar_url: '',
      created_at: new Date().toISOString(),
    });
  }

  if (!isDbEnabled()) return;
  try {
    const pool = getPool();
    await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(120) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      avatar_url VARCHAR(255) DEFAULT '',
      role ENUM('user', 'admin') DEFAULT 'user',
      subscription ENUM('basic','pro','proplus') DEFAULT 'basic',
      bio TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Добавляем колонку subscription если её нет (для существующих БД)
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN subscription ENUM('basic','pro','proplus') DEFAULT 'basic'`);
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) throw e; }
    await pool.query(`
    CREATE TABLE IF NOT EXISTS offers (
      id VARCHAR(40) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      source VARCHAR(120) NOT NULL,
      category VARCHAR(80) NOT NULL,
      budget_min INT NOT NULL,
      budget_max INT NOT NULL,
      currency VARCHAR(10) NOT NULL,
      external_url VARCHAR(500) DEFAULT '',
      posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id VARCHAR(40) PRIMARY KEY,
      email VARCHAR(120) NOT NULL,
      name VARCHAR(120) DEFAULT '',
      subject VARCHAR(200) NOT NULL,
      body TEXT NOT NULL,
      status VARCHAR(40) DEFAULT 'new',
      admin_reply TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews_pending (
      id VARCHAR(60) PRIMARY KEY,
      user_id INT DEFAULT NULL,
      name VARCHAR(80) NOT NULL,
      email VARCHAR(120) DEFAULT '',
      text TEXT NOT NULL,
      rating TINYINT DEFAULT 5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      item_id VARCHAR(60) NOT NULL,
      equipped TINYINT(1) DEFAULT 0,
      bought_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_item (user_id, item_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      offer_id VARCHAR(40) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_fav (user_id, offer_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
    await ensureOffersExternalUrlColumn(pool);
    // tracker columns
    for (const sql of [
      "ALTER TABLE users ADD COLUMN tracker_xp INT DEFAULT 0",
      "ALTER TABLE users ADD COLUMN tracker_level INT DEFAULT 1",
      "ALTER TABLE users ADD COLUMN tracker_coins INT DEFAULT 0",
    ]) {
      await pool.query(sql).catch(e => { if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) {} });
    }
    await pool.query(
      `UPDATE offers SET external_url = '' WHERE external_url LIKE '%google.com%'`
    ).catch(() => {});

    const [users] = await pool.query('SELECT id FROM users WHERE role = "admin" LIMIT 1');
    if (users.length === 0) {
      const passwordHash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin12345', 10);
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, bio)
       VALUES (?, ?, ?, 'admin', ?)`,
        ['Administrator', process.env.DEFAULT_ADMIN_EMAIL || 'admin@aggregator.local', passwordHash, 'Главный администратор платформы']
      );
    }
  } catch (error) {
    const denied =
      error.code === 'ER_ACCESS_DENIED_ERROR' ||
      error.errno === 1045 ||
      String(error.message || '').includes('Access denied');
    const connectionLost = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST'].includes(
      error.code
    );
    if (denied || connectionLost) {
      disableDb();
      const hint = denied
        ? ' Проверь .env: DB_USER и DB_PASSWORD должны совпадать с пользователем MySQL.'
        : '';
      console.warn('MySQL недоступен — режим без БД (данные в памяти). Ошибка:', error.message + hint);
    } else {
      console.error('Ошибка миграции/схемы MySQL (сервер продолжит с БД):', error.message);
    }
  }
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Только для администратора' });
  }
  next();
}

async function readSiteContent() {
  try {
    const raw = await fs.readFile(SITE_CONTENT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('readSiteContent:', error.message);
    return null;
  }
}

function defaultCabinetState() {
  return {
    coins: 0,
    projectTaskProgress: 0,
    lastClaimDate: null,
    vkConnected: false,
    googleConnected: false,
    yandexConnected: false,
    profileBonusClaimed: false,
    projectsBonusClaimed: false
  };
}

function ensureCabinetSession(req) {
  if (!req.session.cabinet) req.session.cabinet = defaultCabinetState();
  return req.session.cabinet;
}

app.get('/api/site/content', async (_, res) => {
  const data = await readSiteContent();
  if (!data) return res.status(500).json({ error: 'Не удалось загрузить контент главной страницы' });
  res.json(data);
});

app.get('/api/admin/site/content', requireAdmin, async (_, res) => {
  const data = await readSiteContent();
  if (!data) return res.status(500).json({ error: 'Не удалось прочитать siteContent.json' });
  res.json(data);
});

app.put('/api/admin/site/content', requireAdmin, async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Нужен JSON-объект с полями контента' });
    }
    await fs.mkdir(path.dirname(SITE_CONTENT_PATH), { recursive: true });
    await fs.writeFile(SITE_CONTENT_PATH, JSON.stringify(body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function readTicketsFile() {
  try {
    const raw = await fs.readFile(TICKETS_PATH, 'utf8');
    const j = JSON.parse(raw);
    return Array.isArray(j.tickets) ? j.tickets : [];
  } catch {
    return [];
  }
}

async function writeTicketsFile(tickets) {
  await fs.mkdir(path.dirname(TICKETS_PATH), { recursive: true });
  await fs.writeFile(TICKETS_PATH, JSON.stringify({ tickets }, null, 2), 'utf8');
}

app.post('/api/tickets', async (req, res) => {
  const { email, name, subject, body } = req.body || {};
  if (!email || !subject || !body) {
    return res.status(400).json({ error: 'Нужны email, тема и текст обращения' });
  }
  const tickets = await readTicketsFile();
  const id = `t${Date.now()}`;
  const row = {
    id,
    createdAt: new Date().toISOString(),
    email: String(email).slice(0, 120),
    name: String(name || '').slice(0, 120),
    subject: String(subject).slice(0, 200),
    body: String(body).slice(0, 4000),
    status: 'new',
    adminReply: '',
    updatedAt: new Date().toISOString()
  };
  tickets.unshift(row);
  await writeTicketsFile(tickets.slice(0, 500));
  res.json({ ok: true, id });
});

app.get('/api/admin/tickets', requireAdmin, async (_, res) => {
  const tickets = await readTicketsFile();
  res.json({ tickets });
});

app.patch('/api/admin/tickets/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, adminReply } = req.body || {};
  const tickets = await readTicketsFile();
  const idx = tickets.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Тикет не найден' });
  if (typeof status === 'string') tickets[idx].status = status.slice(0, 40);
  if (typeof adminReply === 'string') tickets[idx].adminReply = adminReply.slice(0, 4000);
  tickets[idx].updatedAt = new Date().toISOString();
  await writeTicketsFile(tickets);
  res.json({ ok: true, ticket: tickets[idx] });
});

app.get('/api/offers/meta', async (_, res) => {
  try {
    if (!isDbEnabled()) {
      await fillMemoryOffersIfEmpty();
      return res.json({ count: inMemoryOffers.size });
    }
    const pool = getPool();
    const [[row]] = await pool.query('SELECT COUNT(*) AS c FROM offers');
    return res.json({ count: row.c });
  } catch (error) {
    await fillMemoryOffersIfEmpty().catch(() => null);
    res.json({ count: inMemoryOffers.size });
  }
});

app.get('/api/cabinet/state', requireAuth, (req, res) => {
  res.json(ensureCabinetSession(req));
});

app.put('/api/cabinet/state', requireAuth, (req, res) => {
  const cur = ensureCabinetSession(req);
  const patch = req.body || {};
  ['vkConnected', 'googleConnected', 'yandexConnected'].forEach((key) => {
    if (typeof patch[key] === 'boolean') cur[key] = patch[key];
  });
  res.json(cur);
});

app.post('/api/cabinet/bump-project-task', requireAuth, (req, res) => {
  const cur = ensureCabinetSession(req);
  if (cur.projectTaskProgress < 10) cur.projectTaskProgress += 1;
  res.json(cur);
});

app.post('/api/cabinet/claim-daily', requireAuth, (req, res) => {
  const cur = ensureCabinetSession(req);
  const today = new Date().toISOString().slice(0, 10);
  if (cur.lastClaimDate === today) return res.status(400).json({ error: 'Уже получено сегодня' });
  cur.lastClaimDate = today;
  cur.coins += 10;
  res.json(cur);
});

app.post('/api/cabinet/claim-profile', requireAuth, (req, res) => {
  const cur = ensureCabinetSession(req);
  if (cur.profileBonusClaimed) return res.status(400).json({ error: 'Бонус уже получен' });
  const u = req.session.user;
  const filled =
    u?.name &&
    String(u.name).trim().length > 1 &&
    String(u.bio || '').trim().length > 24 &&
    String(u.avatar_url || '').trim().length > 8;
  if (!filled) return res.status(400).json({ error: 'Заполни имя, описание (25+ символов) и ссылку на аватар' });
  cur.profileBonusClaimed = true;
  cur.coins += 50;
  res.json(cur);
});

app.post('/api/cabinet/claim-projects', requireAuth, (req, res) => {
  const cur = ensureCabinetSession(req);
  if (cur.projectTaskProgress < 10) return res.status(400).json({ error: 'Сначала выполни задачу 10/10' });
  if (cur.projectsBonusClaimed) return res.status(400).json({ error: 'Бонус уже получен' });
  cur.projectsBonusClaimed = true;
  cur.coins += 100;
  res.json(cur);
});

app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/about', (_, res) => res.sendFile(path.join(__dirname, 'public', 'about.html')));
app.get('/sources', (_, res) => res.sendFile(path.join(__dirname, 'public', 'sources.html')));
app.get('/feed', (_, res) => res.sendFile(path.join(__dirname, 'public', 'feed.html')));
app.get('/dashboard', (_, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin', (_, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/auth', (_, res) => res.sendFile(path.join(__dirname, 'public', 'auth.html')));
app.get('/tracker', (_, res) => res.sendFile(path.join(__dirname, 'public', 'tracker.html')));
app.get('/pricing', (_, res) => res.sendFile(path.join(__dirname, 'public', 'pricing.html')));
app.get('/leaderboard', (_, res) => res.sendFile(path.join(__dirname, 'public', 'leaderboard.html')));
app.get('/payment', (_, res) => res.sendFile(path.join(__dirname, 'public', 'payment.html')));

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  const nameCheck = validateName(name);
  if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });
  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });
  const passCheck = validatePassword(password);
  if (!passCheck.ok) return res.status(400).json({ error: passCheck.error });

  const cleanName = nameCheck.value;
  const cleanEmail = emailCheck.value;

  if (!isDbEnabled()) {
    req.session.user = {
      id: 1,
      name: cleanName,
      email: cleanEmail,
      role: 'user',
      bio: '',
      avatar_url: '',
      created_at: new Date().toISOString(),
    };
    return res.json({ message: 'Аккаунт создан', user: req.session.user });
  }

  const pool = getPool();
  const [exists] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
  if (exists.length > 0) return res.status(409).json({ error: 'Email уже используется' });

  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "user")',
    [cleanName, cleanEmail, passwordHash]
  );

  req.session.user = {
    id: result.insertId,
    name: cleanName,
    email: cleanEmail,
    role: 'user',
    bio: '',
    avatar_url: '',
    created_at: new Date().toISOString(),
  };
  res.json({ message: 'Регистрация успешна', user: req.session.user });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Нужны email и пароль' });
  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });

  if (!isDbEnabled()) {
    const emailLower = emailCheck.value;
    const adminEmail = String(process.env.DEFAULT_ADMIN_EMAIL || 'admin@aggregator.local').toLowerCase();
    const role = emailLower === adminEmail ? 'admin' : 'user';
    const local = emailLower.split('@')[0] || 'Пользователь';
    const prettyName = local.replace(/[._+-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    req.session.user = {
      id: 1,
      name: prettyName,
      email: emailLower,
      role,
      bio: '',
      avatar_url: '',
      created_at: new Date().toISOString(),
    };
    return res.json({ message: 'Вход выполнен', user: req.session.user });
  }

  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [emailCheck.value]);
  if (rows.length === 0) return res.status(401).json({ error: 'Неверный email или пароль' });

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    subscription: user.subscription || 'basic',
    bio: user.bio || '',
    avatar_url: user.avatar_url || ''
  };
  res.json({ message: 'Вход выполнен', user: req.session.user });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Выход выполнен' }));
});

app.get('/api/profile', requireAuth, async (req, res) => {
  if (!isDbEnabled()) return res.json(req.session.user);
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id, name, email, role, subscription, bio, avatar_url, created_at FROM users WHERE id = ? LIMIT 1',
    [req.session.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
  req.session.user = rows[0];
  res.json(rows[0]);
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const { name, bio, avatar_url } = req.body;
  if (!isDbEnabled()) {
    req.session.user = { ...req.session.user, name: name || req.session.user.name, bio: bio || '', avatar_url: avatar_url || '' };
    return res.json({ message: 'Профиль обновлён', user: req.session.user });
  }
  const pool = getPool();
  await pool.query('UPDATE users SET name = ?, bio = ?, avatar_url = ? WHERE id = ?', [
    name || req.session.user.name,
    bio || '',
    avatar_url || '',
    req.session.user.id
  ]);
  req.session.user = {
    ...req.session.user,
    name: name || req.session.user.name,
    bio: bio || '',
    avatar_url: avatar_url || ''
  };
  res.json({ message: 'Профиль обновлен' });
});

app.get('/api/favorites/ids', requireAuth, (req, res) => {
  res.json({ ids: [...ensureFavorites(req)] });
});

app.get('/api/favorites', requireAuth, async (req, res) => {
  const favs = ensureFavorites(req);
  const offers = [];
  for (const id of favs) {
    const o = await getOfferById(id);
    if (o) offers.push(formatOffer(o));
  }
  res.json({ offers });
});

app.post('/api/favorites/toggle', requireAuth, async (req, res) => {
  const id = String(req.body?.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Нужен id заказа' });
  const favs = ensureFavorites(req);
  const idx = favs.indexOf(id);
  let inList;
  if (idx >= 0) {
    favs.splice(idx, 1);
    inList = false;
  } else {
    const offer = await getOfferById(id);
    if (!offer) return res.status(404).json({ error: 'Заказ не найден в ленте' });
    favs.unshift(id);
    if (favs.length > 60) favs.length = 60;
    inList = true;
  }
  res.json({ ids: [...favs], inList });
});

app.post('/api/reviews', requireAuth, async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (text.length < 15) return res.status(400).json({ error: 'Минимум 15 символов в отзыве' });
  if (text.length > 1200) return res.status(400).json({ error: 'Слишком длинный текст' });
  let rating = Number(req.body?.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) rating = 5;
  rating = Math.round(rating);
  const u = req.session.user;
  const list = await readReviewsPending();
  const row = {
    id: `rv${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId: u.id,
    name: String(u.name || 'Пользователь').slice(0, 80),
    email: String(u.email || '').slice(0, 120),
    text: text.slice(0, 1200),
    rating,
    createdAt: new Date().toISOString()
  };
  list.unshift(row);
  await writeReviewsPending(list.slice(0, 200));
  res.json({ ok: true, id: row.id });
});

app.get('/api/admin/reviews/pending', requireAdmin, async (_, res) => {
  res.json({ reviews: await readReviewsPending() });
});

app.get('/api/admin/reviews/published', requireAdmin, async (_, res) => {
  const site = await readSiteContent();
  if (!site) return res.status(500).json({ error: 'Не удалось прочитать контент сайта' });
  res.json({ reviews: Array.isArray(site.reviews) ? site.reviews : [] });
});

app.delete('/api/admin/reviews/published/:index', requireAdmin, async (req, res) => {
  const i = Number.parseInt(String(req.params.index), 10);
  if (!Number.isFinite(i) || i < 0) return res.status(400).json({ error: 'Неверный номер отзыва' });
  const site = await readSiteContent();
  if (!site || !Array.isArray(site.reviews) || i >= site.reviews.length) {
    return res.status(404).json({ error: 'Отзыв не найден на главной' });
  }
  site.reviews.splice(i, 1);
  await fs.writeFile(SITE_CONTENT_PATH, JSON.stringify(site, null, 2), 'utf8');
  res.json({ ok: true });
});

app.post('/api/admin/reviews/:id/approve', requireAdmin, async (req, res) => {
  const id = String(req.params.id || '');
  const list = await readReviewsPending();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Отзыв не найден в очереди' });
  const [item] = list.splice(idx, 1);
  const site = await readSiteContent();
  if (!site) return res.status(500).json({ error: 'Не удалось прочитать контент сайта' });
  if (!Array.isArray(site.reviews)) site.reviews = [];
  site.reviews.unshift({
    text: item.text,
    name: item.name,
    role: 'Пользователь',
    rating: item.rating || 5,
    publishedFromQueueId: item.id,
    publishedAt: new Date().toISOString()
  });
  site.reviews = site.reviews.slice(0, 40);
  await fs.writeFile(SITE_CONTENT_PATH, JSON.stringify(site, null, 2), 'utf8');
  await writeReviewsPending(list);
  res.json({ ok: true });
});

app.delete('/api/admin/reviews/pending/:id', requireAdmin, async (req, res) => {
  const id = String(req.params.id || '');
  const list = (await readReviewsPending()).filter((x) => x.id !== id);
  await writeReviewsPending(list);
  res.json({ ok: true });
});

app.get('/api/offers', async (req, res) => {
  const limit = Number(req.query.limit || 24);
  if (!isDbEnabled()) {
    try {
      return await respondOffersFromMemory(limit, res);
    } catch (error) {
      console.error('Offers (demo) error:', error.message);
      return res.status(500).json({ error: 'Не удалось загрузить заказы' });
    }
  }
  try {
    const pool = getPool();
    const [offers] = await pool.query('SELECT * FROM offers ORDER BY posted_at DESC LIMIT ?', [limit]);
    if (offers.length === 0) {
      const seeded = await getFallbackOffers(limit);
      for (const offer of seeded) {
        await pool.query(
          `INSERT IGNORE INTO offers
           (id, title, description, source, category, budget_min, budget_max, currency, external_url, posted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            offer.id,
            offer.title,
            offer.description,
            offer.source,
            offer.category,
            offer.budget_min,
            offer.budget_max,
            offer.currency,
            offer.external_url || '',
            offer.posted_at
          ]
        );
      }
      return res.json(seeded.map(formatOffer));
    }
    return res.json(offers.map(formatOffer));
  } catch (error) {
    console.error('DB /api/offers:', error.message);
    try {
      return await respondOffersFromMemory(limit, res);
    } catch (fallbackError) {
      console.error('Offers DB fallback error:', fallbackError.message);
      return res.status(500).json({ error: 'Не удалось загрузить заказы' });
    }
  }
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  if (!isDbEnabled()) {
    return res.json({ users: 8, offers: 64, todayOffers: 21, mode: 'demo' });
  }
  const pool = getPool();
  const [[users]] = await pool.query('SELECT COUNT(*) AS count FROM users');
  const [[offers]] = await pool.query('SELECT COUNT(*) AS count FROM offers');
  const [[todayOffers]] = await pool.query('SELECT COUNT(*) AS count FROM offers WHERE DATE(posted_at)=CURDATE()');
  res.json({ users: users.count, offers: offers.count, todayOffers: todayOffers.count, mode: 'mysql' });
});

app.post('/api/ai/chat', async (req, res) => {
  const prompt = req.body?.prompt || '';
  if (!prompt.trim()) return res.status(400).json({ error: 'Введи вопрос для AI' });
  const reply = await askAi(prompt);
  res.json({ reply });
});

app.post('/api/tracker/sync', requireAuth, async (req, res) => {
  const { xp, level, coins } = req.body || {};
  const uid = req.session.user.id;
  if (!isDbEnabled()) return res.json({ ok: true });
  try {
    const pool = getPool();
    await pool.query(
      'UPDATE users SET tracker_xp=?, tracker_level=?, tracker_coins=? WHERE id=?',
      [Number(xp)||0, Number(level)||1, Number(coins)||0, uid]
    ).catch(() => {});
    res.json({ ok: true });
  } catch { res.json({ ok: false }); }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  if (!isDbEnabled()) {
    const users = [...inMemoryUsers.values()].map(u => ({
      id: u.id, name: u.name, email: u.email, role: u.role,
      subscription: u.subscription || 'basic', created_at: u.created_at
    }));
    return res.json({ users });
  }
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, email, role, subscription, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { role, subscription } = req.body || {};
  if (!isDbEnabled()) {
    for (const [k, u] of inMemoryUsers.entries()) {
      if (u.id === id) {
        if (role) u.role = role;
        if (subscription) u.subscription = subscription;
        inMemoryUsers.set(k, u);
        return res.json({ ok: true, user: u });
      }
    }
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  try {
    const pool = getPool();
    const fields = [];
    const vals = [];
    if (role) { fields.push('role = ?'); vals.push(role); }
    if (subscription !== undefined) { fields.push('subscription = ?'); vals.push(subscription); }
    if (!fields.length) return res.status(400).json({ error: 'Нечего обновлять' });
    vals.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!isDbEnabled()) {
    for (const [k, u] of inMemoryUsers.entries()) {
      if (u.id === id) { inMemoryUsers.delete(k); return res.json({ ok: true }); }
    }
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  try {
    const pool = getPool();
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  if (!isDbEnabled()) {
    return res.json({ users: [] });
  }
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, name, avatar_url, subscription, COALESCE(tracker_xp,0) as tracker_xp, COALESCE(tracker_level,1) as tracker_level FROM users ORDER BY tracker_xp DESC LIMIT 50'
    ).catch(async () => {
      // Если колонок tracker нет — возвращаем без них
      const [r] = await pool.query('SELECT id, name, avatar_url, subscription FROM users ORDER BY id ASC LIMIT 50');
      return [r.map(u => ({ ...u, tracker_xp: 0, tracker_level: 1 }))];
    });
    res.json({ users: rows });
  } catch (error) {
    res.json({ users: [] });
  }
});

io.on('connection', (socket) => {
  socket.emit('connected', { ok: true });
});

async function saveOffer(offer) {
  const externalUrl = sanitizeExternalUrl(offer.external_url, offer.source);
  if (!externalUrl) return false;

  if (isDbEnabled()) {
    try {
      const pool = getPool();
      const [result] = await pool.query(
        `INSERT IGNORE INTO offers
         (id, title, description, source, category, budget_min, budget_max, currency, external_url, posted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          offer.id,
          offer.title,
          offer.description,
          offer.source,
          offer.category,
          offer.budget_min,
          offer.budget_max,
          offer.currency,
          externalUrl,
          offer.posted_at
        ]
      );
      return result.affectedRows > 0;
    } catch (error) {
      const transient = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error.code);
      if (transient) {
        disableDb();
        console.warn('MySQL отключён после ошибки соединения; дальше сохранение в память.', error.message);
      } else {
        console.error('saveOffer DB error:', error.message);
      }
    }
  }
  if (inMemoryOffers.has(offer.id)) return false;
  inMemoryOffers.set(offer.id, { ...offer, external_url: externalUrl });
  if (inMemoryOffers.size > 500) {
    const sorted = [...inMemoryOffers.values()].sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()).slice(0, 300);
    inMemoryOffers.clear();
    sorted.forEach((row) => inMemoryOffers.set(row.id, row));
  }
  return true;
}

async function syncExternalOffers() {
  try {
    const pulled = await fetchExternalOffers(20);
    for (const offer of pulled) {
      const inserted = await saveOffer(offer);
      if (inserted) io.emit('offer:new', formatOffer(offer));
    }
  } catch (error) {
    console.error('External sync error:', error.message);
  }
}

setInterval(async () => {
  await syncExternalOffers();
}, 60000);

server.listen(PORT, async () => {
  try {
    await ensureDb();
    await syncExternalOffers();
    console.log(`Server started on http://localhost:${PORT}`);
    console.log(`DB mode: ${isDbEnabled() ? 'mysql' : 'demo (without MySQL config)'}`);
  } catch (error) {
    console.error('Server boot error:', error.message);
  }
});