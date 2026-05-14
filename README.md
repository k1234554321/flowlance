# FlowLance - freelance aggregator

Многостраничный сайт-агрегатор на `HTML/CSS/JS + Node.js (Express) + MySQL` с:
- главной страницей и анимированным UI;
- live-лентой заказов через `Socket.IO`;
- личным кабинетом с редактированием профиля/аватара;
- админ-панелью статистики;
- AI-чатом через Proxy API;
- внешней агрегацией из популярных источников (`Freelancer RSS` + `RemoteOK API`).

## Локальный запуск

```bash
npm install
cp .env.example .env
npm run dev
```

## Деплой на Ubuntu (Timeweb Cloud)

```bash
# 1) Базовые пакеты
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential nginx mysql-server

# 2) Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v

# 3) PM2
sudo npm install -g pm2

# 4) Клонирование проекта
cd /var/www
sudo git clone <YOUR_GIT_REPOSITORY_URL> flowlance
sudo chown -R $USER:$USER /var/www/flowlance
cd /var/www/flowlance

# 5) Переменные окружения
cp .env.example .env
nano .env

# 6) Установка зависимостей
npm install --production

# 7) Настройка MySQL
sudo mysql -u root -p
```

В MySQL-консоли:

```sql
CREATE DATABASE aggregator_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'aggregator_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON aggregator_db.* TO 'aggregator_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Загрузить схему:

```bash
mysql -u aggregator_user -p aggregator_db < database.sql
```

Запуск через PM2:

```bash
pm2 start server.js --name flowlance
pm2 save
pm2 startup systemd
```

Проверка:

```bash
pm2 status
curl http://127.0.0.1:3000/api/offers
```

## Nginx reverse proxy

```bash
sudo nano /etc/nginx/sites-available/flowlance
```

Конфиг:

```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

Активация:

```bash
sudo ln -s /etc/nginx/sites-available/flowlance /etc/nginx/sites-enabled/flowlance
sudo nginx -t
sudo systemctl restart nginx
```

## SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Страницы

- `/` - лендинг;
- `/feed` - live-лента заказов;
- `/dashboard` - профиль пользователя;
- `/admin` - панель администратора;
- `/auth` - вход/регистрация.
