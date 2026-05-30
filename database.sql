-- FlowLance — полная схема БД v2
-- Применить на сервере:
--   mysql -u aggregator_user -p120398cvbn aggregator_db < /var/www/flowlance/database.sql

USE aggregator_db;

-- 1. Пользователи
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(255) DEFAULT '',
  role ENUM('user','admin') DEFAULT 'user',
  subscription ENUM('basic','pro','proplus') DEFAULT 'basic',
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Офферы
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
);

-- 3. Тикеты поддержки
CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(40) PRIMARY KEY,
  email VARCHAR(120) NOT NULL,
  name VARCHAR(120) DEFAULT '',
  subject VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(40) DEFAULT 'new',
  admin_reply TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Отзывы на модерации
CREATE TABLE IF NOT EXISTS reviews_pending (
  id VARCHAR(60) PRIMARY KEY,
  user_id INT DEFAULT NULL,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(120) DEFAULT '',
  text TEXT NOT NULL,
  rating TINYINT DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Инвентарь магазина
CREATE TABLE IF NOT EXISTS shop_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_id VARCHAR(60) NOT NULL,
  equipped TINYINT(1) DEFAULT 0,
  bought_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_item (user_id, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Избранные офферы
CREATE TABLE IF NOT EXISTS favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  offer_id VARCHAR(40) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_fav (user_id, offer_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
