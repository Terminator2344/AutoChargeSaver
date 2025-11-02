import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { getQueue, withRetries } from './queue.js';
import { takeToken } from '../config/rateLimit.js';
import { sendEmail } from '../integrations/email.js';
import { sendTelegram } from '../integrations/telegram.js';
import { sendDiscord } from '../integrations/discord.js';
import { sendTwitter } from '../integrations/twitter.js';
import { sendInstagram } from '../integrations/instagram.js';
import type { Channel } from '../domain/channels.js';

interface SendArgs {
  channel: Channel;
  to: { email?: string; tgUserId?: string; discordUserId?: string; twitterHandle?: string; instagramId?: string };
  message: { subject?: string; text: string; html?: string };
  meta?: Record<string, any>;
}

export async function send(args: SendArgs): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const queue = getQueue(`send-${args.channel}`, 2);
  const result = await queue.add(async (): Promise<{ ok: boolean; messageId?: string; error?: string }> => {
    const allowed = takeToken(`rate-${args.channel}`, 10, 2);
    if (!allowed) return { ok: false, error: 'rate_limited' };

    const enabled =
      (args.channel === 'email' && env.ENABLE_EMAIL) ||
      (args.channel === 'telegram' && env.ENABLE_TELEGRAM) ||
      (args.channel === 'discord' && env.ENABLE_DISCORD) ||
      (args.channel === 'twitter' && env.ENABLE_TWITTER) ||
      (args.channel === 'instagram' && env.ENABLE_INSTAGRAM);
    if (!enabled) return { ok: false, error: 'channel_disabled' };

    try {
      return await withRetries(async () => {
        switch (args.channel) {
          case 'email': {
            if (!args.to.email) return { ok: false, error: 'missing_recipient' };
            const res = await sendEmail(args.to.email, args.message.subject || '', args.message.text, args.message.html);
            return { ok: true, messageId: res.messageId };
          }
          case 'telegram': {
            if (!args.to.tgUserId) return { ok: false, error: 'missing_recipient' };
            const res = await sendTelegram(args.to.tgUserId, args.message.text);
            return { ok: true, messageId: res.messageId };
          }
          case 'discord': {
            const res = await sendDiscord(args.message.text);
            return { ok: true, messageId: res.messageId };
          }
          case 'twitter': {
            if (!args.to.twitterHandle) return { ok: false, error: 'missing_recipient' };
            const res = await sendTwitter(args.to.twitterHandle, args.message.text);
            return { ok: true, messageId: res.messageId };
          }
          case 'instagram': {
            if (!args.to.instagramId) return { ok: false, error: 'missing_recipient' };
            const res = await sendInstagram(args.to.instagramId, args.message.text);
            return { ok: true, messageId: res.messageId };
          }
          default:
            return { ok: false, error: 'unknown_channel' };
        }
      });
    } catch (err: any) {
      const msg = err?.message || 'send_failed';
      logger.warn({ channel: args.channel, err: msg }, 'Send failed');
      return { ok: false, error: msg };
    }
  });
  
  // Обрабатываем случай, когда queue.add может вернуть void
  if (!result) {
    return { ok: false, error: 'queue_add_failed' };
  }
  
  return result;
}

export type { SendArgs };



