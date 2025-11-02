import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// Enhanced redaction for sensitive data
const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'token',
  'secret',
  'SESSION_SECRET',
  'WHOP_CLIENT_SECRET',
  'WHOP_WEBHOOK_SECRET',
  'WHOP_API_KEY',
  'SMTP_PASS',
  'EMAIL_PASS',
  'TELEGRAM_BOT_TOKEN',
  'DISCORD_BOT_TOKEN',
  'email',
  'meta.sensitive',
  '*.secret',
  '*.password',
  '*.token',
  '*.api_key',
];

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  redact: {
    paths: redactPaths,
    remove: true,
  },
  // Pretty print in development, JSON in production
  transport: isProduction
    ? undefined // Use default JSON logger in production
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
});




