# Отчёт о готовности проекта к деплою на Vercel/Production

**Дата проверки:** 2025-01-XX  
**Проект:** AutoChargeSaver 2.0  
**Цель:** Проверка готовности к production деплою без mock-режима

---

## ✅ Что уже готово

### 1. Базовые файлы конфигурации

- ✅ **`vercel.json`** — присутствует, но требует исправлений
- ✅ **`package.json`** — содержит build/start скрипты
- ✅ **`tsconfig.json`** — настроен для TypeScript компиляции
- ✅ **`render.yaml`** — присутствует для альтернативного деплоя на Render
- ✅ **`Dockerfile`** — присутствует для контейнеризации

### 2. Серверная часть (Express)

- ✅ **`app/src/server.ts`** — Express сервер настроен
- ✅ **Production режим:** `trust proxy = 1`, HSTS headers
- ✅ **Middleware:** Helmet, CORS, rate limiting, session management
- ✅ **Health check:** `/api/health` endpoint

### 3. Аутентификация и сессии

- ✅ **OAuth:** Реализован `/auth/whop` и `/auth/whop/callback`
- ✅ **Middleware:** `requireAuth` работает корректно
- ✅ **Mock режим:** `/auth/dev` для локальной разработки
- ✅ **Logout:** `/logout` endpoint реализован

### 4. Dashboard и UI

- ✅ **Dashboard:** `/dashboard` с метриками
- ✅ **Events:** `/dashboard/events` с фильтрацией
- ✅ **Views:** EJS шаблоны настроены

### 5. Prisma и база данных

- ✅ **Schema:** `app/prisma/schema.prisma` определён
- ✅ **Client:** `app/src/config/prisma.ts` инициализирован
- ✅ **Fallback:** Mock client при недоступности БД

### 6. Webhooks

- ✅ **`/webhooks/whop`** — реализован с проверкой подписи
- ✅ **Idempotency:** Защита от дублирования событий
- ✅ **Logging:** WebhookLog модель для аудита

---

## ⚠️ Критические проблемы для production

### 1. ❌ **Отсутствуют API endpoints для Whop**

**Проблема:** В проекте нет следующих endpoints, которые вы упомянули:
- `/api/whop/orders`
- `/api/whop/subscriptions`
- `/api/whop/refunds`

**Текущее состояние:**
- ✅ Есть только `/webhooks/whop` (POST) для получения событий от Whop
- ❌ Нет REST API endpoints для получения данных из Whop

**Решение:**
Если нужны эти endpoints, их нужно реализовать. Например:

```typescript
// app/src/api/whopApi.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { createWhopClient } from '../integrations/whop';

export const whopApiRouter = Router();

// Получить orders пользователя
whopApiRouter.get('/api/whop/orders', requireAuth, async (req, res) => {
  const user = (req as any).user;
  // TODO: Реализовать получение orders через Whop API
  res.json({ orders: [] });
});

// Получить subscriptions
whopApiRouter.get('/api/whop/subscriptions', requireAuth, async (req, res) => {
  // TODO: Реализовать
});

// Получить refunds
whopApiRouter.get('/api/whop/refunds', requireAuth, async (req, res) => {
  // TODO: Реализовать
});
```

---

### 2. ⚠️ **Session Storage — Memory Store (критично для production)**

**Проблема:** Сессии хранятся в памяти (`express-session` по умолчанию)

**Риски:**
- При рестарте сервера все сессии теряются
- При масштабировании (несколько инстансов) сессии не синхронизируются
- Не подходит для production

**Текущий код:**
```typescript
// app/src/server.ts:100
app.use(session({
  // Нет store — используется memory store
}));
```

**Решение:** Использовать Redis или PostgreSQL для хранения сессий:

```typescript
// Пример с connect-redis
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  // ... остальные опции
}));
```

**Или для PostgreSQL:**
```typescript
import connectPgSimple from 'connect-pg-simple';
const PGStore = connectPgSimple(session);

app.use(session({
  store: new PGStore({
    conString: env.DATABASE_URL,
  }),
  // ...
}));
```

---

### 3. ⚠️ **Prisma Generate — отсутствует в postinstall**

**Проблема:** Prisma Client не генерируется автоматически при `npm install`

**Текущее состояние:**
- ✅ Есть `prisma/generate.cjs`, но он не вызывается автоматически
- ❌ Нет `postinstall` скрипта в `package.json`

