import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { requireAuth } from '../middleware/auth';

export const analyticsRouter = Router();

// API endpoint для получения данных текущего пользователя
analyticsRouter.get('/api/me', requireAuth, async (req, res) => {
  const user = (req as any).user;
  res.json({
    id: user.id,
    whopUserId: user.whopUserId,
    email: user.email,
    createdAt: user.createdAt,
  });
});

const rangeSchema = z.object({ from: z.string().optional(), to: z.string().optional() });

function parseRange(query: any) {
  const parsed = rangeSchema.safeParse(query);
  if (!parsed.success) return {} as { from?: Date; to?: Date };
  const from = parsed.data.from ? new Date(parsed.data.from) : undefined;
  const to = parsed.data.to ? new Date(parsed.data.to) : undefined;
  return { from, to };
}

analyticsRouter.get('/api/analytics', requireAuth, async (req, res) => {
  const currentUserId = (req as any).user.id;
  const { from, to } = parseRange(req.query);
  const baseWhere = { userId: currentUserId };
  const dateFilter = from || to ? { occurredAt: { gte: from, lte: to } } : {};
  const where = { ...baseWhere, ...dateFilter } as any;
  const clickDateFilter = from || to ? { clickedAt: { gte: from, lte: to } } : {};

  const [failedCount, succeededCount, recoveredByClick, recoveredByWindow, clicksCount, succeededEvents] = await Promise.all([
    prisma.event.count({ where: { ...where, type: 'payment_failed' } }),
    prisma.event.count({ where: { ...where, type: 'payment_succeeded' } }),
    prisma.event.count({ where: { ...where, recovered: true, reason: 'click' } }),
    prisma.event.count({ where: { ...where, recovered: true, reason: 'window' } }),
    prisma.click.count({ where: { userId: currentUserId, ...clickDateFilter } }),
    prisma.event.findMany({ where: { ...where, type: 'payment_succeeded' }, select: { amountCents: true, occurredAt: true, userId: true } }),
  ]);

  const revenueCents = succeededEvents.reduce((sum: number, e: any) => sum + (e.amountCents || 0), 0);
  const ctr = failedCount > 0 ? clicksCount / failedCount : 0;

  res.json({ failed: failedCount, succeeded: succeededCount, recoveredByClick, recoveredByWindow, ctr, revenueCents });
});

analyticsRouter.get('/api/analytics/by-channel', requireAuth, async (req, res) => {
  const currentUserId = (req as any).user.id;
  const { from, to } = parseRange(req.query);
  const clickDateFilter = from || to ? { clickedAt: { gte: from, lte: to } } : {};
  const eventDateFilter = from || to ? { occurredAt: { gte: from, lte: to } } : {};
  
  const clicks = await prisma.click.groupBy({ 
    by: ['channel'], 
    _count: true, 
    where: { userId: currentUserId, ...clickDateFilter } 
  });
  
  const recoveries = await prisma.event.groupBy({ 
    by: ['channel'], 
    _count: true, 
    where: { userId: currentUserId, recovered: true, ...eventDateFilter } as any 
  });

  const byChannel: Record<string, { clicks: number; recoveries: number; conversion: number }> = {};
  for (const c of clicks) byChannel[c.channel || 'unknown'] = { clicks: c._count, recoveries: 0, conversion: 0 };
  for (const r of recoveries) {
    const key = r.channel || 'unknown';
    byChannel[key] = byChannel[key] || { clicks: 0, recoveries: 0, conversion: 0 };
    byChannel[key].recoveries = r._count;
  }
  for (const key of Object.keys(byChannel)) {
    const { clicks: c, recoveries: r } = byChannel[key];
    byChannel[key].conversion = c > 0 ? r / c : 0;
  }

  res.json(byChannel);
});












