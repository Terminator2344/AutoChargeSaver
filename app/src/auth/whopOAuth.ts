import { Router } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { env, isDev } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';

export const authRouter = Router();

// OAuth авторизация - редирект на Whop
authRouter.get('/auth/whop', (req, res) => {
  console.log('🚀 [AUTH/whop] route hit');
  console.log('WHOP_CLIENT_ID:', env.WHOP_CLIENT_ID);
  console.log('WHOP_REDIRECT_URI:', env.WHOP_REDIRECT_URI);
  console.log('MOCK_LOGIN:', process.env.MOCK_LOGIN);
  
  // Check MOCK_LOGIN with highest priority
  if (process.env.MOCK_LOGIN === 'true') {
    const email = 'mock@local';
    const whop = 'mock_whop_1';
    console.log('[AUTH/whop]', 'Mock mode → /auth/dev');
    return res.redirect(`/auth/dev?email=${encodeURIComponent(email)}&whop=${encodeURIComponent(whop)}`);
  }
  
  console.log('[AUTH/whop]', 'MOCK_LOGIN=false, checking OAuth config', 'WHOP_CLIENT_ID=', process.env.WHOP_CLIENT_ID);
  logger.info({ processEnv: process.env.MOCK_LOGIN, parsedEnv: env.MOCK_LOGIN }, '[AUTH/WHOP] Checking authentication mode');

  // Check if OAuth is configured (only if MOCK_LOGIN is false)
  if (!env.WHOP_CLIENT_ID || !env.WHOP_CLIENT_SECRET || !env.WHOP_REDIRECT_URI) {
    logger.error('WHOP_CLIENT_ID, WHOP_CLIENT_SECRET or WHOP_REDIRECT_URI not configured');
    
    // Return HTML page instead of redirecting (prevent loop)
    return res.status(501).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>OAuth Not Configured</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #0a0a0a;
              color: #e5e5e5;
              line-height: 1.6;
            }
            h1 { color: #ff5500; }
            code {
              background: rgba(255, 85, 0, 0.1);
              padding: 2px 6px;
              border-radius: 4px;
              font-family: 'Courier New', monospace;
            }
            a {
              color: #fbbf24;
              text-decoration: none;
            }
            a:hover { text-decoration: underline; }
            .info-box {
              background: rgba(255, 85, 0, 0.1);
              border: 1px solid rgba(255, 85, 0, 0.3);
              border-radius: 8px;
              padding: 16px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <h1>🔒 OAuth Not Configured</h1>
          <p>To use real Whop OAuth authentication, you need to configure the following environment variables:</p>
          <ul>
            <li><code>WHOP_CLIENT_ID</code></li>
            <li><code>WHOP_CLIENT_SECRET</code></li>
            <li><code>WHOP_REDIRECT_URI</code></li>
          </ul>
          
          <div class="info-box">
            <strong>💡 Development Mode:</strong><br>
            While developing, you can use mock login instead:<br>
            <ol>
              <li>Set <code>MOCK_LOGIN=true</code> in your <code>.env</code> file</li>
              <li>Or run: <code>npm run dev:mock</code></li>
              <li>Then visit: <a href="/auth/dev?email=test@demo.io&whop=test_whop_1">/auth/dev?email=test@demo.io&whop=test_whop_1</a></li>
            </ol>
          </div>

          <p><strong>To set up real OAuth:</strong></p>
          <ol>
            <li>Go to <a href="https://whop.com/developers" target="_blank">Whop Developer Portal</a></li>
            <li>Create a new OAuth application</li>
            <li>Set Redirect URI to: <code>http://localhost:3000/auth/whop/callback</code> (for local dev)</li>
            <li>Copy Client ID and Client Secret</li>
            <li>Add them to your <code>.env</code> file</li>
          </ol>

          <p><a href="/auth/dev?email=dev@local&whop=dev_whop_1">Try mock login now →</a></p>
        </body>
      </html>
    `);
  }

  const state = crypto.randomUUID();
  req.session.oauthState = state;

  const authUrl = new URL('https://whop.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', env.WHOP_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', env.WHOP_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'read');
  authUrl.searchParams.set('state', state);

  logger.info({ state }, 'Redirecting to Whop OAuth');
  console.log('🌐 Redirecting user to Whop URL:', authUrl.toString());
  res.redirect(authUrl.toString());
});

// OAuth callback - обмен кода на токен
authRouter.get('/auth/whop/callback', async (req, res) => {
  console.log('📩 [AUTH/callback] received request');
  console.log('Query:', req.query);
  console.log('Session state:', req.session?.oauthState);
  
  const { code, state } = req.query;

  if (!code || typeof code !== 'string') {
    logger.warn('OAuth callback missing code');
    return res.status(400).json({ error: 'missing_code' });
  }

  if (state !== req.session?.oauthState) {
    logger.warn({ state, sessionState: req.session?.oauthState }, 'OAuth state mismatch');
    return res.status(400).json({ error: 'invalid_state' });
  }

  if (!env.WHOP_CLIENT_ID || !env.WHOP_CLIENT_SECRET || !env.WHOP_REDIRECT_URI) {
    logger.error('OAuth credentials not configured');
    return res.status(500).json({ error: 'OAuth not configured' });
  }

  try {
    // Обмен authorization code на access token
    console.log('🔑 Exchanging code for token...');
    const tokenResponse = await axios.post('https://api.whop.com/oauth2/token', {
      client_id: env.WHOP_CLIENT_ID,
      client_secret: env.WHOP_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.WHOP_REDIRECT_URI,
    });

    console.log('✅ Token response:', tokenResponse.data);
    const { access_token } = tokenResponse.data;

    // Получить данные пользователя из Whop API
    const userResponse = await axios.get('https://api.whop.com/v2/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    console.log('👤 User response:', userResponse.data);
    const whopUser = userResponse.data;
    const whopUserId = whopUser.id || whopUser.user_id;

    if (!whopUserId) {
      logger.error({ whopUser }, 'Whop API response missing user ID');
      return res.status(500).json({ error: 'invalid_user_data' });
    }

    // Upsert пользователя в БД
    const user = await prisma.user.upsert({
      where: { whopUserId },
      create: {
        whopUserId,
        email: whopUser.email || undefined,
      },
      update: {
        email: whopUser.email || undefined,
      },
    });

    // Сохранить в сессию
    req.session.userId = user.id;
    req.session.whopUserId = user.whopUserId;
    req.session.oauthState = undefined; // Очистить state

    logger.info({ userId: user.id, whopUserId }, 'User authenticated via OAuth');
    logger.info({ redirectUri: env.WHOP_REDIRECT_URI }, '✅ OAuth redirect success');

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
  } catch (error: any) {
    logger.error({ error: error?.message, response: error?.response?.data }, 'OAuth callback error');
    res.status(500).json({ error: 'oauth_failed', message: error?.message });
  }
});

// DEV ONLY - Mock логин для локальной разработки
authRouter.get('/auth/dev', async (req, res) => {
  // Protect dev login in production unless MOCK_LOGIN is explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.MOCK_LOGIN !== 'true') {
    logger.warn('[AUTH/DEV] Dev login accessed in production without MOCK_LOGIN');
    return res.status(404).send('Not found');
  }

  const email = String(req.query.email || 'mock@local');
  const whop = String(req.query.whop || 'mock_whop_1');

  console.log('[AUTH/dev]', 'Login attempt', 'email=', email, 'whop=', whop, 'session.id=', req.sessionID);

  try {
    // 1) Check if user exists in database
    let user = await prisma.user.findUnique({
      where: { whopUserId: whop },
    });

    // 2) Create user if not found
    if (!user) {
      user = await prisma.user.create({
        data: { 
          whopUserId: whop, 
          email: email || 'mock@local',
        },
      });
      console.log('[AUTH/dev] Created or reused mock user', user.email, user.id);
    } else {
      // Update email if provided
      if (email && email !== user.email) {
        user = await prisma.user.update({
          where: { whopUserId: whop },
          data: { email },
        });
      }
      console.log('[AUTH/dev] Created or reused mock user', user.email, user.id);
    }

    logger.info({ email, whopUserId: whop, userId: user.id }, '[AUTH/DEV] User upserted');

    // 2) Regenerate session to create fresh session ID
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error('[AUTH/dev] session.regenerate error', regenErr);
        logger.error({ error: regenErr }, '[AUTH/DEV] Session regenerate error');
        return res.status(500).send('Session error');
      }

      console.log('[AUTH/dev]', 'Session regenerated', 'new session.id=', req.sessionID);

      // 3) Write session data
      req.session.userId = user.id;
      req.session.whopUserId = user.whopUserId;

      console.log('[AUTH/dev]', 'Session data set', 'userId=', req.session.userId);

      // 4) Save session and only then redirect
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[AUTH/dev] session.save error', saveErr);
          logger.error({ error: saveErr }, '[AUTH/DEV] Session save error');
          return res.status(500).send('Session save failed');
        }

        console.log('[AUTH/dev]', 'session saved', 'session.id=', req.sessionID, 'userId=', req.session.userId);
        
        // Verify session data is set
        if (!req.session.userId) {
          console.error('[AUTH/dev]', 'CRITICAL: userId not in session after save!');
          return res.status(500).send('Session data not saved correctly');
        }

        logger.info({ 
          userId: user.id, 
          whopUserId: whop, 
          sessionId: req.sessionID,
          hasUserId: !!req.session.userId 
        }, '[AUTH/DEV] Session created, redirecting to dashboard');
        
        // Cookie will be set automatically by express-session in response headers
        // The redirect response will include Set-Cookie header
        console.log('[AUTH/dev]', 'Redirecting to /dashboard', {
          sessionId: req.sessionID,
          userId: req.session.userId,
          whopUserId: req.session.whopUserId,
        });
        
        // Only one redirect - to dashboard (no additional redirects)
        // Express-session will automatically add Set-Cookie header
        return res.redirect('/dashboard');
      });
    });
  } catch (e: any) {
    console.error('[AUTH/dev] error', e);
    logger.error({ error: e?.message, stack: e?.stack }, '[AUTH/DEV] Mock login error');
    return res.status(500).send('Auth dev failed');
  }
});

// Выход - очистка сессии
authRouter.get('/logout', (req, res) => {
  const userId = req.session?.userId;
  const sessionId = req.sessionID;
  
  req.session.destroy((err) => {
    if (err) {
      logger.error({ error: err, sessionId }, 'Error destroying session');
      // Even if destroy fails, try to redirect
      res.clearCookie('sid');
      return res.redirect('/');
    }
    
    logger.info({ userId, sessionId }, 'User logged out successfully');
    
    // Clear cookie explicitly (defensive)
    res.clearCookie('sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    
    res.redirect('/');
  });
});

