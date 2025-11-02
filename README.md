## Revenue Recovery Assistant for Whop

A production-ready multi-user SaaS dashboard for Whop sellers to recover failed payments. Features OAuth authentication, multi-channel notifications, advanced analytics, and real-time metrics tracking.

### Features
- **Multi-User Dashboard** with Whop OAuth authentication
- **Webhook listener** for Whop events (`/webhooks/whop`) with idempotency
- **Multi-channel notifications** (Email, Telegram, Discord) with rate limiting and retries
- **Advanced Analytics**: Time to Recover, Lost Revenue, Channel Conversion Rates
- **Click tracking** redirect (`/r/:userId`) and attribution (click vs window)
- **Real-time Dashboard** with auto-refresh every 60 seconds
- **Security**: Rate limiting, CSRF protection, session management
- **Performance**: Metric caching, optimized queries, health checks
- **Prisma ORM** (SQLite by default; easy switch to Postgres)
- **Structured logging** with Pino (JSON format)

### Quick Start (Node 20+ LTS supported)

#### 1. Install dependencies:
```bash
npm i
```

#### 2. Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env` and configure:
- Database URL (SQLite for local dev)
- Whop OAuth credentials (see OAuth Setup below)
- Email/SMTP settings
- Channel feature flags

#### 3. Run database migrations:
```bash
npx prisma migrate dev
```

#### 4. Start development server:

**Option A: With Mock Login (No Whop OAuth required)**
```bash
npm run dev:mock
```
Then open in browser:
- `http://localhost:3000/auth/dev?email=test@demo.io&whop=test_whop_1`

**Option B: Standard Dev Mode (Requires Whop OAuth config)**
```bash
npm run dev
```
Then visit `http://localhost:3000/dashboard` (will redirect to OAuth if not authenticated).

App will boot on `http://localhost:3000`.

**Quick Test:**
```bash
# Health check
curl http://localhost:3000/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

### OAuth Setup (Whop Dashboard)

To enable multi-user authentication:

1. **Register your app in Whop Dashboard:**
   - Go to [Whop Developer Portal](https://whop.com/developers)
   - Create a new OAuth application
   - Set redirect URI: `http://localhost:3000/auth/whop/callback` (or your production URL)
   - Copy `Client ID` and `Client Secret`

2. **Update `.env`:**
   ```env
   WHOP_CLIENT_ID=your_client_id
   WHOP_CLIENT_SECRET=your_client_secret
   WHOP_REDIRECT_URI=http://localhost:3000/auth/whop/callback
   SESSION_SECRET=generate-a-random-secret-here
   ```

3. **For local testing (without OAuth):**
   ```env
   MOCK_LOGIN=true
   ```
   Then visit: `http://localhost:3000/auth/dev?email=test@demo.io&whop=whop_user_123`

**⚠️ Important:** Disable `MOCK_LOGIN` in production!

### How to Run Locally (Development Mock Mode)

#### Quick Start with Mock Login (Recommended for Local Development)

This mode allows you to test the entire application flow without configuring Whop OAuth:

1. **Start the dev server with mock login:**
   ```bash
   npm run dev:mock
   ```

2. **Open in browser:**
   ```
   http://localhost:3000/auth/dev?email=test@demo.io&whop=test_whop_1
   ```
   You can use any email and whop user ID for testing.

3. **Alternative: Auto-redirect from OAuth endpoint:**
   ```
   http://localhost:3000/auth/whop
   ```
   With `MOCK_LOGIN=true`, this will automatically redirect to `/auth/dev`.

4. **Test the full flow:**
   - After login, you'll be redirected to `/dashboard`
   - Navigate to `/dashboard/events` to see events table
   - Test webhook endpoints (if configured)

**Health Check:**
```bash
curl http://localhost:3000/api/health
# Returns: {"status":"ok","timestamp":"2025-01-01T12:00:00.000Z"}
```

**Notes:**
- Mock login only works when `MOCK_LOGIN=true` (automatically set by `npm run dev:mock`)
- In production, `/auth/dev` is disabled unless `MOCK_LOGIN=true` is explicitly set
- All user data is stored in your local database, allowing full testing of the dashboard and events

---

#### Real OAuth Mode (Production-like Testing)

To test with real Whop OAuth:

1. **Configure Whop OAuth credentials in `.env`** (see OAuth Setup section above)
2. **Set `MOCK_LOGIN=false` or remove it from `.env`**
3. **Start server:**
   ```bash
   npm run dev
   ```
