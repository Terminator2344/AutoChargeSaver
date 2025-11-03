import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

// Diagnostic logging after env load
console.log('[BOOT]', 'NODE_ENV=', process.env.NODE_ENV, 'MOCK_LOGIN=', process.env.MOCK_LOGIN, 'WHOP_CLIENT_ID=', process.env.WHOP_CLIENT_ID);
import { whopRouter } from './webhooks/whopWebhook.js';
import { recoveryRouter } from './api/recovery.js';
import { analyticsRouter } from './api/analytics.js';
import { uiRouter } from './ui/routes.js';
import { authRouter } from './auth/whopOAuth.js';
import { clickRedirectHandler } from './tracking/clickRedirect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('view engine', 'ejs');
// After compilation, dist/server.js → views are at ../app/views
app.set('views', path.join(__dirname, '../app/views'));

app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as any).id = req.headers['x-request-id'] || crypto.randomUUID();
  next();
});

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req as any).id,
    redact: ['req.headers.authorization', 'res.headers'],
  })
);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        scriptSrcElem: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        styleSrcAttr: ["'unsafe-inline'"],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
// CORS must allow credentials for cookies
// Clean origin URL to prevent invalid header characters
const cleanOrigin = env.APP_HOST?.trim().replace(/\/$/, '') || env.APP_HOST;

app.use(cors({ 
  origin: cleanOrigin, 
  credentials: true, // Critical: must be true for cookies to work
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

app.use(cookieParser());

// In dev, explicitly set trust proxy to 0 to avoid cookie issues
if (process.env.NODE_ENV !== 'production') {
  app.set('trust proxy', 0);
}

// Configure session store (PostgreSQL in production, memory in dev if no DB)
// ⚠️ IMPORTANT: On Vercel serverless, in-memory store loses sessions between requests!
// PostgreSQL store is REQUIRED for production on Vercel.
let sessionStore: session.Store | undefined;

// Safely initialize session store with proper error handling
try {
  // Check if DATABASE_URL exists and is a valid PostgreSQL connection string
  const hasDatabaseUrl = !!env.DATABASE_URL && typeof env.DATABASE_URL === 'string' && env.DATABASE_URL.trim().length > 0;
  const isPostgreSQL = hasDatabaseUrl && (env.DATABASE_URL!.startsWith('postgresql://') || env.DATABASE_URL!.startsWith('postgres://'));
  
  if (hasDatabaseUrl && isPostgreSQL) {
    // Safe initialization of PostgreSQL store
    const PGStore = connectPgSimple(session);
    sessionStore = new PGStore({
      conString: env.DATABASE_URL!,
      tableName: 'session', // Table name in database
      createTableIfMissing: true, // Auto-create session table if missing
      // Auto-clean expired sessions every hour (default is 60 minutes)
      pruneSessionInterval: 60,
    });
    logger.info('✅ Using PostgreSQL session store with auto-cleanup (sessions will persist across requests)');
    console.log('✅ Using PostgreSQL session store');
  } else {
    // Fallback to MemoryStore if DATABASE_URL is missing or invalid
    sessionStore = undefined; // express-session will use MemoryStore by default
    if (!hasDatabaseUrl) {
      console.warn('⚠️ DATABASE_URL not set, using MemoryStore');
      logger.warn('DATABASE_URL not set - using in-memory session store');
    } else {
      console.warn('⚠️ DATABASE_URL is set but does not point to PostgreSQL, using MemoryStore');
      logger.warn('DATABASE_URL is not a PostgreSQL connection string - using in-memory session store');
    }
    console.warn('⚠️ Sessions will NOT persist between requests on Vercel (in-memory store will reset)');
    console.warn('⚠️ Set DATABASE_URL=postgresql://user:password@host:port/dbname to enable persistent sessions');
  }
  
  // Log session store configuration
  console.log('SESSION STORE CHECK:', {
    hasDatabaseUrl: !!env.DATABASE_URL,
    storeType: sessionStore ? 'PostgreSQL' : 'MemoryStore',
    databaseUrlValid: hasDatabaseUrl && isPostgreSQL,
  });
} catch (error) {
  // Graceful fallback if initialization fails
  sessionStore = undefined; // express-session will use MemoryStore by default
  logger.error({ error }, 'Failed to initialize PostgreSQL session store, falling back to memory store');
  console.error('❌ Error initializing PostgreSQL session store:', error);
  console.warn('⚠️ Falling back to in-memory store (sessions will be lost on Vercel)');
  console.log('SESSION STORE CHECK:', {
    hasDatabaseUrl: !!env.DATABASE_URL,
    storeType: 'MemoryStore',
    error: error instanceof Error ? error.message : 'Unknown error',
  });
}

// Check environment variables for session configuration
if (!env.SESSION_SECRET) {
  console.warn('⚠️ WARNING: SESSION_SECRET not set. Using fallback secret (not secure for production!)');
  logger.warn('SESSION_SECRET not configured - using fallback secret');
}

// Determine cookie domain based on APP_HOST or current environment
// For Vercel iframe: use .vercel.app domain to allow cookie across subdomains
let cookieDomain: string | undefined = undefined;
if (process.env.VERCEL || env.APP_HOST?.includes('.vercel.app')) {
  // Extract base domain from APP_HOST or use .vercel.app
  if (env.APP_HOST?.includes('.vercel.app')) {
    // Extract domain like 'project-name.vercel.app' -> '.vercel.app'
    cookieDomain = '.vercel.app';
    console.log('✅ Cookie domain set to .vercel.app for Vercel deployment');
  }
} else if (env.APP_HOST) {
  try {
    const url = new URL(env.APP_HOST);
    // For custom domains, don't set domain (let browser handle it)
    cookieDomain = undefined;
    console.log('ℹ️ Custom domain detected, cookie domain not set (allowing browser default)');
  } catch {
    cookieDomain = undefined;
  }
}

// Session middleware (must be before all routers)
const sessionConfig: session.SessionOptions = {
  name: 'sid', // Explicit cookie name
  secret: env.SESSION_SECRET || 'dev-secret',
  resave: false, // Don't save session if not modified
  saveUninitialized: false, // Don't save uninitialized sessions
  rolling: true, // Reset expiration on every request
  cookie: {
    secure: true, // Always true for iframe (requires HTTPS)
    httpOnly: true,
    sameSite: 'none', // Required for iframe cross-site requests
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/', // Explicit path to ensure cookie is sent for all routes
    domain: cookieDomain, // Set to .vercel.app for Vercel, undefined for custom domains
  },
};

if (sessionStore) {
  sessionConfig.store = sessionStore;
  console.log('✅ Session store configured: PostgreSQL (persistent)');
} else {
  console.warn('⚠️ Session store: in-memory (NOT persistent on Vercel serverless)');
}

app.use(session(sessionConfig));

// Diagnostic middleware to log session reading
app.use((req: Request, res: Response, next: NextFunction) => {
  // Log session check for all auth-related paths
  if (req.path === '/dashboard' || req.path.startsWith('/dashboard') || req.path === '/auth/dev' || req.path === '/auth/whop' || req.path === '/auth/whop/callback') {
    console.log('SESSION CHECK:', {
      sessionId: req.sessionID,
      userId: req.session?.userId,
      cookies: req.headers.cookie?.substring(0, 150),
      hasSession: !!req.session,
      hasSidCookie: req.headers.cookie?.includes('sid='),
      cookieDomain: sessionConfig.cookie?.domain,
    });
  }
  next();
});

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // Webhooks can be more frequent
  skip: (req) => {
    // Skip rate limit for webhooks with valid signature (handled in webhook handler)
    return !!req.header('whop-signature') || !!req.header('x-whop-signature');
  },
});

// Production mode improvements
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust proxy headers (for Vercel/Render)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  logger.info('Production mode enabled: trust proxy and HSTS headers active');
}

