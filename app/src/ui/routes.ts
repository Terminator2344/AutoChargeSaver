import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { metricsCache, getCacheKey } from '../services/cache.js';
import { calculateTimeToRecover } from '../services/metrics/timeToRecover.js';
import { calculateLostRevenue } from '../services/metrics/lostRevenue.js';
import { calculateChannelConversion } from '../services/metrics/channelConversion.js';

export const uiRouter = Router();

uiRouter.get('/dashboard', requireAuth, async (req, res, next) => {
  console.log('[DASHBOARD]', 'Rendering dashboard', {
    userId: (req as any).user?.id,
    sessionId: req.sessionID,
    hasSession: !!req.session,
    cookies: req.headers.cookie?.substring(0, 100),
  });
  try {
    const currentUserId = (req as any).user.id;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    
    // Проверка кэша
    const cacheKey = getCacheKey(currentUserId, from, to);
    const cached = metricsCache.get<any>(cacheKey);
    const useCache = !req.query.refresh && cached;
    
    if (useCache) {
      return res.render('dashboard', cached);
    }
    
    // Фильтр по userId + даты
    const baseWhere = { userId: currentUserId };
    const dateFilter = (from || to) ? { occurredAt: { gte: from, lte: to } } : {};
    const where = { ...baseWhere, ...dateFilter };

    const [failed, recoveredTotal, recoveredByClick, recoveredByWindow, succeeded, revenue, clicksCount, timeToRecover, lostRevenueCents, channelConversions] = await Promise.all([
      prisma.event.count({ where: { ...where, type: 'payment_failed' } }).catch(() => 0),
      prisma.event.count({ where: { ...where, recovered: true } }).catch(() => 0),
      prisma.event.count({ where: { ...where, recovered: true, reason: 'click' } }).catch(() => 0),
      prisma.event.count({ where: { ...where, recovered: true, reason: 'window' } }).catch(() => 0),
      prisma.event.count({ where: { ...where, type: 'payment_succeeded' } }).catch(() => 0),
      prisma.event.aggregate({ _sum: { amountCents: true }, where: { ...where, type: 'payment_succeeded' } }).catch(() => ({ _sum: { amountCents: 0 } })),
      prisma.click.count({ where: { userId: currentUserId, ...(from || to ? { clickedAt: { gte: from, lte: to } } : {}) } }).catch(() => 0),
      calculateTimeToRecover(currentUserId, from, to).catch(() => null),
      calculateLostRevenue(currentUserId, from, to).catch(() => 0),
      calculateChannelConversion(currentUserId, from, to).catch(() => []),
    ]);

    // Data for charts
    const succeededEvents = await prisma.event.findMany({
      where: { ...where, type: 'payment_succeeded' },
      select: { amountCents: true, occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    }).catch(() => []);

    const channelRecoveries = await prisma.event.groupBy({
      by: ['channel'],
      _count: true,
      where: { ...where, recovered: true } as any,
    }).catch(() => []);

    const channelClicks = await prisma.click.groupBy({
      by: ['channel'],
      _count: true,
      where: { userId: currentUserId, ...(from || to ? { clickedAt: { gte: from, lte: to } } : {}) },
    }).catch(() => []);

    // Process revenue over time (group by day)
    const revenueByDay: Record<string, number> = {};
    succeededEvents.forEach((e: { amountCents: number | null; occurredAt: Date | null }) => {
      if (e.occurredAt && e.amountCents) {
        const day = new Date(e.occurredAt).toISOString().split('T')[0];
        revenueByDay[day] = (revenueByDay[day] || 0) + (e.amountCents / 100);
      }
    });

    const topChannelAgg = await prisma.event.groupBy({ by: ['channel'], _count: true, where: { ...where, recovered: true } as any, orderBy: { _count: { channel: 'desc' } }, take: 1 }).catch(() => []);
    const topChannel = topChannelAgg[0]?.channel || 'n/a';
    const revenueCents = revenue._sum?.amountCents || 0;

    // Calculate additional metrics
    const recoveryRate = failed > 0 ? ((recoveredTotal / failed) * 100).toFixed(1) : '0.0';
    const clickWindowRatio = recoveredByWindow > 0 ? (recoveredByClick / recoveredByWindow).toFixed(2) : (recoveredByClick > 0 ? '∞' : '0');
    const lostRevenue = (lostRevenueCents / 100).toFixed(2);
    
    // Найти канал с максимальной конверсией
    const topConversionChannel = channelConversions.length > 0 
      ? channelConversions[0] 
      : { channel: 'n/a', conversionRate: 0 };

    const dashboardData = {
      failed,
      recoveredTotal,
      recoveredByClick,
      recoveredByWindow,
      succeeded,
      topChannel,
      revenueCents,
      clicksCount,
      recoveryRate,
      clickWindowRatio,
      timeToRecover,
      lostRevenue,
      topConversionChannel: topConversionChannel.channel,
      topConversionRate: topConversionChannel.conversionRate.toFixed(1),
      channelConversions: JSON.stringify(channelConversions),
      revenueByDay: JSON.stringify(revenueByDay),
      channelRecoveries: JSON.stringify(channelRecoveries),
      channelClicks: JSON.stringify(channelClicks),
      from: req.query.from,
      to: req.query.to,
    };

    // Сохранить в кэш
    metricsCache.set(cacheKey, dashboardData);

    res.render('dashboard', dashboardData);
  } catch (err) {
    next(err);
  }
});

uiRouter.get('/dashboard/events', requireAuth, async (req, res, next) => {
  try {
    const currentUserId = (req as any).user.id;
    const page = Number(req.query.page || '1');
    const pageSize = 20;
    const eventType = req.query.type ? String(req.query.type) : undefined;
    const channel = req.query.channel ? String(req.query.channel) : undefined;
    
    // Фильтры
    const where: any = { userId: currentUserId };
    if (eventType && eventType !== 'all') {
      where.type = eventType;
    }
    if (channel && channel !== 'all') {
      where.channel = channel;
    }
    
    const [events, totalCount] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        include: { user: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }).catch(() => []),
      prisma.event.count({ where }).catch(() => 0),
    ]);
    
    const totalPages = Math.ceil(totalCount / pageSize);
    
    // Получить список уникальных типов и каналов для фильтров
    const [eventTypes, channels] = await Promise.all([
      prisma.event.findMany({
        where: { userId: currentUserId },
        select: { type: true },
        distinct: ['type'],
      }).catch(() => []),
      prisma.event.findMany({
        where: { userId: currentUserId, channel: { not: null } },
        select: { channel: true },
        distinct: ['channel'],
      }).catch(() => []),
    ]);
    
    res.render('events', { 
      events, 
      page, 
      totalPages,
      totalCount,
      eventType: eventType || 'all',
      channel: channel || 'all',
      availableTypes: eventTypes.map((e: any) => e.type),
      availableChannels: channels.map((c: any) => c.channel).filter(Boolean),
    });
  } catch (err) {
    next(err);
  }
});