4. **Visit:** `http://localhost:3000/dashboard`
5. **You'll be redirected to Whop OAuth login**
6. **After authorization, you'll return to `/dashboard`**

**If OAuth is not configured**, visiting `/auth/whop` will show a helpful HTML page with instructions.

---

### Troubleshooting: ERR_TOO_MANY_REDIRECTS

If you see `ERR_TOO_MANY_REDIRECTS` in development mode:

1. **Check MOCK_LOGIN setting:**
   ```bash
   # Should be set in .env or via npm run dev:mock
   MOCK_LOGIN=true
   ```

2. **Verify session configuration:**
   - In `server.ts`, `resave: true` and `saveUninitialized: true` must be set
   - `secure: false` for development (auto-set)
   - Session middleware must be **before** all routers

3. **Check session save:**
   - `/auth/dev` must call `req.session.save()` before redirect
   - Verify with `/debug/session` endpoint

4. **Clear browser cookies:**
   - Open DevTools → Application → Cookies → delete all for localhost
   - Or use Incognito mode

5. **Check logs:**
   - Look for `[AUTH/requireAuth]` and `[AUTH/dev]` messages
   - Verify `session.id` and `userId` are being set

**Quick fix:**
```bash
# Restart with explicit mock mode
npm run dev:mock
# Then visit: http://localhost:3000/auth/dev?email=test@demo.io&whop=test_whop_1
```

### API Endpoints

- `GET /api/health` - Health check (no auth required)
- `GET /api/me` - Current user info (requires auth)
- `GET /api/analytics` - Dashboard metrics (requires auth, filtered by user)
- `GET /api/analytics/by-channel` - Channel performance (requires auth)
- `POST /api/notify-failed` - Manually trigger notifications (requires auth)
- `POST /webhooks/whop` - Whop webhook handler (signature verified)

### Dashboard Features

- **Real-time Metrics**: Revenue, Recovery Rate, Time to Recover, Lost Revenue
- **Channel Analytics**: Conversion rates, top performing channels
- **Event Tracking**: Filterable event history with pagination
- **Auto-refresh**: Dashboard updates every 60 seconds
- **Export**: CSV export of dashboard data

### Security Features

- Rate limiting: 100 requests per 15 minutes (API)
- Session-based authentication
- Webhook signature verification
- User data isolation (all queries filtered by userId)
- Webhook logging for audit trail

For local email testing, use MailHog:
```bash
docker run -it --rm -p 1025:1025 -p 8025:8025 mailhog/mailhog
```
Set SMTP vars to MailHog defaults.

### Run tests
```bash
npm run test
```

### Sample Whop events
`payment_failed`:
```json
{
  "id": "evt_failed_1",
  "type": "payment_failed",
  "occurredAt": "2024-10-01T12:00:00.000Z",
  "user": { "whopUserId": "whop_u_1", "email": "user@example.com" },
  "meta": { "telegram": "123456789", "discord": "987654321" },
  "amountCents": 1299,
  "currency": "USD"
}
```

`payment_succeeded`:
```json
{
  "id": "evt_success_1",
  "type": "payment_succeeded",
  "occurredAt": "2024-10-02T09:00:00.000Z",
  "user": { "whopUserId": "whop_u_1", "email": "user@example.com" },
  "amountCents": 1299,
  "currency": "USD"
}
```

`subscription_cancelled`:
```json
{
  "id": "evt_cancel_1",
  "type": "subscription_cancelled",
  "occurredAt": "2024-10-03T10:00:00.000Z",
  "user": { "whopUserId": "whop_u_1", "email": "user@example.com" }
}
```

### Add a new channel
1. Implement `integrations/<channel>.ts` exporting a `send<Channel>()` that returns `{ messageId?: string }`.
2. Register it in `app/src/domain/channels.ts`.
3. Add an `ENABLE_<CHANNEL>` flag in env, wire it in `notifications/sender.ts`.

### Attribution window
Recoveries are attributed to the most recent click within `ATTR_WINDOW_DAYS`. If none, recovery is marked as `window`.

### Docker (optional)
`docker-compose.yml` includes commented Postgres service to switch from SQLite. Update Prisma datasource accordingly.

### Production Deployment

#### Switching Between Dev and Production Modes

