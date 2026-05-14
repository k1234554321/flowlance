const mysql = require('mysql2/promise');

const requiredEnv = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const hasDbConfig = requiredEnv.every((key) => process.env[key]);

let pool = null;

if (hasDbConfig) {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

function isDbEnabled() {
  return Boolean(pool);
}

function getPool() {
  if (!pool) {
    throw new Error('MySQL is not configured. Fill .env and restart server.');
  }
  return pool;
}

/** Закрыть пул и считать БД выключенной (например MySQL не запущен). */
function disableDb() {
  if (!pool) return;
  const p = pool;
  pool = null;
  p.end().catch(() => {});
}

module.exports = { isDbEnabled, getPool, disableDb };