// Apply rate limiting to API routes
app.use('/api', apiLimiter);
app.use('/webhooks', webhookLimiter);

// Capture raw body for signature verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// Health check endpoints (before auth)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Kubernetes/Docker health check endpoint (standard /healthz)
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint for session diagnostics
app.get('/debug/session', (req, res) => {
  res.json({
    sessionId: req.sessionID,
    keys: Object.keys(req.session || {}),
    userId: req.session?.userId,
    whopUserId: req.session?.whopUserId,
    hasSession: !!req.session,
  });
});

app.get('/r/:userId', clickRedirectHandler);

// Root redirect (before auth routers to avoid loops)
app.get('/', (_req, res) => {
  console.log('[ROOT]', 'Redirecting / → /dashboard');
  return res.redirect('/dashboard');
});

app.use(authRouter);
console.log('✅ Whop callback route mounted at /auth/whop/callback');
console.log('✅ Whop callback route mounted at /api/whop/callback');
app.use(whopRouter);
app.use(recoveryRouter);
app.use(analyticsRouter);
app.use(uiRouter);

// Enhanced error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const isDev = process.env.NODE_ENV !== 'production';
  
  logger.error({ 
    err, 
    stack: err?.stack, 
    message: err?.message,
    path: _req.path,
    method: _req.method,
  }, 'Unhandled error');
  
  // Handle 404 errors
  if (err?.status === 404 || err?.statusCode === 404) {
    if (_req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'not_found', path: _req.path });
    }
    return res.status(404).send('Not Found');
  }
  
  // Handle validation errors
  if (err?.name === 'ZodError' || err?.issues) {
    return res.status(400).json({ 
      error: 'validation_error', 
      details: isDev ? err.issues || err.message : undefined 
    });
  }
  
  // Generic error response
  const statusCode = err?.status || err?.statusCode || 500;
  res.status(statusCode).json({ 
    error: 'internal_error', 
    message: isDev ? err?.message : 'An error occurred',
    ...(isDev && { stack: err?.stack }),
  });
});

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server listening');
});

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down gracefully...');
  
  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Disconnect Prisma
    try {
      const { prisma } = await import('./config/prisma.js');
      await prisma.$disconnect();
      logger.info('Prisma disconnected');
    } catch (err) {
      logger.warn({ err }, 'Error disconnecting Prisma');
    }
    
    // Disconnect PostgreSQL session store if used
    if (sessionStore && 'close' in sessionStore) {
      try {
        const closeMethod = (sessionStore as any).close;
        if (typeof closeMethod === 'function') {
          await new Promise<void>((resolve) => {
            closeMethod(() => resolve());
          });
          logger.info('Session store closed');
        }
      } catch (err) {
        logger.warn({ err }, 'Error closing session store');
      }
    }
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  // Don't exit on unhandled rejection, just log it
});

export default app;



