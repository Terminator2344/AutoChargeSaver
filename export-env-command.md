# Команды для экспорта env.ts

## 📋 Основной файл

**Полный путь:** `app/src/config/env.ts`

---

## 🚀 Команды для экспорта (Windows/Linux/Mac)

### Вариант 1: Простое копирование в текущую директорию

**Windows (PowerShell):**
```powershell
Copy-Item "app\src\config\env.ts" -Destination "env.ts.exported"
```

**Windows (CMD):**
```cmd
copy app\src\config\env.ts env.ts.exported
```

**Linux/Mac:**
```bash
cp app/src/config/env.ts env.ts.exported
```

### Вариант 2: Экспорт в папку exports/

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Force -Path "exports"
Copy-Item "app\src\config\env.ts" -Destination "exports\env.ts"
```

**Linux/Mac:**
```bash
mkdir -p exports
cp app/src/config/env.ts exports/env.ts
```

### Вариант 3: Экспорт с timestamp (для версионирования)

**Windows (PowerShell):**
```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item "app\src\config\env.ts" -Destination "env.ts.$timestamp"
```

**Linux/Mac:**
```bash
cp app/src/config/env.ts "env.ts.$(date +%Y%m%d_%H%M%S)"
```

### Вариант 4: Просмотр содержимого (без экспорта файла)

**Windows (PowerShell):**
```powershell
Get-Content "app\src\config\env.ts"
```

**Linux/Mac:**
```bash
cat app/src/config/env.ts
```

---

## 📝 Рекомендуемая команда (универсальная)

Используйте эту команду, она работает на всех платформах:

```bash
cp app/src/config/env.ts env.ts.exported
```

Или для Windows PowerShell:

```powershell
Copy-Item app\src\config\env.ts env.ts.exported
```

---

## 🔍 Проверка экспорта

После экспорта проверьте файл:

```bash
# Linux/Mac
ls -la env.ts.exported

# Windows (PowerShell)
Get-Item env.ts.exported
```

---

## ⚠️ Важно

Файл `env.ts` содержит **только схему валидации**, но **не содержит реальных значений** переменных окружения. 

Реальные значения находятся в:
- `.env` файле (в корне проекта)
- Переменных окружения системы
- Vercel/Render/etc. environment variables (для production)

Чтобы увидеть **реальные значения**, используйте:

```bash
# Windows (PowerShell)
Get-Content .env

# Linux/Mac
cat .env
```

⚠️ **Безопасность:** Не коммитьте `.env` файл в git! Он содержит секретные данные.

