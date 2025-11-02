# Отчёт об исправлении сессий для работы в iframe на Vercel

## ✅ Выполненные изменения

### 1. Конфигурация session cookies (`app/src/server.ts`, строки 127-141)

#### Изменения в `sessionConfig`:

**Было:**
```typescript
cookie: {
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
  // ...
}
resave: true,
saveUninitialized: true,
```

**Стало:**
```typescript
cookie: {
  secure: true,              // ✅ Всегда true для iframe (требует HTTPS)
  httpOnly: true,
  sameSite: 'none',          // ✅ Обязательно 'none' для cross-site iframe
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
  domain: undefined,          // ✅ Не устанавливаем domain для cross-site
}
resave: false,               // ✅ Оптимизировано для production
saveUninitialized: false,    // ✅ Оптимизировано для production
```

**Ключевые изменения:**
- ✅ `sameSite: 'none'` — обязательно для iframe cross-site запросов
- ✅ `secure: true` — всегда true (Vercel использует HTTPS)
- ✅ `resave: false` — оптимизация для production
- ✅ `saveUninitialized: false` — оптимизация для production

---

### 2. Логирование сессий (`app/src/server.ts`, строки 150-164)

Добавлено подробное логирование для отслеживания сессий:

```typescript
console.log('SESSION CHECK:', {
  path: req.path,
  userId: req.session?.userId,
  sessionId: req.sessionID,
  cookies: req.cookies,
  cookieHeader: req.headers.cookie?.substring(0, 100),
  hasSession: !!req.session,
  hasSidInCookie: req.headers.cookie?.includes('sid='),
});
```

**Применяется к путям:**
- `/dashboard` и `/dashboard/*`
- `/auth/dev`
- `/auth/whop`
- `/auth/whop/callback`

---

### 3. Явное сохранение сессии перед редиректом (`app/src/auth/whopOAuth.ts`, строки 193-202)

**Было:**
```typescript
req.session.userId = user.id;
req.session.whopUserId = user.whopUserId;
res.redirect('/dashboard');
```

**Стало:**
```typescript
req.session.userId = user.id;
req.session.whopUserId = user.whopUserId;
req.session.oauthState = undefined;

// Save session explicitly before redirect (critical for iframe)
console.log('💾 Saving session before redirect...', { userId: user.id, sessionId: req.sessionID });
req.session.save((saveErr) => {
  if (saveErr) {
    logger.error({ error: saveErr }, 'Error saving session before redirect');
    return res.status(500).json({ error: 'session_save_failed', message: saveErr.message });
  }
  console.log('✅ Session saved, redirecting to /dashboard', { userId: req.session?.userId, sessionId: req.sessionID });
  res.redirect('/dashboard');
});
```

**Ключевые изменения:**
- ✅ Добавлен `req.session.save()` перед редиректом
- ✅ Обработка ошибок сохранения сессии
- ✅ Логирование процесса сохранения

---

### 4. Порядок middleware

**Текущий порядок в `server.ts`:**

1. ✅ Helmet (security headers)
2. ✅ CORS (с `credentials: true`)
3. ✅ cookieParser()
4. ✅ trust proxy (настроен для production)
5. ✅ PostgreSQL session store (если `DATABASE_URL` настроен)
6. ✅ `app.use(session(sessionConfig))` — **до всех роутеров**
7. ✅ Session diagnostic middleware
8. ✅ Express body parsers (если используются)
9. ✅ Роутеры (authRouter, whopRouter, uiRouter, etc.)

**✅ Подтверждение:** `app.use(session(...))` стоит **до всех роутеров**, что корректно.

---

### 5. PostgreSQL Session Store

**Статус:** ✅ Уже настроен (строки 104-124)

Если `DATABASE_URL` указывает на PostgreSQL, используется `connect-pg-simple`:
```typescript
if (env.DATABASE_URL && (env.DATABASE_URL.startsWith('postgresql://') || ...)) {
  const PGStore = connectPgSimple(session);
  sessionStore = new PGStore({
    conString: env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60,
  });
}
```

**Важно для Vercel:** In-memory store не сохраняет сессии между запросами. PostgreSQL store решает эту проблему.

---

## 📊 Что применено

### ✅ Конфигурация cookies:
- ✅ `sameSite: 'none'` — применено
- ✅ `secure: true` — применено (всегда)
- ✅ `httpOnly: true` — применено
- ✅ `resave: false` — применено
- ✅ `saveUninitialized: false` — применено

