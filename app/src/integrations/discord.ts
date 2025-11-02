import axios from 'axios';
import { env } from '../config/env.js';

export async function sendDiscord(text: string): Promise<{ messageId?: string }> {
  if (!env.DISCORD_WEBHOOK_URL) return {};
  const res = await axios.post(env.DISCORD_WEBHOOK_URL, { content: text });
  return { messageId: String(res.data?.id || '') };
}



















