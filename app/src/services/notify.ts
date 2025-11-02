import { sendTelegram } from '../integrations/telegram';
import { sendEmail } from '../integrations/email';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface NotifyOptions {
  to: {
    telegramId?: string;
    email?: string;
  };
  subject?: string;
  message: string;
  html?: string;
}

/**
 * Универсальный сервис отправки уведомлений через Telegram и Email
 * 
 * @param options - Параметры уведомления
 * @param options.to - Получатели (telegramId и/или email)
 * @param options.subject - Тема сообщения (для Email)
 * @param options.message - Текст сообщения
 * @param options.html - HTML версия сообщения (для Email, опционально)
 * 
 * @example
 * ```ts
 * await notify({
 *   to: {
 *     telegramId: "123456789",
 *     email: "user@example.com"
 *   },
 *   subject: "Промо рассылка",
 *   message: "Привет! Вот тебе новое обновление 🚀",
 *   html: "<b>Привет!</b> Вот тебе новое обновление 🚀"
 * });
 * ```
 */
export async function notify(options: NotifyOptions): Promise<void> {
  const { to, subject, message, html } = options;

  const promises: Promise<void>[] = [];

  // Отправка в Telegram
  if (to.telegramId && env.ENABLE_TELEGRAM) {
    if (!env.TELEGRAM_BOT_TOKEN) {
      logger.warn('[Telegram] TELEGRAM_BOT_TOKEN не установлен, пропуск отправки');
    } else {
      promises.push(
        sendTelegram(to.telegramId, message)
          .then((result) => {
            if (result.messageId) {
              logger.info({ telegramId: to.telegramId, messageId: result.messageId }, '[Telegram OK]');
            } else {
              logger.warn({ telegramId: to.telegramId }, '[Telegram] Отправлено, но messageId не получен');
            }
          })
          .catch((error: any) => {
            logger.error(
              { telegramId: to.telegramId, error: error?.message || String(error) },
              '[Telegram ERROR]'
            );
            // Не пробрасываем ошибку, чтобы не прервать отправку через другие каналы
          })
      );
    }
  } else if (to.telegramId && !env.ENABLE_TELEGRAM) {
    logger.debug({ telegramId: to.telegramId }, '[Telegram] Канал отключен (ENABLE_TELEGRAM=false)');
  }

  // Отправка Email
  if (to.email && env.ENABLE_EMAIL) {
    if (!env.SMTP_HOST || !env.SMTP_PORT) {
      logger.warn('[Email] SMTP настройки не установлены, пропуск отправки');
    } else {
      const emailSubject = subject || 'Уведомление';
      promises.push(
        sendEmail(to.email, emailSubject, message, html)
          .then((result) => {
            if (result.messageId) {
              logger.info({ email: to.email, messageId: result.messageId }, '[Email OK]');
            } else {
              logger.warn({ email: to.email }, '[Email] Отправлено, но messageId не получен');
            }
          })
          .catch((error: any) => {
            logger.error(
              { email: to.email, error: error?.message || String(error) },
              '[Email ERROR]'
            );
            // Не пробрасываем ошибку, чтобы не прервать отправку через другие каналы
          })
      );
    }
  } else if (to.email && !env.ENABLE_EMAIL) {
    logger.debug({ email: to.email }, '[Email] Канал отключен (ENABLE_EMAIL=false)');
  }

  // Выполняем все отправки параллельно
  await Promise.all(promises);
}