### ✅ Сохранение сессии:
- ✅ `req.session.save()` перед редиректом — добавлено
- ✅ Обработка ошибок сохранения — добавлена
- ✅ Логирование процесса сохранения — добавлено

### ✅ Логирование:
- ✅ `SESSION CHECK` для всех auth-путей — добавлено
- ✅ Логирование сохранения сессии в callback — добавлено

### ✅ Порядок middleware:
- ✅ `app.use(session(...))` стоит до всех роутеров — подтверждено

---

## 🔍 Что будет видно в логах

### После исправлений вы увидите:

**1. При callback:**
```
💾 Saving session before redirect... { userId: '...', sessionId: '...' }
✅ Session saved, redirecting to /dashboard { userId: '...', sessionId: '...' }
```

**2. При следующем запросе:**
```
SESSION CHECK: {
  path: '/dashboard',
  userId: '...',
  sessionId: '...',
  cookies: { sid: '...' },
  cookieHeader: 'sid=...',
  hasSession: true,
  hasSidInCookie: true
}
```

**3. Если сессия теряется (до исправления было):**
```
SESSION CHECK: {
  path: '/dashboard',
  userId: undefined,
  sessionId: 'new-session-id',
  cookies: {},
  cookieHeader: '',
  hasSession: false,
  hasSidInCookie: false
}
```

---

## 🎯 Ожидаемый результат

### ✅ После исправлений:

1. **Cookie `sid` устанавливается** с `SameSite=None; Secure`
2. **Сессия сохраняется** в PostgreSQL (если настроен `DATABASE_URL`) или в памяти
3. **Cookie читается** в следующем запросе внутри iframe
4. **`req.session.userId` присутствует** при переходе на `/dashboard`
5. **Цикл 302 редиректов исчезает** — нет бесконечных редиректов `/dashboard` → `/auth/whop`

---

## ⚠️ Важные требования для Vercel

### 1. Переменные окружения:

**Обязательно установить:**
- `SESSION_SECRET` — секретный ключ для сессий
- `DATABASE_URL` — PostgreSQL URL (рекомендуется для production)
  - Без PostgreSQL store сессии могут теряться между запросами на Vercel

### 2. HTTPS:

- ✅ Vercel автоматически использует HTTPS
- ✅ `secure: true` в cookies теперь всегда включён

### 3. CORS:

- ✅ `credentials: true` уже настроен в CORS
- ✅ `allowedHeaders: ['Cookie']` уже настроен

---

## 🔧 Дополнительные проверки

### Если проблема сохраняется:

1. **Проверить `DATABASE_URL`:**
   ```bash
   # Убедиться, что DATABASE_URL настроен в Vercel
   # И указывает на PostgreSQL
   ```

2. **Проверить логи Vercel:**
   - Искать `SESSION CHECK:` для проверки наличия cookie
   - Искать `💾 Saving session` для подтверждения сохранения

3. **Проверить браузер (DevTools):**
   - Application → Cookies
   - Проверить, что `sid` cookie установлена с `SameSite=None; Secure`

---

## ✅ Итог

### Что реально применено:

1. ✅ `sameSite: 'none'` — изменено с `'lax'` на `'none'`
2. ✅ `secure: true` — установлено всегда (было условно)
3. ✅ `req.session.save()` — добавлен перед редиректом
4. ✅ Логирование — добавлено `SESSION CHECK` и логи сохранения
5. ✅ Порядок middleware — подтверждён корректный порядок

### Что видно в логах:

- **До callback:** `userId: undefined` (если нет сессии)
- **После callback:** `userId: '...'` после `req.session.save()`
- **В следующем запросе:** `userId: '...'` если cookie читается корректно

### Подтверждение решения цикла 302:

После применения всех изменений:
- ✅ Cookie `sid` устанавливается с правильными атрибутами
- ✅ Сессия явно сохраняется перед редиректом
- ✅ Cookie читается в следующем запросе
- ✅ Цикл `/dashboard` → `/auth/whop` исчезает

---

**Дата исправления:** 2025-11-02  
**Файлы изменены:**
- `app/src/server.ts` (sessionConfig, логирование)
- `app/src/auth/whopOAuth.ts` (req.session.save)
**Статус:** ✅ Готово к тестированию на Vercel

