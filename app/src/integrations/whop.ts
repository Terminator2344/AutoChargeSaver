import crypto from 'crypto';
import { Request } from 'express';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';
import { env, isDev } from '../config/env';

export function verifyWhopSignature(req: Request): boolean {
  try {
    const secret = env.WHOP_WEBHOOK_SECRET;
    if (!secret) {
      if (isDev) {
        logger.warn('WHOP_WEBHOOK_SECRET not set; accepting webhook in dev mode');
        return true;
      }
      return false;
    }
    const signature = req.header('whop-signature') || req.header('x-whop-signature') || '';
    const payload = (req as any).rawBody || JSON.stringify(req.body);
    const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  } catch {
    return false;
  }
}

export type WhopEventPayload = {
  id: string;
  type: 'payment_failed' | 'payment_succeeded' | string;
  occurredAt: string;
  user: { whopUserId: string; email?: string };
  meta?: Record<string, any>;
  amountCents?: number;
  currency?: string;
};

// Whop API клиент
export function createWhopClient(accessToken?: string): AxiosInstance {
  const apiKey = env.WHOP_API_KEY;
  const token = accessToken || apiKey;

  if (!token) {
    throw new Error('Whop API: no access token or API key provided');
  }

  return axios.create({
    baseURL: 'https://api.whop.com/v2/',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

// Хелпер для получения данных текущего пользователя
export async function getMe(accessToken: string): Promise<any> {
  const client = createWhopClient(accessToken);
  const response = await client.get('/me');
  return response.data;
}












