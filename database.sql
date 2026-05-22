-- Создание базы данных
CREATE DATABASE IF NOT EXISTS aggregator_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE aggregator_db;

-- 1. Пользователи
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(500) DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    portfolio_links TEXT DEFAULT NULL,
    coins INT NOT NULL DEFAULT 0,
    xp INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 1,
    streak INT NOT NULL DEFAULT 0,
    last_daily DATETIME DEFAULT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Задачи трекера
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    xp_reward INT NOT NULL
);

-- 3. Заказы
CREATE TABLE IF NOT EXISTS offers (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT DEFAULT NULL,
    url VARCHAR(1000) NOT NULL,
    source VARCHAR(100) NOT NULL,
    category VARCHAR(100) DEFAULT NULL,
    budget DECIMAL(15,2) DEFAULT NULL,
    currency VARCHAR(10) DEFAULT 'RUB',
    published_at DATETIME DEFAULT NULL,
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Избранное
CREATE TABLE IF NOT EXISTS favorites (
    user_id INT NOT NULL,
    offer_id VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, offer_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
);

-- 5. Выполненные задачи пользователей
CREATE TABLE IF NOT EXISTS user_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    task_id INT NOT NULL,
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Индексы для ускорения
CREATE INDEX idx_offers_source ON offers(source);
CREATE INDEX idx_offers_category ON offers(category);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_favorites_user ON favorites(user_id);

-- Начальные данные
INSERT INTO tasks (name, xp_reward) VALUES
    ('Лёгкая задача', 20),
    ('Средняя задача', 50),
    ('Сложная задача', 100),
    ('Эпическая задача', 200);
