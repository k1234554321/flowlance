require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');

const { isDbEnabled, getPool, disableDb } = require('./db');
const { getFallbackOffers, createLiveOffer, fetchExternalOffers } = require('./services/aggregator');
const { askAi } = require('./services/aiProxy');
const fs = require('fs').promises;

const SITE_CONTENT_PATH = path.join(__dirname, 'data', 'siteContent.json');
const TICKETS_PATH = path.join(__dirname, 'data', 'tickets.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const inMemoryOffers = new Map();

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
    external_url: offer.external_url || ''
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

async function ensureDb() {
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
      bio TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
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
    await pool.query('ALTER TABLE offers ADD COLUMN IF NOT EXISTS external_url VARCHAR(500) DEFAULT ""');

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
    disableDb();
    console.warn('MySQL недоступен — включён режим без БД (данные в памяти). Ошибка:', error.message);
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

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Заполни все поля' });
  }

  if (!isDbEnabled()) {
    req.session.user = { id: 1, name, email, role: 'user', bio: '', avatar_url: '' };
    return res.json({ message: 'Режим демо: пользователь создан локально', user: req.session.user });
  }

  const pool = getPool();
  const [exists] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (exists.length > 0) return res.status(409).json({ error: 'Email уже используется' });

  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "user")',
    [name, email, passwordHash]
  );

  req.session.user = { id: result.insertId, name, email, role: 'user', bio: '', avatar_url: '' };
  res.json({ message: 'Регистрация успешна', user: req.session.user });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Нужны email и пароль' });

  if (!isDbEnabled()) {
    const role = email.includes('admin') ? 'admin' : 'user';
    req.session.user = { id: 1, name: 'Demo User', email, role, bio: 'Демо профиль', avatar_url: '' };
    return res.json({ message: 'Вход в демо-режиме', user: req.session.user });
  }

  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  if (rows.length === 0) return res.status(401).json({ error: 'Неверный email или пароль' });

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
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
  const [rows] = await pool.query('SELECT id, name, email, role, bio, avatar_url FROM users WHERE id = ? LIMIT 1', [
    req.session.user.id
  ]);
  if (rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
  req.session.user = rows[0];
  res.json(rows[0]);
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const { name, bio, avatar_url } = req.body;
  if (!isDbEnabled()) {
    req.session.user = { ...req.session.user, name: name || req.session.user.name, bio: bio || '', avatar_url: avatar_url || '' };
    return res.json({ message: 'Профиль обновлен (демо)', user: req.session.user });
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

io.on('connection', (socket) => {
  socket.emit('connected', { ok: true });
});

async function saveOffer(offer) {
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
          offer.external_url || '',
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
  inMemoryOffers.set(offer.id, offer);
  if (inMemoryOffers.size > 500) {
    const sorted = [...inMemoryOffers.values()].sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()).slice(0, 300);
    inMemoryOffers.clear();
    sorted.forEach((row) => inMemoryOffers.set(row.id, row));
  }
  return true;
}

async function syncExternalOffers() {
  try {
    const pulled = await fetchExternalOffers(12);
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
  const generated = createLiveOffer();
  const inserted = await saveOffer(generated).catch(() => false);
  if (inserted) io.emit('offer:new', formatOffer(generated));
}, 15000);

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