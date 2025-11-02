import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
loadEnv();
const EnvSchema = z.object({
    PORT: z.string().default('3000'),
    APP_HOST: z.string().url(),
    WHOP_WEBHOOK_SECRET: z.string().optional(),
    WHOP_API_KEY: z.string().optional(),
    WHOP_CLIENT_ID: z.string().optional(),
    WHOP_CLIENT_SECRET: z.string().optional(),
    WHOP_REDIRECT_URI: z.string().url().optional(),
    NEXT_PUBLIC_WHOP_APP_ID: z.string().optional(),
    NEXT_PUBLIC_WHOP_AGENT_USER_ID: z.string().optional(),
    NEXT_PUBLIC_WHOP_COMPANY_ID: z.string().optional(),
    SESSION_SECRET: z.string().optional(),
    MOCK_LOGIN: z.string().default('false'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    // Альтернативные переменные для Email (приоритет над SMTP_*)
    EMAIL_HOST: z.string().optional(),
    EMAIL_PORT: z.string().optional(),
    EMAIL_USER: z.string().optional(),
    EMAIL_PASS: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_ADMIN_CHAT_ID: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),
    EMAIL_TO: z.string().optional(),
    DISCORD_BOT_TOKEN: z.string().optional(),
    DISCORD_WEBHOOK_URL: z.string().optional(),
    ENABLE_EMAIL: z.string().default('true'),
    ENABLE_TELEGRAM: z.string().default('false'),
    ENABLE_DISCORD: z.string().default('false'),
    ENABLE_TWITTER: z.string().default('false'),
    ENABLE_INSTAGRAM: z.string().default('false'),
    ATTR_WINDOW_DAYS: z.string().default('7'),
    DATABASE_URL: z.string().optional(),
});
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
    // Produce friendly error
    const issues = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('\n');
    // eslint-disable-next-line no-console
    console.error('Environment validation failed:\n' + issues);
    process.exit(1);
}
const envRaw = parsed.data;
// Проверка критичных переменных
if (!envRaw.WHOP_API_KEY) {
    console.warn('⚠️ Missing WHOP_API_KEY — Whop API calls may fail.');
}
// Поддержка EMAIL_* переменных с приоритетом над SMTP_*
const getEmailConfig = (key) => {
    const emailKey = `EMAIL_${key}`;
    const smtpKey = `SMTP_${key}`;
    return envRaw[emailKey] || envRaw[smtpKey];
};
export const env = {
    ...envRaw,
    PORT: Number(envRaw.PORT || '3000'),
    // Whop API configuration
    WHOP_API_KEY: envRaw.WHOP_API_KEY,
    NEXT_PUBLIC_WHOP_APP_ID: envRaw.NEXT_PUBLIC_WHOP_APP_ID,
    NEXT_PUBLIC_WHOP_AGENT_USER_ID: envRaw.NEXT_PUBLIC_WHOP_AGENT_USER_ID,
    NEXT_PUBLIC_WHOP_COMPANY_ID: envRaw.NEXT_PUBLIC_WHOP_COMPANY_ID,
    // Email конфигурация: приоритет EMAIL_* над SMTP_*
    SMTP_HOST: getEmailConfig('HOST'),
    SMTP_PORT: getEmailConfig('PORT'),
    SMTP_USER: getEmailConfig('USER'),
    SMTP_PASS: getEmailConfig('PASS'),
    SMTP_FROM: getEmailConfig('FROM'),
    ENABLE_EMAIL: envRaw.ENABLE_EMAIL === 'true',
    ENABLE_TELEGRAM: envRaw.ENABLE_TELEGRAM === 'true',
    ENABLE_DISCORD: envRaw.ENABLE_DISCORD === 'true',
    ENABLE_TWITTER: envRaw.ENABLE_TWITTER === 'true',
    ENABLE_INSTAGRAM: envRaw.ENABLE_INSTAGRAM === 'true',
    ATTR_WINDOW_DAYS: Number(envRaw.ATTR_WINDOW_DAYS || '7'),
    MOCK_LOGIN: envRaw.MOCK_LOGIN === 'true',
};
export const isDev = process.env.NODE_ENV !== 'production';