**Development Mode (Mock Login):**
```bash
# Option 1: Use npm script
npm run dev:mock

# Option 2: Set environment variables
export MOCK_LOGIN=true
export NODE_ENV=development
npm run dev
```

**Production Mode (Real OAuth):**
```bash
# Set environment variables
export NODE_ENV=production
export MOCK_LOGIN=false
export WHOP_CLIENT_ID=your_client_id
export WHOP_CLIENT_SECRET=your_client_secret
export WHOP_REDIRECT_URI=https://your-domain.com/auth/whop/callback
npm run start
```

**Key Differences:**
- **Dev Mode:** Uses mock login (`/auth/dev`), memory session store, pretty logging, debug endpoints enabled
- **Production Mode:** Requires Whop OAuth, PostgreSQL session store, JSON logging, mock endpoints disabled

#### Environment Variables (Production)
- Set `NODE_ENV=production`
- Use strong `SESSION_SECRET` (generate with: `openssl rand -base64 32`)
- **CRITICAL:** Set `MOCK_LOGIN=false` (mock login is disabled automatically in production)
- Configure production `APP_HOST` and `WHOP_REDIRECT_URI`
- Use PostgreSQL for production databases (recommended)
- All sensitive keys (secrets, tokens) are automatically redacted from logs

#### Health Check
Monitor your deployment with:
```bash
# Standard health check
curl https://yourdomain.com/api/health

# Kubernetes/Docker health check (also available)
curl https://yourdomain.com/healthz
```

#### Database Migrations (Production)
```bash
npx prisma migrate deploy
```

---

## 🌍 Deployment Guide

### Option 1: Deploy to Render

1. **Push project to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for production deployment"
   git push origin main
   ```

2. **Create new Render Web Service**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

3. **Configure Render Service**
   - **Name**: `autocharge-saver` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: Leave empty (project root)
   - **Build Command**: 
     ```bash
     npm install && npx prisma migrate deploy
     ```
   - **Start Command**: 
     ```bash
     npm run start
     ```

4. **Add Environment Variables in Render Dashboard**
   - Go to "Environment" tab
   - Add all variables from `.env.example`:
     - `NODE_ENV=production`
     - `APP_HOST=https://your-app-name.onrender.com` (will be set automatically)
     - `DATABASE_URL` (use Render PostgreSQL or external)
     - `WHOP_CLIENT_ID`, `WHOP_CLIENT_SECRET`
     - `WHOP_REDIRECT_URI=https://your-app-name.onrender.com/auth/whop/callback`
     - `SESSION_SECRET` (generate strong secret)
     - All other variables from `.env.example`

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note your domain (e.g., `https://autocharge-saver.onrender.com`)

