import { prisma } from '../../config/prisma';

/**
 * Вычисляет потерянную выручку (не восстановленные платежи)
 * 
 * @param userId - ID пользователя
 * @param from - Начало периода (опционально)
 * @param to - Конец периода (опционально)
 * @returns Сумма потерянной выручки в центах
 */
export async function calculateLostRevenue(
  userId: string,
  from?: Date,
  to?: Date
): Promise<number> {
  const dateFilter = from || to ? { occurredAt: { gte: from, lte: to } } : {};

  const failedEvents = await prisma.event.findMany({
    where: {
      userId,
      type: 'payment_failed',
      ...dateFilter,
    },
    select: { amountCents: true, recovered: true },
  });

  let lostRevenue = 0;

  for (const event of failedEvents) {
    if (!event.recovered && event.amountCents) {
      lostRevenue += event.amountCents;
    }
  }

  return lostRevenue;
}





