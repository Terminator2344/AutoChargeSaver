import axios from 'axios';
import { env } from '../config/env';

export async function sendTelegram(tgUserId: string, text: string): Promise<{ messageId?: string }> {
  if (!env.TELEGRAM_BOT_TOKEN) return {};
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await axios.post(url, { chat_id: tgUserId, text, disable_web_page_preview: true });
  return { messageId: String(res.data?.result?.message_id || '') };
}

