6. **Update Whop OAuth Settings**
   - Go to [Whop Developer Portal](https://whop.com/developers)
   - Edit your OAuth application
   - Add Redirect URI: `https://your-app-name.onrender.com/auth/whop/callback`
   - Save changes

7. **Verify Deployment**
   - Health check: `https://your-app-name.onrender.com/api/health`
   - Dashboard: `https://your-app-name.onrender.com/dashboard`
   - Should redirect to Whop OAuth if not authenticated

---

### Option 2: Deploy to Vercel

1. **Import project in Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Select your repository

2. **Configure Build Settings**
   - **Framework Preset**: Other
   - **Root Directory**: Leave empty (or set to project root)
   - **Build Command**: 
     ```bash
     npm run build
     ```
   - **Output Directory**: Leave empty (Express server)
   - **Install Command**: `npm install`

3. **Add Environment Variables**
   - Go to "Settings" → "Environment Variables"
   - Add all variables from `.env.example`:
     - `NODE_ENV=production`
     - `APP_HOST` (will be auto-set to Vercel domain, or set custom)
     - `DATABASE_URL` (use Vercel Postgres or external)
     - `WHOP_CLIENT_ID`, `WHOP_CLIENT_SECRET`
     - `WHOP_REDIRECT_URI=https://your-project.vercel.app/auth/whop/callback`
     - `SESSION_SECRET` (generate strong secret)
     - All other variables

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Note your domain (e.g., `https://autocharge-saver.vercel.app`)

5. **Update Whop OAuth Settings**
   - Go to [Whop Developer Portal](https://whop.com/developers)
   - Edit your OAuth application
   - Add Redirect URI: `https://your-project.vercel.app/auth/whop/callback`
   - Save changes

6. **Run Database Migrations**
   ```bash
   npx prisma migrate deploy
   ```
   Or use Vercel CLI:
   ```bash
   vercel env pull .env.local
   npx prisma migrate deploy
   ```

7. **Verify Deployment**
   - Health check: `https://your-project.vercel.app/api/health`
   - Dashboard: `https://your-project.vercel.app/dashboard`

---

## 🌐 Custom Domain Setup

### For Vercel:

1. **Register Domain**
   - Use Namecheap, Cloudflare, Google Domains, or any registrar

2. **Configure DNS**
   - Add CNAME record:
     - **Type**: CNAME
     - **Name**: `dashboard` (or `app`, `www`)
     - **Value**: `cname.vercel-dns.com`
   - For apex domain (`yourdomain.com`), use A records (check Vercel docs)

3. **Add Domain in Vercel**
   - Go to your project → "Settings" → "Domains"
   - Add your domain: `dashboard.yourdomain.com`
   - Vercel will automatically provision SSL/HTTPS

4. **Update Environment Variables**
   - In Vercel dashboard, update:
     ```env
     APP_HOST=https://dashboard.yourdomain.com
     WHOP_REDIRECT_URI=https://dashboard.yourdomain.com/auth/whop/callback
     ```

5. **Update Whop OAuth**
   - Add new Redirect URI in Whop Developer Dashboard:
     `https://dashboard.yourdomain.com/auth/whop/callback`

### For Render:

1. **Register Domain**
   - Use any registrar (Namecheap, Cloudflare, etc.)

2. **Configure DNS**
   - Add CNAME record:
     - **Type**: CNAME
     - **Name**: `dashboard` (or `app`)
     - **Value**: `your-app-name.onrender.com`

3. **Add Custom Domain in Render**
   - Go to your service → "Settings" → "Custom Domains"
   - Add your domain
   - Render will automatically provision SSL/HTTPS

4. **Update Environment Variables**
   - In Render dashboard:
     ```env
     APP_HOST=https://dashboard.yourdomain.com
     WHOP_REDIRECT_URI=https://dashboard.yourdomain.com/auth/whop/callback
     ```

5. **Update Whop OAuth**
   - Add new Redirect URI in Whop Developer Dashboard:
     `https://dashboard.yourdomain.com/auth/whop/callback`

---

### Post-Deployment Checklist

- [ ] Health check returns `{ status: "ok" }`
- [ ] OAuth redirect URI matches Whop Developer Dashboard exactly
- [ ] Dashboard loads and redirects to OAuth if not authenticated
- [ ] After OAuth login, redirects back to dashboard successfully
- [ ] All environment variables are set (check logs for errors)
- [ ] Database migrations completed (`npx prisma migrate deploy`)
- [ ] SSL/HTTPS is active (check certificate in browser)
- [ ] Custom domain (if used) is properly configured
- [ ] Rate limiting and security headers are active
- [ ] Webhook endpoint is accessible: `/webhooks/whop`

---

### Troubleshooting

**Issue: OAuth redirect fails**
- Check that `WHOP_REDIRECT_URI` exactly matches the URI in Whop Developer Dashboard
- Ensure `APP_HOST` is set correctly (no trailing slash)
- Check server logs for OAuth errors

**Issue: Database connection errors**
- Verify `DATABASE_URL` is correct
- For Vercel, consider using Vercel Postgres
- For Render, use Render PostgreSQL
- Ensure migrations are run: `npx prisma migrate deploy`

**Issue: 500 errors on deployment**
- Check environment variables are all set
- Verify `SESSION_SECRET` is strong (32+ characters)
- Check build logs for TypeScript/compilation errors
- Ensure `NODE_ENV=production` is set

**Issue: Health check fails**
- Verify `/api/health` endpoint exists
- Check server logs for startup errors
- Ensure port is correctly configured (usually auto-set by platform)

### Development

#### Run Tests
```bash
npm run test
npm run test:telegram  # Test Telegram integration
npm run test:email     # Test Email integration
npm run test:notify     # Test notification service
```

#### Database Studio
```bash
npm run studio
```

#### Build for Production
```bash
npm run build
npm start
```

### Architecture

- **Express.js** - Web framework
- **Prisma** - Database ORM
- **Pino** - Structured logging
- **EJS** - Server-side templating
- **TypeScript** - Type safety
- **Whop OAuth** - Multi-user authentication
- **Node-Cache** - Metric caching (60s TTL)
- **Rate Limiting** - API protection


