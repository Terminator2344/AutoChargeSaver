import NodeCache from 'node-cache';

// Кэш для метрик дашборда (TTL 60 секунд)
export const metricsCache = new NodeCache({
  stdTTL: 60, // 60 секунд
  checkperiod: 120,
  useClones: false,
});

// Генерация ключа кэша для метрик пользователя
export function getCacheKey(userId: string, from?: Date, to?: Date): string {
  const dateStr = from || to ? `${from?.toISOString() || ''}_${to?.toISOString() || ''}` : 'all';
  return `metrics_${userId}_${dateStr}`;
}







