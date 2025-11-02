import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

export async function isRecoveredByClick(userId: string, succeededAt: Date): Promise<{ byClick: boolean; channel?: string }> {
  const windowDays = env.ATTR_WINDOW_DAYS;
  const from = new Date(succeededAt.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const clicks = await prisma.click.findMany({
    where: { userId, clickedAt: { gte: from, lte: succeededAt } },
    orderBy: { clickedAt: 'desc' },
    take: 1,
  });

  if (clicks.length > 0) {
    return { byClick: true, channel: clicks[0].channel };
  }
  return { byClick: false };
}