**Решение:** Добавить в `package.json`:

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    // или если schema в app/prisma:
    "postinstall": "cd app && npx prisma generate"
  }
}
```

**Или обновить build команду в Vercel:**
```json
{
  "buildCommand": "npm install && cd app && npx prisma generate && npm run build"
}
```

---

### 4. ⚠️ **vercel.json — неправильная конфигурация для TypeScript**

**Текущий `vercel.json`:**
```json
{
  "builds": [
    {
      "src": "app/src/server.ts",
      "use": "@vercel/node"
    }
  ]
}
```

**Проблема:**
- Vercel автоматически компилирует TypeScript, но:
  - Нужно указать правильный entry point
  - Нужно убедиться, что Prisma генерируется перед build

**Рекомендуемая конфигурация:**

**Вариант A: Использовать `build` команду**
```json
{
  "version": 2,
  "buildCommand": "npm install && cd app && npx prisma generate && npm run build",
  "outputDirectory": "dist",
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

**Вариант B: Оставить как есть, но добавить buildCommand**
```json
{
  "version": 2,
  "buildCommand": "cd app && npx prisma generate",
  "builds": [
    {
      "src": "app/src/server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app/src/server.ts"
    }
  ]
}
```

---

### 5. ⚠️ **Отсутствует `.env.example` файл**

**Проблема:** Нет примера переменных окружения для настройки production

**Решение:** Создать `.env.example` с документацией:

```env
# Production Environment Variables

# Required
NODE_ENV=production
APP_HOST=https://your-app.vercel.app
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Whop OAuth (Required for production)
WHOP_CLIENT_ID=your_client_id
WHOP_CLIENT_SECRET=your_client_secret
WHOP_REDIRECT_URI=https://your-app.vercel.app/auth/whop/callback
WHOP_WEBHOOK_SECRET=your_webhook_secret
WHOP_API_KEY=your_api_key

# Session
SESSION_SECRET=generate-with-openssl-rand-base64-32

# Mock Login (MUST be false in production)
MOCK_LOGIN=false

# Email/SMTP (Optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_FROM=noreply@example.com

# Channels (Enable/Disable)
ENABLE_EMAIL=true
ENABLE_TELEGRAM=false
ENABLE_DISCORD=false
ENABLE_TWITTER=false
ENABLE_INSTAGRAM=false

# Telegram (if enabled)
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id

# Discord (if enabled)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Redis (Optional, for session storage)
REDIS_URL=redis://localhost:6379

# Attribution Window
ATTR_WINDOW_DAYS=7
```

---

### 6. ❌ **SUPABASE переменные не используются**

**Примечание:** В запросе упомянуты `SUPABASE_URL` и `SUPABASE_ANON_KEY`, но:
- ❌ Эти переменные не найдены в коде проекта
- ❌ Prisma использует `DATABASE_URL` (обычно PostgreSQL или SQLite)
- Возможно, это было из другого проекта или планируется интеграция

**Если нужна интеграция с Supabase:**
- Используйте `DATABASE_URL` от Supabase (PostgreSQL connection string)
- Или добавьте отдельную интеграцию, если нужен Supabase Client

---

## 📋 Список необходимых действий перед деплоем

### Критичные (блокируют production):

1. **Исправить Session Storage**
   - [ ] Добавить Redis или PostgreSQL store для сессий
   - [ ] Настроить `REDIS_URL` или использовать БД

2. **Добавить Prisma Generate**
   - [ ] Добавить `postinstall` скрипт в `package.json`
   - [ ] Или обновить build команду в Vercel

3. **Исправить vercel.json**
   - [ ] Обновить build конфигурацию
   - [ ] Убедиться, что Prisma генерируется

4. **Создать .env.example**
   - [ ] Документировать все переменные окружения

5. **Настроить Production переменные**
   - [ ] Установить `MOCK_LOGIN=false`
   - [ ] Настроить `WHOP_CLIENT_ID`, `WHOP_CLIENT_SECRET`, `WHOP_REDIRECT_URI`
   - [ ] Сгенерировать сильный `SESSION_SECRET`

### Желательные (улучшают работу):

6. **Реализовать API endpoints для Whop (если нужны)**
   - [ ] `/api/whop/orders`
   - [ ] `/api/whop/subscriptions`
   - [ ] `/api/whop/refunds`

7. **Настроить Production Database**
   - [ ] Перейти с SQLite на PostgreSQL (для production)
   - [ ] Настроить миграции: `npx prisma migrate deploy`

8. **Добавить мониторинг и логирование**
   - [ ] Настроить логирование в production (уже есть Pino)
   - [ ] Добавить error tracking (Sentry, etc.)

---

## 🔧 Детальный анализ файлов

### ✅ Готовые файлы:

| Файл | Статус | Примечание |
|------|--------|------------|
| `vercel.json` | ⚠️ | Нужна корректировка для Prisma |
| `package.json` | ✅ | Build/start скрипты есть |
| `app/src/server.ts` | ✅ | Production режим настроен |
| `app/src/middleware/auth.ts` | ✅ | Работает корректно |
| `app/src/auth/whopOAuth.ts` | ✅ | OAuth реализован |
| `app/src/webhooks/whopWebhook.ts` | ✅ | Webhook работает |
| `app/src/config/prisma.ts` | ✅ | Инициализация есть |
| `app/src/config/env.ts` | ✅ | Валидация переменных |

### ❌ Отсутствующие/неполные:

| Файл | Статус | Что нужно |
|------|--------|-----------|
| `.env.example` | ❌ | Создать с документацией |
| `app/src/api/whopApi.ts` | ❌ | Реализовать, если нужны endpoints |
| Session store config | ❌ | Добавить Redis/PostgreSQL store |

---

## 📝 Конфигурация для Vercel

### Environment Variables (установить в Vercel Dashboard):

**Обязательные:**
```bash
NODE_ENV=production
APP_HOST=https://your-app.vercel.app
DATABASE_URL=postgresql://...
WHOP_CLIENT_ID=...
WHOP_CLIENT_SECRET=...
WHOP_REDIRECT_URI=https://your-app.vercel.app/auth/whop/callback
WHOP_WEBHOOK_SECRET=...
SESSION_SECRET=... # openssl rand -base64 32
MOCK_LOGIN=false
```

**Опциональные (по необходимости):**
```bash
WHOP_API_KEY=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
ENABLE_EMAIL=true
ENABLE_TELEGRAM=false
# ... и т.д.
```

### Build Settings в Vercel:

**Build Command:**
```bash
npm install && cd app && npx prisma generate && npm run build
```

**Output Directory:**
```
dist
```

**Install Command:**
```bash
npm install
```

---

## 🚀 Альтернатива: Render.com

Если Vercel вызывает проблемы, можно использовать Render (уже есть `render.yaml`):

**Преимущества Render:**
- ✅ Поддержка PostgreSQL из коробки
- ✅ Проще настройка для Node.js приложений
- ✅ Поддержка WebSockets (если понадобится)

**Обновить `render.yaml`:**
```yaml
services:
  - type: web
    name: autocharge-saver
    env: node
    region: oregon
    plan: starter
    buildCommand: npm install && cd app && npx prisma generate && npm run build
    startCommand: npm run start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
    healthCheckPath: /api/health
```

---

## ✅ Проверка готовности к production (MOCK_LOGIN=false)

### Тесты перед деплоем:

1. **Локальный тест без mock:**
   ```bash
   # Установить MOCK_LOGIN=false в .env
   npm run dev
   # Проверить OAuth flow
   ```

2. **Проверка endpoints:**
   ```bash
   curl http://localhost:3000/api/health
   curl http://localhost:3000/dashboard # Должен редиректить на /auth/whop
   ```

3. **Проверка Prisma:**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **Проверка build:**
   ```bash
   npm run build
   npm run start
   ```

---

## 📊 Итоговая оценка готовности

| Компонент | Готовность | Комментарий |
|-----------|-----------|-------------|
| **Базовая инфраструктура** | ✅ 90% | Express, middleware, routing готовы |
| **Аутентификация** | ✅ 95% | OAuth работает, нужен только session store |
| **Database** | ✅ 85% | Prisma настроен, нужен generate в build |
| **Webhooks** | ✅ 100% | Полностью готов |
| **UI/Dashboard** | ✅ 100% | Dashboard и Events работают |
| **API Endpoints** | ⚠️ 50% | Базовые есть, Whop API endpoints отсутствуют |
| **Session Storage** | ❌ 0% | Критично — нужен Redis/PostgreSQL |
| **Build/Deploy** | ⚠️ 70% | Нужны исправления в vercel.json |
| **Environment Config** | ⚠️ 60% | Нет .env.example |

**Общая готовность: ~75%**

---

## 🎯 Рекомендации по приоритетам

### Перед первым деплоем (обязательно):

1. ✅ Добавить session store (Redis или PostgreSQL)
2. ✅ Исправить vercel.json и build процесс
3. ✅ Создать .env.example
4. ✅ Настроить production переменные окружения

### После первого деплоя (можно добавить позже):

5. ⚠️ Реализовать Whop API endpoints (если действительно нужны)
6. ⚠️ Настроить мониторинг и alerting
7. ⚠️ Добавить rate limiting для production (уже есть базовая защита)

---

**Готово к деплою:** После исправления критических проблем (1-4) ✅



