import { prisma } from '../../config/prisma';

/**
 * Вычисляет среднее время восстановления платежа (в часах)
 * между payment_failed и payment_succeeded событиями для пользователя
 * 
 * @param userId - ID пользователя
 * @param from - Начало периода (опционально)
 * @param to - Конец периода (опционально)
 * @returns Среднее время в часах или null, если данных нет
 */
export async function calculateTimeToRecover(
  userId: string,
  from?: Date,
  to?: Date
): Promise<number | null> {
  const dateFilter = from || to ? { occurredAt: { gte: from, lte: to } } : {};

  // Получить все failed события пользователя
  const failedEvents = await prisma.event.findMany({
    where: {
      userId,
      type: 'payment_failed',
      ...dateFilter,
    },
    select: { id: true, occurredAt: true, amountCents: true },
    orderBy: { occurredAt: 'asc' },
  });

  if (failedEvents.length === 0) {
    return null;
  }

  // Для каждого failed события найти следующее succeeded с тем же amountCents (или близким)
  const recoveryTimes: number[] = [];

  for (const failed of failedEvents) {
    const succeeded = await prisma.event.findFirst({
      where: {
        userId,
        type: 'payment_succeeded',
        occurredAt: { gt: failed.occurredAt },
        recovered: true,
        ...(failed.amountCents ? { amountCents: failed.amountCents } : {}),
        ...(to ? { occurredAt: { lte: to } } : {}),
      },
      orderBy: { occurredAt: 'asc' },
      take: 1,
    });

    if (succeeded) {
      const diffMs = succeeded.occurredAt.getTime() - failed.occurredAt.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      recoveryTimes.push(diffHours);
    }
  }

  if (recoveryTimes.length === 0) {
    return null;
  }

  const average = recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length;
  return Math.round(average * 10) / 10; // Округлить до 1 знака после запятой
}







