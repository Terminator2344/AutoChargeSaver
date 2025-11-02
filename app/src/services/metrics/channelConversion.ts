import { prisma } from '../../config/prisma';

export type ChannelConversion = {
  channel: string;
  clicks: number;
  recoveries: number;
  conversionRate: number; // в процентах
};

/**
 * Вычисляет коэффициент конверсии по каждому каналу
 * 
 * @param userId - ID пользователя
 * @param from - Начало периода (опционально)
 * @param to - Конец периода (опционально)
 * @returns Массив конверсий по каналам
 */
export async function calculateChannelConversion(
  userId: string,
  from?: Date,
  to?: Date
): Promise<ChannelConversion[]> {
  const dateFilter = from || to ? { occurredAt: { gte: from, lte: to } } : {};
  const clickDateFilter = from || to ? { clickedAt: { gte: from, lte: to } } : {};

  const [clicksByChannel, recoveriesByChannel] = await Promise.all([
    prisma.click.groupBy({
      by: ['channel'],
      _count: true,
      where: {
        userId,
        ...clickDateFilter,
      },
    }),
    prisma.event.groupBy({
      by: ['channel'],
      _count: true,
      where: {
        userId,
        recovered: true,
        reason: 'click',
        ...dateFilter,
      } as any,
    }),
  ]);

  const channelMap = new Map<string, { clicks: number; recoveries: number }>();

  // Инициализировать все каналы из кликов
  for (const click of clicksByChannel) {
    const channel = click.channel || 'unknown';
    channelMap.set(channel, { clicks: click._count, recoveries: 0 });
  }

  // Добавить восстановления
  for (const recovery of recoveriesByChannel) {
    const channel = recovery.channel || 'unknown';
    const existing = channelMap.get(channel) || { clicks: 0, recoveries: 0 };
    channelMap.set(channel, { ...existing, recoveries: recovery._count });
  }

  const results: ChannelConversion[] = [];

  for (const [channel, data] of channelMap.entries()) {
    const conversionRate = data.clicks > 0 
      ? (data.recoveries / data.clicks) * 100 
      : 0;

    results.push({
      channel,
      clicks: data.clicks,
      recoveries: data.recoveries,
      conversionRate: Math.round(conversionRate * 10) / 10, // Округлить до 1 знака
    });
  }

  return results.sort((a, b) => b.conversionRate - a.conversionRate);
}





